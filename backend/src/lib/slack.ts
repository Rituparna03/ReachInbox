import { pool } from '../db';

/** Sends a real message to the user's connected Slack webhook. No-ops (no crash) if not connected. */
export async function notifySlack(userId: string, text: string) {
  const { rows } = await pool.query('SELECT webhook_url FROM slack_connections WHERE user_id=$1', [userId]);
  if (!rows[0]) return false;
  try {
    const res = await fetch(rows[0].webhook_url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.warn('[slack] webhook failed', res.status);
      if ([403, 404, 410].includes(res.status)) await pool.query('DELETE FROM slack_connections WHERE user_id=$1', [userId]); // revoked
      return false;
    }
    console.log('[slack] notification delivered');
    return true;
  } catch (e) { console.warn('[slack] error', (e as Error).message); return false; }
}
