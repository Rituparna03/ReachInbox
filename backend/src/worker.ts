import { Worker, DelayedError, Job } from 'bullmq';
import { pool } from './db';
import { config, QUEUE_NAME } from './config';
import { makeRedis } from './redis';
import { EmailJobData, enqueueEmail } from './queue';
import { reserveSlot, firstLimitHit, windowOf } from './lib/rateLimiter';
import { transportFor, Sender } from './lib/mailer';
import { updateEmailDoc } from './lib/search';
import { notifySlack } from './lib/slack';
import nodemailer from 'nodemailer';

const STALE_CLAIM_SECONDS = 60; // a 'processing' row older than this belongs to a crashed worker

async function process_(job: Job<EmailJobData>, token?: string) {
  const { emailId, senderId, userId, hourlyLimit } = job.data;

  // 0. Idempotency guard: already finished -> nothing to do.
  const cur = await pool.query('SELECT status FROM emails WHERE id=$1', [emailId]);
  if (!cur.rows[0] || ['sent', 'failed'].includes(cur.rows[0].status)) return 'skipped';

  // 1. Hourly rate limit (Redis-backed, atomic, cross-worker). A slot is reserved at most once per job.
  const now = Date.now();
  if (job.data.reservedWindow === undefined) {
    const slot = await reserveSlot(senderId, hourlyLimit, now);
    await job.updateData({ ...job.data, reservedWindow: slot.window });
    if (slot.deferred) {
      // Limit hit: do NOT fail/drop. Park the job until the window that has capacity.
      await pool.query('UPDATE emails SET scheduled_at=$2 WHERE id=$1', [emailId, new Date(slot.runAt)]);
      await updateEmailDoc(emailId, { scheduledAt: new Date(slot.runAt).toISOString() });
      if (await firstLimitHit(senderId, slot.nowWindow)) {
        const { rows } = await pool.query('SELECT email FROM senders WHERE id=$1', [senderId]);
        await notifySlack(userId,
          `:warning: *Hourly limit reached* for sender \`${rows[0]?.email}\` (${hourlyLimit}/hour). ` +
          `Remaining emails are rescheduled to the next hour window (${new Date(slot.runAt).toISOString()}).`);
      }
      await job.moveToDelayed(slot.runAt, token);
      throw new DelayedError();
    }
  } else if (job.data.reservedWindow > windowOf(now)) {
    await job.moveToDelayed(job.data.reservedWindow * 3_600_000, token);
    throw new DelayedError();
  }

  // 2. Atomic claim (compare-and-set). Only one worker can win; a crashed claim becomes reclaimable.
  const claim = await pool.query(
    `UPDATE emails SET status='processing', claimed_at=now()
     WHERE id=$1 AND (status='scheduled' OR (status='processing' AND claimed_at < now() - make_interval(secs => $2)))
     RETURNING *`, [emailId, STALE_CLAIM_SECONDS]);
  if (!claim.rows[0]) throw new Error('email is being processed by another worker; retrying later');
  const email = claim.rows[0];

  // 3. Send.
  try {
    const { rows: [sender] } = await pool.query<Sender>('SELECT * FROM senders WHERE id=$1', [senderId]);
    const info = await transportFor(sender).sendMail({
      from: `"ReachInbox Scheduler" <${sender.email}>`,
      to: email.to_email, subject: email.subject, html: email.body, text: email.body.replace(/<[^>]+>/g, ''),
      messageId: `<${emailId}@reachinbox.local>`, // stable id => downstream can de-dupe
    });
    const preview = nodemailer.getTestMessageUrl(info) || null;
    await pool.query(`UPDATE emails SET status='sent', sent_at=now(), preview_url=$2, error=NULL WHERE id=$1`, [emailId, preview]);
    await updateEmailDoc(emailId, { status: 'sent', sentAt: new Date().toISOString() });
    return 'sent';
  } catch (err) {
    // release the claim so BullMQ's retry can pick it up again
    await pool.query(`UPDATE emails SET status='scheduled', error=$2 WHERE id=$1`, [emailId, (err as Error).message]);
    throw err;
  }
}

export function startWorker() {
  const worker = new Worker<EmailJobData>(QUEUE_NAME, process_, {
    connection: makeRedis(),
    concurrency: config.workerConcurrency,
    // Provider throttle: at most 1 send per MIN_DELAY_BETWEEN_SENDS_MS, enforced in Redis across ALL workers.
    limiter: { max: 1, duration: config.minDelayMs },
  });
  worker.on('failed', async (job, err) => {
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {           // retries exhausted
      await pool.query(`UPDATE emails SET status='failed', sent_at=now(), error=$2 WHERE id=$1`, [job.data.emailId, err.message]);
      await updateEmailDoc(job.data.emailId, { status: 'failed', sentAt: new Date().toISOString() });
    }
  });
  worker.on('error', e => console.error('[worker]', e.message));
  console.log(`[worker] concurrency=${config.workerConcurrency} minDelay=${config.minDelayMs}ms`);
  return worker;
}

/**
 * Boot-time reconciliation: re-enqueue any unsent email that has no job (e.g. Redis was wiped).
 * Safe to run on every start: jobId === emailId so existing jobs are never duplicated.
 */
export async function reconcile() {
  let n = 0;
  const { rows } = await pool.query(
    `SELECT id, sender_id, user_id, hourly_limit, scheduled_at FROM emails
     WHERE status='scheduled' OR (status='processing' AND claimed_at < now() - interval '2 minutes')`);
  for (const r of rows) {
    const job = await enqueueEmail({ emailId: r.id, senderId: r.sender_id, userId: r.user_id, hourlyLimit: r.hourly_limit }, r.scheduled_at);
    if (job) n++;
  }
  console.log(`[reconcile] checked ${rows.length} unsent emails`);
  return n;
}
