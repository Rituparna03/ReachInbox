import { Router } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { pool } from '../db';
import { config } from '../config';
import { requireAuth, AuthedRequest } from '../lib/auth';
import { ensureSenders } from '../lib/mailer';
import { emailQueue } from '../queue';
import { indexEmails, searchEmailIds } from '../lib/search';

export const emailsRouter = Router();
emailsRouter.use('/api/emails', requireAuth);

const scheduleSchema = z.object({
  subject: z.string().min(1).max(300),
  body: z.string().min(1),
  recipients: z.array(z.string().email()).min(1).max(50_000),
  startTime: z.string().datetime({ offset: true }),
  delaySeconds: z.number().min(0).max(86_400).default(0),   // gap between consecutive emails in this batch
  hourlyLimit: z.number().int().min(1).max(100_000).optional(),
});

emailsRouter.post('/api/emails/schedule', async (req: AuthedRequest, res) => {
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
  const { subject, body, startTime, delaySeconds } = parsed.data;
  const recipients = [...new Set(parsed.data.recipients.map(r => r.trim().toLowerCase()))];
  const hourlyLimit = parsed.data.hourlyLimit ?? config.maxPerHourPerSender;
  const userId = req.userId!;

  const senders = await ensureSenders(userId);
  const batchId = randomUUID();
  const start = new Date(startTime).getTime();
  // Pre-compute rows. Round-robin across senders; each recipient gets start + i*delay.
  const rows = recipients.map((to, i) => ({
    id: randomUUID(), sender: senders[i % senders.length], to, at: new Date(start + i * delaySeconds * 1000),
  }));

  // 1) Persist first (source of truth), in chunks.
  for (let i = 0; i < rows.length; i += 1000) {
    const c = rows.slice(i, i + 1000);
    await pool.query(
      `INSERT INTO emails (id,user_id,sender_id,batch_id,to_email,subject,body,hourly_limit,scheduled_at)
       SELECT id,$2::uuid,sender_id,$3::uuid,to_email,$4,$5,$6,scheduled_at
       FROM unnest($1::uuid[],$7::uuid[],$8::text[],$9::timestamptz[]) AS t(id,sender_id,to_email,scheduled_at)`,
      [c.map(r => r.id), userId, batchId, subject, body, hourlyLimit,
       c.map(r => r.sender.id), c.map(r => r.to), c.map(r => r.at)]);
  }
  // 2) Enqueue delayed jobs (jobId = emailId => idempotent). If we crash between 1 and 2, boot reconcile re-enqueues.
  for (let i = 0; i < rows.length; i += 1000) {
    await emailQueue.addBulk(rows.slice(i, i + 1000).map(r => ({
      name: 'send',
      data: { emailId: r.id, senderId: r.sender.id, userId, hourlyLimit },
      opts: { jobId: r.id, delay: Math.max(0, r.at.getTime() - Date.now()) },
    })));
  }
  // 3) Index for search (best effort).
  await indexEmails(rows.map(r => ({
    id: r.id, userId, toEmail: r.to, subject, body, status: 'scheduled', scheduledAt: r.at.toISOString(),
  })));

  res.status(201).json({ batchId, count: rows.length, senders: senders.map(s => s.email) });
});

emailsRouter.get('/api/emails', async (req: AuthedRequest, res) => {
  const kind = req.query.status === 'sent' ? 'sent' : 'scheduled';
  const statuses = kind === 'sent' ? ['sent', 'failed'] : ['scheduled', 'processing'];
  const q = String(req.query.q ?? '').trim();
  const cols = `id, to_email AS "toEmail", subject, status, scheduled_at AS "scheduledAt", sent_at AS "sentAt",
                preview_url AS "previewUrl", error`;
  const order = kind === 'sent' ? 'sent_at DESC NULLS LAST' : 'scheduled_at ASC';

  let ids: string[] | null = null;
  if (q) { try { ids = await searchEmailIds(req.userId!, q, statuses); } catch { ids = null; } }

  const { rows } = ids
    ? await pool.query(`SELECT ${cols} FROM emails WHERE user_id=$1 AND id = ANY($2::uuid[]) AND status = ANY($3) ORDER BY ${order} LIMIT 500`, [req.userId, ids, statuses])
    : await pool.query(
        `SELECT ${cols} FROM emails WHERE user_id=$1 AND status = ANY($2) ${q ? 'AND (to_email ILIKE $3 OR subject ILIKE $3)' : ''} ORDER BY ${order} LIMIT 500`,
        q ? [req.userId, statuses, `%${q}%`] : [req.userId, statuses]);
  res.json(rows);
});
emailsRouter.get('/api/emails/:id', async (req: AuthedRequest, res) => {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  const { rows } = await pool.query(
    `SELECT e.id, e.to_email AS "toEmail", e.subject, e.body, e.status,
            e.scheduled_at AS "scheduledAt", e.sent_at AS "sentAt",
            e.preview_url AS "previewUrl", e.error, s.email AS "fromEmail"
     FROM emails e JOIN senders s ON s.id = e.sender_id
     WHERE e.id = $1 AND e.user_id = $2`, [req.params.id, req.userId]);
  rows[0] ? res.json(rows[0]) : res.status(404).json({ error: 'Email not found' });
});