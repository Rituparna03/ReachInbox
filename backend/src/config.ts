import 'dotenv/config';

const num = (v: string | undefined, d: number) => (v && !isNaN(+v) ? +v : d);
const isProd = process.env.NODE_ENV === 'production';

/** In production a missing/weak secret is a hard error, never a silent default. */
function secret(name: string, devDefault: string, minLen = 16): string {
  const v = process.env[name];
  if (v && v.length >= minLen) return v;
  if (isProd) throw new Error(`${name} must be set (>= ${minLen} chars) in production`);
  return v || devDefault;
}

export const config = {
  isProd,
  port: num(process.env.PORT, 4000),
  /** Public URL users visit (Vercel). Used for CORS + post-login redirects. */
  frontendUrl: (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/$/, ''),
  /** Public URL OAuth providers call back to. With the Vercel proxy this is the Vercel URL. */
  backendUrl: (process.env.BACKEND_URL ?? 'http://localhost:4000').replace(/\/$/, ''),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://scheduler:scheduler@localhost:5432/scheduler',
  databaseSsl: process.env.DATABASE_SSL === 'true',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  esUrl: process.env.ELASTICSEARCH_URL ?? '',
  esApiKey: process.env.ELASTICSEARCH_API_KEY ?? '',
  jwtSecret: secret('JWT_SECRET', 'dev-secret'),
  google: { clientId: process.env.GOOGLE_CLIENT_ID?.trim() ?? '', clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() ?? '' },
  slack: { clientId: process.env.SLACK_CLIENT_ID?.trim() ?? '', clientSecret: process.env.SLACK_CLIENT_SECRET?.trim() ?? '' },
  workerConcurrency: num(process.env.WORKER_CONCURRENCY, 5),
  minDelayMs: num(process.env.MIN_DELAY_BETWEEN_SENDS_MS, 2000),
  maxPerHourPerSender: num(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER, 200),
  sendersPerUser: num(process.env.SENDERS_PER_USER, 2),
  bullBoard: {
    user: process.env.BULL_BOARD_USER ?? 'admin',
    pass: secret('BULL_BOARD_PASS', 'admin', 8),
  },
};
export const QUEUE_NAME = 'email-send';
