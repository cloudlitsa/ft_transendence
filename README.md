*This project has been created as part of the 42 curriculum by evmouka.*

# Check-in app

## Description

A web app for sending check-in alerts to a small circle of trusted friends. A user
sends a check-in ("I need a chat", "could someone reach out"), their friends are
notified in real time, can acknowledge, and chat to coordinate.

This is **not an emergency service**. For real emergencies, call 999/112. The app
makes this clear to users and in its Terms of Service.

## Status: in development

Core features taking shape — containerized app, TypeScript end to end,
PostgreSQL with full schema, authentication, the friends system, and the
alerts backend. See `PROJECT.md` for the full plan.

**Working now:**
- Containerized dev environment (one command to run everything)
- TypeScript end to end (frontend + backend share types)
- PostgreSQL database with full schema (users, friendships, alerts, acknowledgements, messages)
- Auth backend: signup, login, logout, session check — hashed passwords, validated input, httpOnly cookie sessions
- Friends system: send/accept/decline requests, list friends, unfriend (backend + UI)
- Alerts backend: send, view, acknowledge, close
- In-app toast notifications, installable PWA with offline support

**Next:**
- Signup / login UI forms (the API they call is already built)
- Alerts UI
- Real-time updates (WebSockets)
- Chat
- Profile page, avatar upload, online status

## Running it

**After pulling a branch that adds a backend dependency**, run
`docker compose exec backend npm install` — a rebuild alone won't pick it up
because `node_modules` is a named volume.

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
- **Orchestration:** Docker Compose (frontend, backend, database, mailhog containers)

## Modules

The project targets 14 points (Major = 2 pts, Minor = 1 pt).

**Completed: 6 / 14** — Framework (Major, 2) · ORM (Minor, 1) ·
PWA (Minor, 1) · Notifications (Minor, 1) · GDPR (Minor, 1)

**In progress:** Standard User Management (friends system done; profile page,
avatar upload and online status still to build) · Real-time WebSockets · 2FA

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

### Notification system — Web · Minor · 1 pt

**What it is.** In-app toast notifications giving the user immediate feedback on
every create / update / delete action — e.g. "Friend request accepted",
"Removed from friends", or a red error toast when something fails. Success,
error, and info variants, auto-dismissing after 3 seconds.

**How it's implemented.**
- A reusable toast system built on **React Context**
  (`frontend/src/components/ToastProvider.tsx`): a `ToastProvider` wraps the whole
  app (`main.tsx`), a `useToast()` hook exposes `success` / `error` / `info`, and
  a container renders the toasts stacked in the corner — each schedules its own
  removal with a timer.
- Wired into **all current create/update/delete actions** (the friends system in
  `FriendsPage.tsx`): send request, accept, decline/cancel, unfriend — on both
  success and failure.
- **App-wide by design**: any future feature (alerts, chat, profile) fires a
  notification with one line — `useToast().success(...)` — no new setup.

**How to verify.**
1. Log in (two users), go to Friends.
2. Send a friend request → info toast; send to yourself → red error toast.
3. From the other user: accept / decline / unfriend → green success toasts.
4. Load `/friends` while logged out → red error toast ("Couldn't load friends: …").

**Scope note.** The subject asks for notifications on "all creation, update, and
deletion actions." Friends is currently the only feature with such actions; the
system is app-wide, so new features plug in via `useToast()` as they land. A
real-time notification centre (bell) is out of scope — it needs WebSockets and
is not required for this module.

**Contributor.** maria.v.osokina

## Project structure

```
backend/                Fastify + TypeScript API
  prisma/               Database schema and migrations
  src/
    lib/                Shared helpers (auth.ts, requireAuth.ts, mail.ts)
    routes/             API endpoints (auth.ts, friends.ts, gdpr.ts)
    prisma.ts           Shared PrismaClient instance
    server.ts           App entry: plugin registration, health check
docs/                   Project documentation
frontend/               React + TypeScript app
  public/               Static assets (favicon, PWA icons, screenshots)
  src/
    components/         Shared UI (OfflineBanner, ToastProvider)
    lib/                API client (api.ts)
    pages/              Route pages (Home, Login, Signup, Friends)
    App.tsx             Router and nav
    main.tsx            App entry: providers and root render
docker-compose.yml
```

## Resources

- Fastify, Vite, React, Prisma, PostgreSQL documentation
- (AI usage documented per README requirements as the project develops.)
