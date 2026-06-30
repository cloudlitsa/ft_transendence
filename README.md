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
