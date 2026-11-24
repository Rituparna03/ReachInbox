import nodemailer from 'nodemailer';
import { pool } from '../db';
import { config } from '../config';

export interface Sender { id: string; email: string; smtp_host: string; smtp_port: number; smtp_user: string; smtp_pass: string }

/** Ensure a user owns SENDERS_PER_USER Ethereal accounts (fake SMTP). */
export async function ensureSenders(userId: string): Promise<Sender[]> {
  const { rows } = await pool.query<Sender>('SELECT * FROM senders WHERE user_id=$1 ORDER BY created_at', [userId]);
  const missing = config.sendersPerUser - rows.length;
  for (let i = 0; i < missing; i++) {
    const acc = await nodemailer.createTestAccount();
    const { rows: [s] } = await pool.query<Sender>(
      `INSERT INTO senders (user_id,email,smtp_host,smtp_port,smtp_user,smtp_pass)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [userId, acc.user, acc.smtp.host, acc.smtp.port, acc.user, acc.pass],
    );
    rows.push(s);
  }
  return rows;
}

const transports = new Map<string, nodemailer.Transporter>();
export function transportFor(s: Sender) {
  let t = transports.get(s.id);
  if (!t) {
    t = nodemailer.createTransport({
      host: s.smtp_host, port: s.smtp_port, secure: false,
      auth: { user: s.smtp_user, pass: s.smtp_pass },
    });
    transports.set(s.id, t);
  }
  return t;
}
