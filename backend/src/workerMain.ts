import { migrate, pool } from './db';
import { startWorker, reconcile } from './worker';
import { initSearch } from './lib/search';
import { emailQueue } from './queue';
import { redis } from './redis';

(async () => {
  await migrate();
  await initSearch();
  await reconcile();
  const worker = startWorker();
  const shutdown = async () => {
    setTimeout(() => process.exit(1), 25_000).unref();
    await worker.close(); await emailQueue.close(); await pool.end(); redis.disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
})().catch(e => { console.error(e); process.exit(1); });
