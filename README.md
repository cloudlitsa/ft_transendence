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

**Total so far: 1 / 14** *(PWA module in a separate PR adds 1 more)*

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
