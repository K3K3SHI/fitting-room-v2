# Fitting Room

Upload a garment photo, describe the model and shoot in plain language
("a South Indian female model wearing this saree, studio lighting"), and get
back a hyperrealistic AI photo of that model wearing the garment.

## How it works

Two AI stages, both run on [Replicate](https://replicate.com):

1. **Text-to-image** (`black-forest-labs/flux-schnell`) generates a
   photorealistic full-body model photo from your description.
2. **Virtual try-on** (`cuuupid/idm-vton`) dresses that generated model in
   your uploaded garment.

Each generation costs roughly **$0.03** and takes **20–40 seconds**. The
frontend kicks off stage 1, polls until it finishes, then kicks off stage 2
and polls again — so the whole thing works fine on serverless hosting
without hitting request time limits.

**License note**: `cuuupid/idm-vton` is CC BY-NC-SA 4.0 — non-commercial use
only. Fine for a personal/cloud project or demo; if you ever charge money for
this, swap `TRYON_MODEL` in `lib/replicate.ts` for a commercially licensed
try-on model.

## Run it locally

Requires **Node.js 20.9 or newer**. Check with `node -v`.

```bash
npm install
cp .env.example .env.local
# edit .env.local: paste your Replicate token and set SESSION_SECRET to a
# random string (e.g. output of: openssl rand -base64 32)
npm run dev
```

Open http://localhost:3000 — you'll be redirected to `/login`. Click
**Create account** the first time, then use **Sign in** after that.

### Check your setup first

Before spending money on a generation, visit **http://localhost:3000/api/health**.
It verifies your token is present, well-formed, and actually accepted by
Replicate — and tells you exactly what to fix if not:

- `{"ok":true,...}` — you are good to go.
- `REPLICATE_API_TOKEN is not set` — create `.env.local` and restart the server.
- `401 Unauthorized` — the token is wrong or revoked; get a new one.

Note: the dev server only reads `.env.local` at startup, so **restart it**
(Ctrl+C then `npm run dev`) after changing that file.

Get a token at https://replicate.com/account/api-tokens (sign up, add a
little credit — a few dollars covers 100+ generations).

## Deploy it publicly (Vercel — free)

1. Push this folder to a new GitHub repo.
2. Go to https://vercel.com, sign in with GitHub, click **Add New → Project**,
   and import the repo.
3. Vercel auto-detects Next.js — leave the build settings as default.
4. Under **Environment Variables**, add:
   - `REPLICATE_API_TOKEN` = your token from replicate.com
   - `SESSION_SECRET` = a long random string (e.g. `openssl rand -base64 32`)
5. Click **Deploy**. In about a minute you get a public URL like
   `https://your-app.vercel.app` — that's it, live and shareable.
6. Go to your project → **Storage** tab → **Create Database** → **Postgres**
   → **Connect** to this project. This gives you a real, persistent database
   (see **Database** below) — without it, accounts you register will vanish
   on the next redeploy.

Every push to the repo's main branch redeploys automatically.

### Alternative hosts
Railway and Render also work (`npm run build` / `npm run start`), but Vercel
is the path of least resistance for a Next.js app specifically.

## Project structure

```
app/
  page.tsx              # main UI — upload, prompt, results feed
  api/predict/route.ts       # POST: starts a Replicate prediction (stage 1 or 2)
  api/predict/[id]/route.ts  # GET: polls a prediction's status/output
  login/page.tsx        # sign in / create account page
  api/register/route.ts # POST: create account (+ sign in)
  api/login/route.ts    # POST: sign in
  api/logout/route.ts   # POST: sign out
  api/me/route.ts       # GET: current username
components/
  UploadZone.tsx        # garment drag-and-drop / file picker
  ShootCard.tsx          # one result card (status + image + download)
lib/
  replicate.ts           # Replicate client + model identifiers
  pipeline.ts            # client-side orchestration of the 2-stage job
  types.ts
  auth.ts                # signed session cookie helpers
  users.ts               # accounts: scrypt password hashing + Postgres storage
  db.ts                  # Postgres connection pool + schema setup
  rateLimit.ts           # login/register attempt limiter
```

