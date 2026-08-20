*This project has been created as part of the 42 curriculum by evmouka.*

# Check-in app

## Description

A web app for sending check-in alerts to a small circle of trusted friends. A user
sends a check-in ("I need a chat", "could someone reach out"), their friends are
notified in real time, can acknowledge, and chat to coordinate.

This is **not an emergency service**. For real emergencies, call 999/112. The app
makes this clear to users and in its Terms of Service.

## Status: in development

Core features taking shape — containerized app served over HTTPS, TypeScript end
to end, PostgreSQL with full schema, authentication, the friends system, and the
alerts backend. See `docs/PROJECT.md` for the full plan.

**Working now:**
- Containerized dev environment (one command to run everything)
- **HTTPS via a Caddy reverse proxy** — the single public entry point
- TypeScript end to end (frontend + backend share types)
- PostgreSQL database with full schema (users, friendships, alerts, acknowledgements, messages)
- Auth: signup, login, logout, session check — hashed passwords, validated input,
  httpOnly + Secure cookie sessions, with working UI forms and a route guard
- Friends system: send/accept/decline requests, list friends, unfriend (backend + UI)
- Alerts backend: send, view, acknowledge, close
- In-app toast notifications, installable PWA with offline support
- **Real-time alert delivery over WebSockets**, verified end to end through the
  reverse proxy
- Custom design system: design tokens (palette + typography) and reusable
  components, built on Tailwind CSS v4

**In review:**
- Alerts UI (send / acknowledge / close check-ins)

**Next:**
- Chat
- Profile page, avatar upload, online status
- Remaining design system components and icons; responsive pass across all pages

## Running it

### Prerequisites

