import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { pool } from '../db';
import { requireAuth, AuthedRequest, signToken } from '../lib/auth';
import { notifySlack } from '../lib/slack';

export const slackRouter = Router();
const redirectUri = `${config.backendUrl}/api/slack/callback`;

slackRouter.get('/api/slack/status', requireAuth, async (req: AuthedRequest, res) => {
  const { rows } = await pool.query('SELECT channel, team_name AS "teamName" FROM slack_connections WHERE user_id=$1', [req.userId]);
  res.json({ connected: !!rows[0], ...rows[0] });
});

// Browser navigation -> Slack consent screen. `state` is a short-lived signed token carrying the user id (CSRF + identity).
slackRouter.get('/api/slack/connect', requireAuth, (req: AuthedRequest, res) => {
  const p = new URLSearchParams({
    client_id: config.slack.clientId, scope: 'incoming-webhook', redirect_uri: redirectUri, state: signToken(req.userId!, '10m'),
  });
  res.redirect(`https://slack.com/oauth/v2/authorize?${p}`);
});

slackRouter.get('/api/slack/callback', async (req, res) => {
  try {
    const { sub: userId } = jwt.verify(String(req.query.state), config.jwtSecret) as { sub: string };
    const r = await (await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code: String(req.query.code), client_id: config.slack.clientId, client_secret: config.slack.clientSecret, redirect_uri: redirectUri }),
    })).json() as any;
    if (!r.ok || !r.incoming_webhook?.url) throw new Error(r.error ?? 'no webhook returned');
    await pool.query(
      `INSERT INTO slack_connections (user_id,webhook_url,channel,team_name) VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id) DO UPDATE SET webhook_url=EXCLUDED.webhook_url, channel=EXCLUDED.channel, team_name=EXCLUDED.team_name`,
      [userId, r.incoming_webhook.url, r.incoming_webhook.channel, r.team?.name]);
    await notifySlack(userId, ':white_check_mark: Slack connected to ReachInbox Scheduler. You will be alerted when a sender hits its hourly limit.');
    res.redirect(`${config.frontendUrl}/dashboard?slack=connected`);
  } catch (e) {
    console.error('[slack]', e);
    res.redirect(`${config.frontendUrl}/dashboard?slack=error`);
  }
});

slackRouter.delete('/api/slack', requireAuth, async (req: AuthedRequest, res) => {
  await pool.query('DELETE FROM slack_connections WHERE user_id=$1', [req.userId]);
  res.json({ ok: true });
});

slackRouter.post('/api/slack/test', requireAuth, async (req: AuthedRequest, res) => {
  const ok = await notifySlack(req.userId!, ':bell: Test message from ReachInbox Scheduler.');
  res.status(ok ? 200 : 409).json({ delivered: ok });
});