## Authentication

Per-user accounts: anyone can **create an account** and **sign in** on the
`/login` page (two tabs: *Sign in* / *Create account*). Registering also
signs you in. The signed-in username is shown in the app header.

How it works:
- `POST /api/register` validates the username (3–30 chars: letters, numbers,
  `.` `-` `_`, unique ignoring case) and password (8+ chars), then stores the
  account in Postgres (`lib/db.ts` / `lib/users.ts`) — see **Database** below.
- Passwords are **never stored in plain text** — each one is hashed with
  scrypt and its own random salt (`lib/users.ts`).
- `POST /api/login` checks the credentials and sets a signed, `httpOnly`
  session cookie (HMAC-SHA256 with `SESSION_SECRET`, valid 7 days). Wrong
  username and wrong password give the same vague error, and repeated failed
  attempts are rate-limited (`lib/rateLimit.ts`).
- `proxy.ts` checks every request for a valid cookie and redirects to
  `/login` (or returns 401 for API calls). `/api/predict` and
  `/api/predict/[id]` — the routes that spend money — check the session a
  second time on their own (defense-in-depth).
- `GET /api/me` returns the current username; `POST /api/logout` clears the
  cookie. Changing `SESSION_SECRET` logs everyone out.

## Database

Accounts live in Postgres, not on disk — Vercel's filesystem is read-only
and ephemeral, so a JSON file would lose every account on redeploy. The
`users` table is created automatically on first use (`ensureSchema()` in
`lib/db.ts`); there's no migration step to run by hand.

**Local dev:** set `DATABASE_URL` in `.env.local` to any Postgres instance
you control (a local install, or a free one from Vercel/Neon — see below).

**Production (Vercel):** go to your project → **Storage** tab → **Create
Database** → choose **Postgres** (this is Neon under the hood) → **Connect**
to your project. Vercel automatically injects a `POSTGRES_URL` environment
variable — you don't need to copy/paste a connection string yourself, and
`lib/db.ts` already prefers `POSTGRES_URL` over `DATABASE_URL`. Redeploy
(or just push a commit) after connecting it.

Free tier: 1GB storage, 100 compute-hours/month, no credit card required —
comfortably enough for a course project.

## Security

This project pins Next.js 16.3.5, React 19.3.0, and PostCSS 8.5.28 — all current,
actively patched versions as of writing (`npm audit` returns 0 vulnerabilities).
Next.js 14.x stopped receiving security patches; if you ever bump dependencies
yourself, re-run `npm audit` and check https://nextjs.org/blog for the current
supported/LTS line rather than assuming an older major is still maintained.

**Never commit real secrets to `.env.example`.** That file ships with the repo
(it is *not* gitignored — only `.env` and `.env.local` are). Keep it full of
placeholders only; put real values in `.env.local` on your machine and in
Vercel's Environment Variables for deployment.

## Reliability notes

The browser polls your server for job status; your server asks Replicate.
A single failed poll does **not** kill the job — transient errors (dev-server
recompiles, cold starts, brief network blips) are retried, and only 8
*consecutive* failures give up. Real failures (the model errored, a bad
prediction id) surface immediately with the actual reason instead of spinning.

If a job ever seems stuck, its id is in your browser Network tab; you can look
up any prediction directly at `https://replicate.com/p/<id>` to see ground truth.

One dev-mode gotcha: saving a file while a generation is running triggers Fast
Refresh, which resets React state and abandons the in-flight job. That is a
development-only behaviour, not a bug in the app.

## Notes

- Anyone can register, so anyone with the URL can still run up your Replicate
  bill; add per-user limits on generations before sharing broadly.
- Only user accounts are saved (Postgres); generated shoots are not stored —
  they disappear on page refresh.
- Generated images are served directly from Replicate's CDN
  (`replicate.delivery`) rather than stored on your own server — they expire
  after a while on Replicate's side. Add storage (e.g. Vercel Blob or S3) if
  you need results to persist long-term.
- Uploaded garment images are sent as base64 data URLs and never written to
  disk — nothing to clean up, but very large photos (>~5MB) may be slow to
  upload; resize on the client if that becomes an issue.
