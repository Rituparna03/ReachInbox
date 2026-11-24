import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { timingSafeEqual } from 'crypto';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { config } from './config';
import { migrate, pool } from './db';
import { emailQueue } from './queue';
import { redis } from './redis';
import { initSearch } from './lib/search';
import { startWorker, reconcile } from './worker';
import { authRouter } from './routes/auth';
import { emailsRouter } from './routes/emails';
import { slackRouter } from './routes/slack';

const safeEq = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

async function main() {
  await migrate();
  await initSearch();

  const app = express();
  // Browser -> Vercel (rewrite) -> Render LB -> app = 2 proxy hops. Override with TRUST_PROXY if topology changes.
  app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 2));
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false }));   // JSON API + Bull Board UI; CSP is set by the frontend host
  app.use(cors({ origin: config.frontendUrl, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());

  // Health first (no auth, no rate limit): used by Render's health check.
  app.get('/health', async (_req, res) => {
    try {
      await Promise.all([pool.query('SELECT 1'), redis.ping()]);
      res.json({ ok: true });
    } catch (e) { res.status(503).json({ ok: false, error: (e as Error).message }); }
  });

  // Brute-force / abuse protection
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));
  app.use('/auth', rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false }));
  app.use('/admin', rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false }));

  // Live BullMQ dashboard (basic-auth protected, constant-time compare)
  const board = new ExpressAdapter();
  board.setBasePath('/admin/queues');
  createBullBoard({ queues: [new BullMQAdapter(emailQueue) as any], serverAdapter: board });
  app.use('/admin/queues', (req, res, next) => {
    const [u = '', ...rest] = Buffer.from((req.headers.authorization ?? '').split(' ')[1] ?? '', 'base64').toString().split(':');
    if (safeEq(u, config.bullBoard.user) && safeEq(rest.join(':'), config.bullBoard.pass)) return next();
    res.set('WWW-Authenticate', 'Basic realm="queues"').status(401).send('Auth required');
  }, board.getRouter());

  app.use(authRouter, emailsRouter, slackRouter);

  // Last-resort error handler: never leak stack traces.
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[unhandled]', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  await reconcile();                                   // restore any unsent emails missing from Redis
  const worker = process.env.EMBEDDED_WORKER !== 'false' ? startWorker() : null;

  const server = app.listen(config.port, '0.0.0.0', () =>
    console.log(`API listening on :${config.port} | public ${config.backendUrl} | queues: /admin/queues`));

  // Graceful shutdown (Render sends SIGTERM on every deploy): stop taking work, let in-flight sends finish.
  let closing = false;
  const shutdown = async (sig: string) => {
    if (closing) return; closing = true;
    console.log(`[shutdown] ${sig}`);
    setTimeout(() => process.exit(1), 25_000).unref();
    server.close();
    await worker?.close();          // waits for active jobs; unfinished ones are re-picked after restart (jobId idempotent + DB claim)
    await emailQueue.close();
    await pool.end();
    redis.disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
process.on('unhandledRejection', e => console.error('[unhandledRejection]', e));
main().catch(e => { console.error(e); process.exit(1); });
