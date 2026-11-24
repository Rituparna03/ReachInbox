# Deploying: Vercel (frontend) + Render (backend)

## Architecture
```
Browser ──► https://APP.vercel.app  (React SPA)
              │  /api/*  /auth/*  rewritten by Vercel (vercel.json)
              ▼
         https://API.onrender.com  (Express + BullMQ worker)  ──► Render Postgres, Render Key Value (Redis), Elasticsearch (optional)
```
The browser only ever talks to the Vercel domain, so the login cookie is **first-party** (`SameSite=Lax; Secure; HttpOnly`).
Calling Render directly from Vercel would make it a third-party cookie, which Safari and Chrome block, and login would silently fail.
It also means Google and Slack redirect URIs use the **Vercel** domain.

## 0. Before anything: rotate secrets
The zip you shared contained a real `backend/.env` (Google client secret, JWT secret, Bull Board password). Treat them as leaked:
regenerate the Google client secret, generate a new `JWT_SECRET` (`openssl rand -hex 32`), and never commit `.env`.

## 1. Render (backend) -- do this first, you need its URL
1. Push the repo to GitHub.
2. Render > New > Blueprint > select repo (uses `render.yaml`): creates Postgres, Key Value (Redis, `noeviction`) and the web service.
3. Set the `sync: false` env vars when prompted. Leave `FRONTEND_URL` / `BACKEND_URL` blank for now.
4. Copy the service URL, e.g. `https://reachinbox-scheduler-api.onrender.com`.

Must-haves:
* **Web service plan must be paid/always-on.** Free instances sleep after ~15 min and a sleeping process cannot fire delayed jobs.
* **Redis `maxmemory-policy` = `noeviction`.** Otherwise Redis may evict BullMQ keys and silently lose jobs. The reconcile-on-boot restores unsent emails from Postgres if it ever happens.
* Postgres/Redis are connected over Render's **internal** URLs (no SSL setting needed).
* Elasticsearch isn't offered by Render. Use Elastic Cloud or Bonsai (set `ELASTICSEARCH_URL` and optionally `ELASTICSEARCH_API_KEY`), or leave it blank and search falls back to SQL.

## 2. Vercel (frontend)
1. In `frontend/vercel.json` replace both `YOUR-RENDER-SERVICE.onrender.com` with your Render host. Commit.
2. Vercel > Add New Project > repo > **Root Directory: `frontend`** (Framework: Vite). No env vars needed (`.env.production` sets `VITE_API_URL=` empty = same-origin).
3. Deploy. Note the URL, e.g. `https://reachinbox.vercel.app`.

## 3. Wire the URLs together
On Render set:
```
FRONTEND_URL=https://reachinbox.vercel.app
BACKEND_URL=https://reachinbox.vercel.app     # yes, the Vercel URL
```
(redeploy the Render service)

**Google Cloud Console** > OAuth client:
* Authorized JavaScript origins: `https://reachinbox.vercel.app`
* Authorized redirect URI: `https://reachinbox.vercel.app/auth/google/callback`
* If the consent screen is in "Testing", add your tester emails, or publish it.

**Slack app** > OAuth & Permissions > Redirect URL: `https://reachinbox.vercel.app/api/slack/callback`

## 4. Verify
1. `https://API.onrender.com/health` returns `{"ok":true}`.
2. Open the Vercel URL > Login with Google > lands on dashboard with name/email/avatar.
3. Compose: 3 recipients, start +2 min, then **restart the Render service** before it fires. Emails still send on time, once (check Bull Board and the Sent tab).
4. Set hourly limit = 1 with 3 recipients and click Connect Slack first. A Slack message arrives and the other two move to the next hour.
5. Queue dashboard: `https://API.onrender.com/admin/queues` (user `admin`, password = `BULL_BOARD_PASS` from Render env). Use the Render URL here, not Vercel.

## Scaling out
Set `EMBEDDED_WORKER=false` on the web service and add a Render **Background Worker** with start command `npm run start:worker` (same env vars). The Redis-backed limiter and rate counters stay correct across instances.

## Known limits
* Vercel rewrites have a request timeout (~30s+ depending on plan); scheduling is chunked, but a single very large upload (tens of thousands of leads) may be slow. Keep CSVs under ~10k rows or call the API on Render directly.
* Fixed hourly windows (see README), so up to 2x the limit can occur across a boundary.
