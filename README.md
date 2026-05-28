*This project has been created as part of the 42 curriculum by &lt;login1&gt;.*

# Check-in app

## Description

A web app for sending check-in alerts to a small circle of trusted friends. A user
sends a check-in ("I need a chat", "could someone reach out"), their friends are
notified in real time, can acknowledge, and chat to coordinate.

This is **not an emergency service**. For real emergencies, call 999/112. The app
makes this clear to users and in its Terms of Service.

> **Status: skeleton.** Right now the app only proves the three containers
> (frontend, backend, database) start together and can talk to each other.
> Features are not built yet. See `PROJECT.md` for the full plan.

## Instructions

### Prerequisites

- Docker and Docker Compose installed
- Ports 5173 free on your machine

### Run

1. Copy the environment template and set a password:
   ```
   cp .env.example .env
   # then edit .env and set a real POSTGRES_PASSWORD
   ```
2. Start everything with one command:
   ```
   docker compose up --build
   ```
3. Open the app in Chrome:
   ```
   http://localhost:5173
   ```

If the page shows `"database": "connected"`, all three containers are wired up
correctly.

To stop:
```
docker compose down
```

To stop and also wipe the database volume:
```
docker compose down -v
```

## Technical stack

- Frontend: React + Vite
- Backend: Fastify (Node.js)
- Database: PostgreSQL
- Orchestration: Docker Compose

## Resources

- Fastify documentation
- Vite documentation
- PostgreSQL documentation
- (AI usage will be documented here per the README requirements as the project develops.)
