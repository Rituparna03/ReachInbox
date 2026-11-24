import { Router } from 'express';
import { config } from '../config';
import { pool } from '../db';
import { randomBytes } from 'crypto';
import { requireAuth, AuthedRequest, signToken, cookieOpts } from '../lib/auth';

export const authRouter = Router();
const redirectUri = `${config.backendUrl}/auth/google/callback`;

// 1) send the browser to Google's consent screen
authRouter.get('/auth/google', (_req, res) => {
  const state = randomBytes(16).toString('hex');
  res.cookie('g_state', state, { ...cookieOpts, maxAge: 10 * 60_000 });   // CSRF: must match ?state on return
  const p = new URLSearchParams({ state,
    client_id: config.google.clientId, redirect_uri: redirectUri, response_type: 'code',
    scope: 'openid email profile', access_type: 'online', prompt: 'select_account',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${p}`);
});

// 2) Google sends the user back with ?code=...
authRouter.get('/auth/google/callback', async (req, res) => {
  try {
    if (!req.query.state || req.query.state !== req.cookies?.g_state) throw new Error('state mismatch');
    res.clearCookie('g_state', cookieOpts);
    const code = String(req.query.code ?? '');
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: config.google.clientId, client_secret: config.google.clientSecret,
        redirect_uri: redirectUri, grant_type: 'authorization_code',
      }),
    });
    const tokens = await tokenRes.json() as { access_token?: string };
    if (!tokens.access_token) throw new Error('token exchange failed');
    const profile = await (await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })).json() as { sub: string; email: string; name: string; picture?: string };

    const { rows: [user] } = await pool.query(
      `INSERT INTO users (google_id,email,name,avatar_url) VALUES ($1,$2,$3,$4)
       ON CONFLICT (google_id) DO UPDATE SET email=EXCLUDED.email, name=EXCLUDED.name, avatar_url=EXCLUDED.avatar_url
       RETURNING id`, [profile.sub, profile.email, profile.name, profile.picture ?? null]);

    res.cookie('token', signToken(user.id), { ...cookieOpts, maxAge: 7 * 864e5 });
    res.redirect(`${config.frontendUrl}/dashboard`);
  } catch (e) {
    console.error('[auth]', e);
    res.redirect(`${config.frontendUrl}/?error=login_failed`);
  }
});

authRouter.get('/api/me', requireAuth, async (req: AuthedRequest, res) => {
  const { rows } = await pool.query('SELECT id,email,name,avatar_url AS "avatarUrl" FROM users WHERE id=$1', [req.userId]);
  rows[0] ? res.json(rows[0]) : res.status(401).json({ error: 'Unknown user' });
});

authRouter.post('/api/logout', (_req, res) => { res.clearCookie('token', cookieOpts); res.json({ ok: true }); });
