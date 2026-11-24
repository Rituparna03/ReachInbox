import { Pool } from 'pg';
import { config } from './config';

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  // Needed when using Render's *external* Postgres URL. The internal URL doesn't need it.
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
});
pool.on('error', e => console.error('[pg] idle client error', e.message));

export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      google_id   TEXT UNIQUE NOT NULL,
      email       TEXT NOT NULL,
      name        TEXT NOT NULL,
      avatar_url  TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS senders (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email       TEXT NOT NULL,
      smtp_host   TEXT NOT NULL,
      smtp_port   INT NOT NULL,
      smtp_user   TEXT NOT NULL,
      smtp_pass   TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS emails (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sender_id     UUID NOT NULL REFERENCES senders(id),
      batch_id      UUID NOT NULL,
      to_email      TEXT NOT NULL,
      subject       TEXT NOT NULL,
      body          TEXT NOT NULL,
      hourly_limit  INT NOT NULL,
      scheduled_at  TIMESTAMPTZ NOT NULL,
      status        TEXT NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled','processing','sent','failed')),
      claimed_at    TIMESTAMPTZ,
      sent_at       TIMESTAMPTZ,
      preview_url   TEXT,
      error         TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS emails_user_status_idx ON emails (user_id, status, scheduled_at);
    CREATE TABLE IF NOT EXISTS slack_connections (
      user_id      UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      webhook_url  TEXT NOT NULL,
      channel      TEXT,
      team_name    TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}
