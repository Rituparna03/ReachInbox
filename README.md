# ReachInbox Email Scheduler

Express + TypeScript + BullMQ/Redis + Postgres + Elasticsearch backend, React + Tailwind dashboard.
Scheduling is 100% BullMQ delayed jobs. There is **no cron** anywhere.

## Quick start

```bash
docker compose up -d                       # redis, postgres, elasticsearch
cd backend  && cp .env.example .env        # fill in Google + Slack credentials
npm install && npm run dev                 # API + embedded worker on :4000
cd ../frontend && cp .env.example .env
npm install && npm run dev                 # dashboard on :5173
```

* Queue dashboard (Bull Board): `http://localhost:4000/admin/queues` (basic auth, `BULL_BOARD_USER/PASS`)
* To scale workers separately: set `EMBEDDED_WORKER=false` on the API and run `npm run dev:worker` in N processes.

### OAuth setup
**Google**: Cloud Console → Credentials → OAuth client (Web). Authorized redirect URI: `http://localhost:4000/auth/google/callback`.
**Slack**: api.slack.com/apps → create app → OAuth & Permissions → scope `incoming-webhook`, and add redirect URL
`<BACKEND_URL>/api/slack/callback`. Slack only accepts **HTTPS** redirect URLs, so expose the backend with
`ngrok http 4000` and set `BACKEND_URL=https://<id>.ngrok-free.app` in `.env` (and use that URL for the Slack redirect).
During Connect Slack the user picks a channel; the webhook URL is stored per user. No Slack connection => rate-limit hits skip notification silently; connecting later works immediately (no redeploy).

## Architecture

```
POST /api/emails/schedule
   1. INSERT rows in Postgres (source of truth)      status=scheduled
   2. queue.addBulk  delayed jobs, jobId = emailId   (idempotent enqueue)
   3. index into Elasticsearch (best effort)
Worker(s):  limiter -> rate-limit reserve (Redis Lua) -> atomic DB claim -> SMTP send -> mark sent
```

| Concern | Implementation |
|---|---|
| Scheduling | BullMQ delayed job per email; `scheduled_at = start + i × delay` |
| Multiple senders | Each user gets `SENDERS_PER_USER` Ethereal accounts, assigned round-robin |
| Concurrency | `WORKER_CONCURRENCY` (default 5) per worker process |
| Delay between sends | **`MIN_DELAY_BETWEEN_SENDS_MS` = 2000** → BullMQ `limiter {max:1, duration:2000}`; stored in Redis, so it holds across all workers |
| Hourly limit | Per **sender**, `MAX_EMAILS_PER_HOUR_PER_SENDER` default, overridable per campaign from the UI |
| Search | Elasticsearch index `emails`; `GET /api/emails?q=` uses it (falls back to SQL `ILIKE` if ES is down) |

### Hourly rate limiting
`lib/rateLimiter.ts` runs one **Lua script inside Redis**: starting at the current hour window it finds the first window whose
counter (`rl:{senderId}:{epochHour}`) is below the limit, increments it, and returns that window. Redis executes scripts atomically,
so any number of workers/instances can call it without races (verified: 12 parallel reservations at limit 5 → 5 / 5 / 2 across three hours).

* Window has capacity → send now.
* Window is full → job is **moved to delayed** (`moveToDelayed`) to the start of the first window with capacity. It is never failed or dropped; `scheduled_at` in the DB is updated so the UI shows the new time.
* Order is preserved as far as possible because overflow jobs fill later windows in the order they reserve.
* Each job reserves **once** (`reservedWindow` stored in job data), so retries and wake-ups never double-count.
* **Trade-off:** fixed hour windows (not sliding), so up to 2× the limit can occur across a window boundary (e.g. 200 at 10:59 and 200 at 11:00). A sliding log in a Redis ZSET would remove this at higher memory cost.
* Counters live in Redis. If Redis is wiped, counters reset (limit could be briefly exceeded) but no email is lost, see below.

### Behaviour under load (1000+ emails at the same time)
All 1000 jobs are persisted and enqueued. The limiter lets one job start every 2 s (any concurrency level), and each sender can send at most `limit` per hour; the rest are parked in future windows rather than failing. With 2 senders at 200/h, 1000 emails drain in ~3 hours; the `1/2 s` throttle is an additional ceiling (1800/h). Memory use is O(jobs) in Redis; nothing is held in process memory.

### Slack alert
The first time a sender is deferred in a window (`SET NX` per sender+window, so one alert, not one per email), the worker POSTs a real message to the user's Slack incoming webhook. A revoked webhook (403/404/410) is removed automatically.

### Persistence, restarts and idempotency
* Delayed jobs live in Redis (compose enables AOF) and emails live in Postgres → restart loses nothing; jobs fire at their original time and are not restarted.
* **Boot reconcile**: on startup every unsent email in Postgres is re-added with `jobId = emailId`. Existing jobs are ignored; jobs lost with Redis are restored.
* **No double sends**: (1) one job per email via `jobId`; (2) worker checks status then does a compare-and-set `UPDATE ... WHERE status='scheduled'`, so only one worker can claim an email; (3) stable SMTP `Message-ID` per email.
  A claim older than 60 s (crashed worker) can be re-claimed. 
* **Known gap (inherent to SMTP):** if a worker crashes *after* the SMTP server accepted the message but *before* the DB update, the email may be sent twice after recovery. The stable Message-ID lets providers/receivers de-duplicate.

## API
| Method | Path | |
|---|---|---|
| GET | `/auth/google`, `/auth/google/callback` | Google OAuth login (httpOnly JWT cookie) |
| GET | `/api/me`, POST `/api/logout` | |
| POST | `/api/emails/schedule` | `{subject, body, recipients[], startTime, delaySeconds, hourlyLimit?}` |
| GET | `/api/emails?status=scheduled\|sent&q=` | |
| GET | `/api/slack/connect` → callback, `/api/slack/status`, DELETE `/api/slack`, POST `/api/slack/test` | |

## Notes
* The Figma link was not included in the brief, so the UI follows the written requirements with its own clean styling. Send the frames and I'll match them.
* Ethereal preview links for each sent mail are shown next to the status.


## After Installation of Docker
# Run this in PowerShell as Administrator
wsl --install

## How to Run the App?

# In FrontEnd
npm install (For First Time)
cd frontend
npm run dev

# In Backend
npm install (For First Time)
cd backend
npm run dev

# In Root directory
docker --version (For First Time)
docker compose up -d
docker compose ps