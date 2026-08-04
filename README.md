*This project has been created as part of the 42 curriculum by &lt;login1&gt;.*

# Check-in app

## Description

A web app for sending check-in alerts to a small circle of trusted friends. A user
sends a check-in ("I need a chat", "could someone reach out"), their friends are
notified in real time, can acknowledge, and chat to coordinate.

This is **not an emergency service**. For real emergencies, call 999/112. The app
makes this clear to users and in its Terms of Service.

## Status: in development

Foundation complete — containerized app, TypeScript frontend and backend,
PostgreSQL with full schema, and working authentication (signup, login, sessions).
Feature work is next. See `PROJECT.md` for the full plan.

**Working now:**
- Containerized dev environment (one command to run everything)
- TypeScript end to end (frontend + backend share types)
- PostgreSQL database with full schema (users, friendships, alerts, acknowledgements, messages)
- Auth backend: signup, login, logout, session check — hashed passwords, validated input, httpOnly cookie sessions

**Next:**
- Signup / login UI forms (the API they call is already built)
- Friends system (add, accept, list)
- Sending and acknowledging alerts
- Real-time updates (WebSockets)
- Chat

## Running it

### Prerequisites

- Docker and Docker Compose installed
- Port 5173 free

### Setup

1. Copy the environment template:
   ```
   cp .env.example .env
   ```
2. Edit `.env` and set values. You MUST set:
   - `POSTGRES_PASSWORD` — any strong password
   - `JWT_SECRET` — generate one with: `openssl rand -base64 48`

   The backend will refuse to start if `JWT_SECRET` is missing — this is deliberate.

3. Start everything with one command:
   ```
   docker compose up --build
   ```
4. Open the app:
   ```
   http://localhost:5173
   ```

To stop: `docker compose down`
To stop and wipe the database: `docker compose down -v`

## Tech stack

- **Frontend:** React + TypeScript + Vite, react-router-dom
- **Backend:** Fastify + TypeScript
- **Database:** PostgreSQL with Prisma ORM
- **Auth:** bcryptjs password hashing, JWT in httpOnly cookies, Zod input validation
- **Orchestration:** Docker Compose (frontend, backend, database containers)

## Modules

The project targets 14 points (Major = 2 pts, Minor = 1 pt). Modules completed so far:

**Total so far: 2 / 14**

### Progressive Web App (PWA) — Web · Minor · 1 pt

**What it is.** The app is installable to the home screen / desktop and keeps
working offline. For a check-in app this matters: users should be able to open
the app instantly, like a native app, and not hit a broken page when their
connection drops.

**How it's implemented.**
- `vite-plugin-pwa` (Workbox under the hood) generates a **web app manifest**
  and a **service worker** at build time.
- The **manifest** (`frontend/vite.config.js`) defines the app name, icons
  (192, 512, and a maskable variant), theme colours, `display: standalone`,
  and install screenshots — making the app installable.
- The **service worker** precaches the built app shell (HTML, JS, icons) and
  falls back to `index.html` for all client-side routes, so the app loads
  offline from cache.
- An **offline banner** (`frontend/src/components/OfflineBanner.tsx`) listens to
  the browser's `online`/`offline` events and tells the user when live data is
  unavailable.

**How to verify.**
1. `docker compose up --build`, then build the frontend (`docker compose exec
   frontend npm run build`) and serve `frontend/dist/` — offline caching only
   works on a production build, not the Vite dev server.
2. Chrome → address bar shows an **install** icon → installs into its own window.
3. DevTools → Network → **Offline** → reload → the app still loads, and the
   offline banner appears.

**Scope note.** Web-push notifications (waking the user when a friend sends an
alert while the app is closed) are planned as a follow-up. They depend on the
alerts feature and backend push infrastructure, and are **not required** for
this module's point (which covers installability + offline). They are product
polish, tracked separately.

**Contributor.** maria.v.osokina

### GDPR Compliance — Data and Analytics · Minor · 1 pt

**What it is.** Users own their data, so the app lets them take a copy of it and
erase their account. For a check-in app this matters: the data is personal and
sensitive (who you reached out to, your messages), so a user must be able to
download everything the app holds about them and permanently delete it on
demand — the two core GDPR rights of access and erasure.

**How it's implemented.**
- Two guarded backend endpoints in `backend/src/routes/gdpr.ts`, mounted under
  `/api/account` and protected by the shared `requireAuth` hook (same pattern
  as `friends.ts`).
- **Export** — `GET /api/account/export` gathers the user's own rows from all
  five tables (user, friendships, alerts, acknowledgements, messages) via
  scoped Prisma queries, and returns them as a downloadable JSON file
  (`Content-Disposition` header). The user `select` **omits `passwordHash`**, so
  the hash can never leak into an export.
- **Delete with confirmation** — `DELETE /api/account` requires the user to
  re-enter their password (validated with Zod, checked with the same
  `bcrypt.compare` login uses). Only on a match does it run
  `prisma.user.delete`, whose `onDelete: Cascade` foreign keys wipe the user's
  friendships, alerts, acknowledgements and messages in one operation.
- **Confirmation emails** — both operations send a notification via a reusable
  helper (`backend/src/lib/mail.ts`, `sendMail(to, subject, body)` over SMTP,
  configured from env vars). Sends are fire-and-forget: a mail failure is logged
  and never blocks the export or delete. In dev, mail is caught by a **Mailhog**
  container (`docker-compose.yml`, web UI at `localhost:8025`); going live is an
  env-var change, no code change.

**How to verify.**
1. `docker compose up --build`, then sign up via curl to get a session cookie
   (`curl -c cookies.txt -X POST localhost:5173/api/auth/signup -H 'Content-Type:
   application/json' -d '{"email":"t@x.com","password":"secret123","displayName":"T"}'`).
2. **Export** — `curl -b cookies.txt localhost:5173/api/account/export` returns
   all five sections as JSON, with **no `passwordHash`** field.
3. **Delete** — no password → `400`; wrong password → `403`; correct password →
   `{"ok":true}`. Afterwards any guarded route returns `401` "Account no longer
   exists".
4. **Cascade** — in psql, confirm no rows remain for the deleted user and that
   the foreign keys carry `ON DELETE CASCADE`.
5. **Emails** — open `localhost:8025`; export and delete each produce a
   confirmation email.

**Scope note.** The confirmation emails send in dev via Mailhog; delivering to
real inboxes in production is an env-var swap. The `sendMail` helper is generic
(no GDPR-specific logic), so the **2FA module can reuse it** for login codes.
The frontend "Download my data" button and "Delete account" dialog are a
follow-up that depends on the login/signup forms; the backend
is fully testable via curl in the meantime.

**Contributor.** maria.v.osokina

## Project structure

```
backend/          Fastify + TypeScript API
  prisma/         Database schema and migrations
  src/
    routes/       API endpoints (auth, etc.)
    lib/          Shared helpers (JWT, cookies)
frontend/         React + TypeScript app
  src/
    pages/        Route pages (Home, Login, Signup)
    lib/          API client
docker-compose.yml
```

## Resources

- Fastify, Vite, React, Prisma, PostgreSQL documentation
- (AI usage documented per README requirements as the project develops.)
