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

**Total so far: 1 / 14**

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