- Docker and Docker Compose installed
- [mkcert](https://github.com/FiloSottile/mkcert) installed — on macOS:
  `brew install mkcert nss` (`nss` lets mkcert write to Firefox's trust store too)
- Ports 80 and 443 free

### Setup

1. Copy the environment template:
   ```
   cp .env.example .env
   ```

2. Edit `.env` and set values. You MUST set:
   - `POSTGRES_PASSWORD` — any strong password
   - `JWT_SECRET` — generate one with: `openssl rand -base64 48`

   The backend will refuse to start if `JWT_SECRET` is missing — this is deliberate.

3. Generate a local TLS certificate. Everything reaches the app through an HTTPS
   reverse proxy, so this is required before the containers will start:
   ```
   mkcert -install
   mkdir -p certs && cd certs
   mkcert localhost 127.0.0.1 ::1
   cd ..
   ```
   `mkcert -install` adds a local certificate authority to your system trust
   store (and Firefox's, if `nss` is installed), so the browser shows a normal
   padlock rather than a warning. The generated certificate and key live in
   `certs/`, which is **gitignored** — each machine generates its own, and a
   private key must never enter the repository.

4. Start everything with one command:
   ```
   docker compose up --build
   ```

5. Create the database tables:
   ```
   docker compose exec backend npx prisma migrate dev
   ```
   The database starts empty. Until you run this, the app will start but
   every request that touches the database will fail.

6. Open the app: **https://localhost**

   Plain HTTP is redirected to HTTPS. No container other than the proxy publishes
   a port, so there is no unencrypted route into the app.

7. *(Optional, for editor support)* Install dependencies on the host too:
   ```
   cd frontend && npm install && cd ../backend && npm install && cd ..
   ```
   The containers have their own `node_modules`, so the app runs fine without
   this. But your editor's TypeScript server runs on the *host*, and without
   local packages it reports dozens of phantom errors ("Cannot find module
   'react'"). Nothing is broken — the editor just can't see the dependencies.

To stop: `docker compose down`

> **⚠️ `docker compose down -v` destroys the database.** The `-v` flag removes
> named volumes, and `db_data` is one of them — every user, friendship, alert
> and message is deleted, with no undo. Use plain `docker compose down` to stop.
> Only use `-v` when you deliberately want a blank database. To reset a single
> service's dependencies instead, see *Troubleshooting* below.

### After pulling someone else's branch

- **New backend dependency** → `docker compose exec backend npm install`,
  then `docker compose restart backend`
- **New frontend dependency** → `docker compose exec frontend npm install`,
  then `docker compose restart frontend`

  A rebuild alone won't pick either of these up. `node_modules` is mounted as a
  volume that shadows the host directory, so git can't touch it and even
  `docker compose build --no-cache` doesn't refresh it. The restart matters
  separately: config files like `vite.config.js` are read once at startup.

- **New migration** → `docker compose exec backend npx prisma migrate deploy`

  Use `deploy` to apply migrations already in the repo (for example after pulling a
  branch). It only applies pending migrations and never resets. `migrate dev` is
  for *creating* a migration after you've changed `schema.prisma` (and can also be
  used on a fresh local database), but if it detects drift it will offer to reset.
  Check first with `docker compose exec backend npx prisma migrate status` — that's read-only.

- **Editor showing phantom type errors** → `cd frontend && npm install` (and/or
  `cd backend && npm install`). The container and your host have separate
  `node_modules`. Also try **TypeScript: Restart TS Server** from the command
  palette — the language server caches file paths and can report errors you've
  already fixed.

- **First time on this branch** → generate certificates (step 3 above); Caddy
  won't start without them

### Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Could not resolve '<package>'` | Stale `node_modules` volume | `docker compose exec <service> npm install`, then `restart` |
| Service stuck `Restarting` | Crash loop | `docker compose logs --tail=50 <service>` |
| Page renders but the build is broken | Browser is serving cached assets | Check log **timestamps**; hard-reload (Cmd+Shift+R) |
| Config change had no effect | Config read once at startup | `docker compose restart <service>` |
| Type error only in the production build | The Vite dev server does not type-check | `docker compose exec frontend npx tsc --noEmit` |
| Caddy won't start | Missing or misnamed certificates | Re-run step 3; check the paths in `Caddyfile` |
| `container name "/checkin_x" is already in use` | Another copy of this project is running | `docker compose down` in the other copy first — see note below |
| Emails not arriving | Dev mail goes to Mailhog | Open `localhost:8025`, not a real inbox |

**Only one copy of this project can run at a time.** Container names are fixed
in `docker-compose.yml` (`checkin_proxy`, `checkin_db`, and so on), and Docker
requires those to be unique across the whole machine — not just within a
project. So a second clone will fail to start while the first is up.

When stopping, run `docker compose down` from the directory the containers were
*started* from: Compose works out which project you mean from the current
directory, so running it elsewhere may not recognise them. `docker ps` is the
only reliable way to see what is actually running.

**Logs are cumulative.** An error scrolling past is not necessarily happening
now. Always check the timestamp before debugging it:

```
docker compose logs --tail=100 --timestamps frontend
```

**Before committing frontend changes**, run the type check. The Vite dev server
strips types without checking them, so a type error can sit invisible in the
browser until the production build fails:

```
docker compose exec frontend npx tsc --noEmit
```

## Tech stack

- **Frontend:** React + TypeScript + Vite, react-router-dom
- **Backend:** Fastify + TypeScript
- **Database:** PostgreSQL with Prisma ORM
- **Auth:** bcryptjs password hashing, JWT in httpOnly + Secure cookies, Zod input validation
- **Proxy:** Caddy (TLS termination, routing, HTTP→HTTPS redirect)
- **Orchestration:** Docker Compose (proxy, frontend, backend, database, mailhog containers)

## Mandatory requirements

### HTTPS

**What it is.** Every connection reaching the app from a browser, script or
external API is encrypted. Connections *inside* the backend (proxy↔frontend,
proxy↔backend, backend↔database) stay unencrypted on the internal Docker
network, which the subject permits.

**How it's implemented.**
- **`Caddyfile`** — one site block for `localhost`. `handle /api/*` forwards to
  `backend:3000`; a catch-all `handle` forwards everything else to
  `frontend:5173`. Order matters: the catch-all would otherwise swallow API
  calls too. A second block redirects `http://localhost` to HTTPS, so plain HTTP
  doesn't simply fail to connect.
- **`docker-compose.yml`** — the `proxy` service is the only one that publishes
  ports (80 and 443). The frontend's old `5173:5173` mapping was **removed**, so
  the requirement is satisfied structurally: there is no unencrypted way in,
  rather than an encrypted way that happens to be preferred.
- **Certificates** are generated per machine with mkcert into a gitignored
  `certs/` directory and mounted read-only into the proxy container.
- **WebSocket upgrades** — both the app's `/api/ws` socket and Vite's hot-reload
  socket pass through the proxy. Caddy forwards `Upgrade` / `Connection` headers
  transparently, so no additional configuration was needed.
- **Secure cookie** — the auth cookie is marked `Secure`, so the browser will
  only ever send it over HTTPS. It defaults to on; `ALLOW_INSECURE_COOKIE=true`
  opts out for an environment running without the proxy. The default is the safe
  one, so a missing or mistyped variable leaves the cookie secure.

**How to verify.**
1. Open `https://localhost` — padlock in the address bar, no certificate warning.
   Clicking it shows "Verified by: mkcert development CA".
2. `http://localhost` redirects to `https://localhost`.
3. `http://localhost:5173` fails to connect — that port no longer exists.
4. DevTools → Storage → Cookies → `auth_token` shows `Secure: true` and
   `HttpOnly: true`.
5. Backend logs show requests arriving from the proxy, never from a browser
   directly.

## Modules

The project targets 14 points (Major = 2 pts, Minor = 1 pt).

**Completed: 8 / 14** — Framework (Major, 2) · Real-time WebSockets (Major, 2) ·
ORM (Minor, 1) · PWA (Minor, 1) · Notifications (Minor, 1) · GDPR (Minor, 1)

**In progress: 6 pts** — Standard User Management (Major, 2) ·
User Interaction (Major, 2) · OAuth (Minor, 1) · Custom design system (Minor, 1)

> **Keep this tally current.** It is the first thing an evaluator reads to know
> what the project claims. A module counts as complete only when it is merged
> to `main`, verified end to end, and documented in a section below. Move
> entries between the two lists as they land — an out-of-date tally either
> undersells finished work or claims work that isn't there.

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
   (`curl -c cookies.txt -X POST https://localhost/api/auth/signup -H 'Content-Type:
   application/json' -d '{"email":"t@x.com","password":"secret123","displayName":"T"}'`).
   The mkcert CA is in the system trust store, so curl accepts the certificate
   without `-k`.
2. **Export** — `curl -b cookies.txt https://localhost/api/account/export` returns
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
(no GDPR-specific logic), so other modules can reuse it. The frontend
"Download my data" button and "Delete account" dialog are a follow-up.

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

### Real-time WebSockets — Web · Major · 2 pts

**What it is.** Alerts reach friends the moment they are sent, over a persistent
WebSocket connection rather than polling. For a check-in app this is the core of
the product: a check-in that arrives two minutes late has largely missed its
purpose, and the sender needs to see that someone has picked it up.

**How it's implemented.**

- **Server** — `@fastify/websocket` registered in `backend/src/routes/ws.ts`,
  exposing `/api/ws`. The connection is authenticated from the same httpOnly
  JWT cookie used for HTTP requests, so there is no second auth mechanism and no
  token in a query string (which would leak into logs and browser history).

- **Connection registry** (`backend/src/lib/wsRegistry.ts`) — maps user id to
  live sockets so the server can push to a specific user. A user may have
  several sockets open (multiple tabs or devices), so the registry holds a set
  per user rather than a single connection, and removes sockets on close.

- **Events** — `alert:new` is pushed to the sender's friends when a check-in is
  created; `alert:ack` is pushed **only to the original sender** when a friend
  acknowledges. Acknowledgement is deliberately narrow: the sender needs to know
  someone responded, but other friends do not need to be told who answered.

- **Duplicate acknowledgements** return early via the unique-constraint path
  (Prisma `P2002`) rather than inserting twice, so a double-click cannot produce
  two acknowledgements or two socket events.

- **Broadcasts are isolated from the database write.** The socket push sits in
  its own `try/catch`, separate from the transaction. A socket failure must
  never turn a successfully committed acknowledgement into a 500 — the data is
  correct either way, and the client reconciles on next fetch. This was verified
  by deliberately throwing inside the broadcast block and confirming the ack
  still committed and still returned 200.

- **Client** (`frontend/src/lib/`) — a socket hook feeds an `AlertsContext`, so
  incoming events update React state immutably (`[newAlert, ...current]`, never
  `push`) and every subscribed component re-renders. The provider is mounted in
  `main.tsx` rather than `App.tsx`, because a component cannot consume a context
  its own render provides.

- **Effect dependencies use primitives, not objects** (`user?.id`, not `user`),
  and the toast API is held in a `useRef`. Without both, the effect re-runs on
  every render and tears down and rebuilds the socket continuously.

- **Through the proxy** — the socket runs over `wss://` through Caddy, which
  forwards `Upgrade` and `Connection` headers transparently. No extra proxy
  configuration was needed, but this was verified explicitly rather than
  assumed: the app is only reachable through the proxy, so a socket that works
  directly against the backend but not through Caddy would be broken in
  practice.

**How to verify.**
1. Log in as two friends in two different browsers (or a normal and a private
   window — separate cookie jars are required).
2. DevTools → Network → **WS** → confirm a `wss://localhost/api/ws` connection
   with status 101 (Switching Protocols). The `wss` scheme confirms it is going
   through the proxy, not around it.
3. Send a check-in from user A → it appears in user B's list **without a page
   reload**, and a toast fires.
4. Acknowledge from user B → user A sees the acknowledgement appear live.
   User C, also a friend, does **not** receive the `alert:ack` event.
5. Click acknowledge twice quickly → only one acknowledgement is recorded.
6. Stop the backend container while the page is open → the client handles the
   dropped connection without crashing; restart it and confirm recovery.

**Contributor.** evmouka

### Custom design system — Web · Minor · 1 pt

> **Status: in progress.** Tokens, typography and 4 of the required 10+
> components are merged. Remaining components and icons are tracked as TRAN-60.

**What it is.** A custom design system — a defined colour palette, typography,
icons, and a library of reusable components — rather than styling each page ad
hoc. For this app it matters because the interface must stay legible and
predictable in the moment a user actually needs it, and because consistency is
enforced structurally rather than by remembering to be consistent.

**How it's implemented.**

- **Design tokens** (`frontend/src/index.css`) — the palette and typography are
  defined as Tailwind CSS v4 `@theme` custom properties. Each token generates
  its whole utility family (`bg-`, `text-`, `border-`, `ring-`), so one
  definition drives every use.

- **The palette is semantic, not decorative.** `alert` (amber) is the check-in
  action; `danger` (red) is reserved exclusively for destructive actions and
  errors. The check-in deliberately avoids emergency-red because the app is
  **not an emergency service** and the interface should not imply otherwise —
  the same position the Terms of Service take. Neutrals are named for their
  role (`ink`, `ink-muted`, `surface`, `surface-sunken`, `line`) rather than
  numbered, so changing one variable restyles every border in the app.

- **Typography** is declared as a `--font-sans` token using a system font
  stack. A webfont would be a network request that fails offline, which works
  against the PWA module; centralising it as a token means a self-hosted face
  can be swapped in later by changing one line.

- **Components** live in `frontend/src/components/ui/`, kept separate from
  feature components (`OfflineBanner`, `ToastProvider`, `RequireAuth`).
  Currently: `Button`, `Spinner`, `Input`, `FormField`.

**Decisions worth noting.**

- Components extend the native element's props (`ButtonHTMLAttributes`,
  `InputHTMLAttributes`), so they accept everything the real element does
  instead of re-declaring props one at a time.
- Variants are a `Record<Variant, string>` lookup, never string interpolation.
  Tailwind scans source text for complete class names, so `bg-${x}-600`
  generates no CSS at all.
- `Button` defaults to `type="button"`. HTML's default is `submit`, which
  causes accidental form submissions; submitting is now explicit.
- `focus-visible` rather than `focus`, so the keyboard focus ring never shows
  on mouse clicks — the usual reason people delete focus styles and lose
  keyboard accessibility with them.
- `Input` generates its own `id` with `useId()` and derives the hint and error
  ids from it, so `htmlFor` and `aria-describedby` are correct by construction.
  It omits `id` from its props type so a caller cannot desynchronise that
  wiring.
- Field-level errors use `aria-describedby`; form-level errors use
  `role="alert"`. Same rule at different scopes — a form-level error (like
  "Invalid email or password", which deliberately does not say *which*, to
  avoid account enumeration) cannot be attributed to a field, so it needs
  `role="alert"` to be announced at all.
- `className` on a component is **additive** (margins, layout), not an
  override. Tailwind resolves conflicts by stylesheet order, not by the order
  of names in the class attribute, so a passed `px-8` would not reliably beat a
  variant's `px-4`. Anything that varies visually is a prop.

**How to verify.**
1. Inspect any button — its classes reference project tokens (`bg-brand-600`,
   `text-ink`), not Tailwind defaults (`bg-blue-600`, `text-gray-900`).
2. **Tab** to a button or field → focus ring appears. **Click** one with the
   mouse → no ring. Keyboard-only focus styling.
3. On `/login`, click the word "Email" → the cursor lands in the field
   (explicit label association).
4. Inspect the two inputs on `/login` → each has a distinct `useId()` value.
5. A `<Button>` inside a `<form>` does not submit unless given `type="submit"`.
6. A disabled or loading button is inert and visibly faded; the loading
   spinner inherits the button's text colour (`currentColor`), so one Spinner
   component works on every variant.

**Scope note.** The module requires 10+ reusable components plus palette,
typography and icons. Four components are merged; the remainder (including an
`Icon` component holding the icon set) are tracked as TRAN-60. Icons are
hand-built SVG rather than an installed library, since the module specifies a
*custom-made* design system.

**Contributor.** evmouka

## Project structure

```
Caddyfile               Reverse proxy config: TLS, routing, HTTP→HTTPS redirect
certs/                  Local TLS certificate and key (gitignored, per machine)
backend/                Fastify + TypeScript API
  prisma/               Database schema and migrations
  src/
    lib/                Shared helpers (auth.ts, requireAuth.ts, mail.ts, wsRegistry.ts)
    routes/             API endpoints (auth.ts, friends.ts, gdpr.ts, alerts.ts, ws.ts)
    prisma.ts           Shared PrismaClient instance
    server.ts           App entry: plugin registration, health check
docs/                   Project documentation
frontend/               React + TypeScript app
  public/               Static assets (favicon, PWA icons, screenshots)
  src/
    components/         Feature components (OfflineBanner, ToastProvider, RequireAuth)
      ui/               Design system components (Button, Spinner, Input, FormField)
    lib/                API client (api.ts), auth context, alert socket hook
    pages/              Route pages (Home, Login, Signup, Friends, Alerts)
    index.css           Design tokens (@theme): palette and typography
    App.tsx             Router and nav
    main.tsx            App entry: providers and root render
docker-compose.yml
```

## Resources

- Fastify, Vite, React, Prisma, PostgreSQL, Caddy documentation
- (AI usage documented per README requirements as the project develops.)