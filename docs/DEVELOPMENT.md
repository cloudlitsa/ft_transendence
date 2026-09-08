# Development notes

How to work on this project day to day. `README.md` covers getting it running
the first time, `CONTRIBUTING.md` covers branches and PRs, and `DECISIONS.md`
covers *why* things are built the way they are.

This file is the practical stuff — the things you only find out by hitting
them. **If you hit something that isn't here, add it.** That's the point.

**Contents:** [Docker](#docker-and-dependencies) ·
[Database](#database-and-migrations) · [curl](#testing-endpoints-with-curl) ·
[Browser](#testing-in-the-browser) · [WebSockets](#websockets) ·
[Backend](#writing-a-backend-endpoint) · [Frontend](#writing-frontend-ui) ·
[Reading errors](#reading-errors) · [Git](#git)

---

## Docker and dependencies

The backend's `node_modules` is a **named Docker volume**, not a bind mount.
The container's `node_modules` and the one on your laptop are two separate
directories that never sync. Most confusing setup problems come from this.

**After pulling a branch that adds a dependency:**

```
docker compose exec backend npm install
```

`docker compose up --build` alone will *not* pick it up — the named volume
survives the rebuild. Same for the frontend; swap `backend` for `frontend`.

**If your editor shows type errors for a package that clearly exists:**

```
cd backend && npm install
```

Your editor's TypeScript server reads `node_modules` from your laptop, not
the container. The host copy exists purely so the editor can find type
declarations. `Cannot find module '@fastify/websocket'` followed by a cascade
of unrelated-looking errors (properties not existing on `FastifyRequest`,
etc.) is almost always this — missing types make TypeScript fall back to the
wrong overload, so one missing package produces a dozen misleading errors.

If squiggles persist after a fresh install, check in this order before
suspecting a version conflict:

1. Is the laptop's `node_modules` actually current with `package.json`?
2. Restart the TS server (Cmd+Shift+P → "TypeScript: Restart TS Server") —
   catches a language server that cached a stale picture. Cheap; try it.
3. *Only then* suspect a real mismatch between a package and its `@types/*`.

### `up` vs `up --build`

`up` reuses the existing image. `--build` rebuilds it from the Dockerfile and
`package.json` first.

Source-only changes (`.ts`, `.tsx`) → plain `up` is fine, it's live-mounted.
Changes to `package.json`, `package-lock.json` or a `Dockerfile` → `--build`,
or the container keeps yesterday's dependencies and either crashes
(`sh: <tool>: not found`) or silently ignores the change.

**After a *major* version bump, `--build` alone isn't always enough.** The
named `node_modules` volume survives a rebuild, so the old volume can get
mounted over the new image's `node_modules` and Vite serves stale cached
files. Symptom: audit clean, build succeeds, containers `Up`, but the browser
is blank with "Loading failed for the module" errors referencing
`.vite/deps/`.

Fix: `docker compose down -v` before `up --build`. Only needed after a major
bump on something Vite pre-bundles (react, react-dom); routine
`npm install <pkg>` doesn't need it. **`down -v` also wipes the database** —
see [Resetting data](#resetting-data) for the non-destructive option.

### Permissions in the containers

Both Dockerfiles run as `node`, not `root` (see `DECISIONS.md` for why).

**Vite's dep cache needs write access at runtime.** Vite writes to
`node_modules/.vite/deps/` when it first optimizes dependencies. If that
directory is root-owned, you get a blank page with no backend error — only
"Loading failed for the module ... `.vite/deps`" in the browser and
`EACCES: permission denied, mkdir '.../.vite/deps_temp_...'` in
`docker compose logs frontend`.

The fix is already in both Dockerfiles: `RUN chown -R node:node /app`
**between** `COPY . .` and `USER node`. If a Dockerfile is ever rewritten,
that line must be there or the container starts fine and the app silently
doesn't work.

**If a one-off command fails with `EACCES` inside `node_modules`**, rerun it
as root:

```
docker compose run --rm --user root backend npm install <package>
```

The error names `EACCES` on a `rename` or `mkdir` without mentioning the
user, which reads like a corrupted install rather than a permissions problem.

**The uploads volume has the same trap, with a twist.** Docker creates a named
volume's mount point as `root` if the path doesn't already exist in the image.
`/app/uploads` didn't, so on a fresh volume the directory was root-owned while
the process ran as `node` — and avatar uploads failed with *nothing* in the
backend logs and nothing in the network tab. Just an empty directory and a
`NULL` `avatar_url`. The backend Dockerfile now creates it explicitly, before
`USER node`:

```
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
```

Note that `--user root` on a one-off `exec` is **not** the fix here. It
repairs the running container and leaves the image alone, so the next person
to clone the repo hits exactly the same thing. If you find yourself reaching
for `--user root` on a directory the app writes to *at runtime*, the
Dockerfile is what needs changing.

### Logs

```
docker compose logs -f backend
```

Name the container. Plain `docker compose logs -f` includes Mailhog, which
prints a `KEEPALIVE` line every few seconds whenever its web UI
(`localhost:8025`) is open in a tab — harmless, but it drowns everything else.

---

## Database and migrations

**After pulling a branch that adds a migration:**

```
docker compose exec backend npx prisma migrate deploy
```
`deploy` applies migrations already in the repo and never resets. `migrate dev`
is for *creating* one after you've changed `schema.prisma`, and will offer to
reset if it detects drift. `npx prisma migrate status` is read-only if you just
want to look.

**If the migration adds or changes a model, also run:**

```
docker compose exec backend npx prisma generate
```

`migrate deploy` updates the database. Only `generate` updates the typed
client. They are separate steps, and pulling a branch needs both.

The Dockerfile does run `npx prisma generate` at build time — but
`node_modules` is a named volume that mounts over the image, so an existing
volume keeps serving a client that predates the new model. Rebuilding doesn't
help, for the same reason a rebuild doesn't pick up a new npm package.

Symptom: the app 500s, and `docker compose logs backend` says
`Unknown field 'attachments' for select statement on model 'Message'`.
`docker compose exec backend npx tsc --noEmit` says
`Property 'attachment' does not exist on type 'PrismaClient'`.

For your editor, run `cd backend && npx prisma generate` on the host too, then
restart the TS server. Host and container have separate `node_modules` —
editor clean and app broken, or the reverse, means you fixed one and not the
other.

### Writing a raw SQL migration

Prisma's schema language can't express everything — partial (filtered) unique
indexes, for example. Create an empty migration and write the SQL by hand:

```
docker compose exec backend npx prisma migrate dev --create-only --name your_migration_name
```

Edit the generated `migration.sql`, then apply with
`docker compose exec backend npx prisma migrate dev`.

Three things that will bite you:

1. **Use the real table and column names, not the Prisma model names.** The
   schema maps models to snake_case tables — the model is `Alert`, the table
   is `alerts`, `senderId` is `sender_id`. Raw SQL bypasses that mapping
   entirely. Check `prisma/migrations/*_init/migration.sql` for the actual
   names. Getting it wrong gives
   `P3006 ... P1014: The underlying table for model 'X' does not exist`.

2. **SQL comments are `--`, not `//`.** A JS-style comment gives
   `syntax error at or near "//"`.

3. **The shadow database replays your whole migration history from scratch.**
   That's why a migration referencing a non-existent table fails even though
   the table exists in your dev database. It's a feature: it stops you
   committing a migration that can't rebuild the schema from zero on a
   teammate's fresh clone.

If a migration fails because existing rows violate the new constraint, clean
those rows up first. That's the constraint working, not a bug.

An index Prisma can't express won't appear in `schema.prisma` — leave a
comment on the model saying it exists and which migration created it, or the
next person comparing schema against database will think it's cruft.

### Looking at the data

```
docker compose exec db psql -U checkin -d checkin -c "SELECT email FROM users;"
docker compose exec db psql -U checkin -d checkin          # interactive
```

Inside psql: `\dt` list tables · `\d users` describe one · `\x` toggle
expanded rows (much easier with UUID-heavy tables) · `\q` quit.

Friendships are UUID pairs and unreadable at a glance. This translates them:

```sql
SELECT a.email AS user_a, b.email AS user_b, r.email AS requested_by, f.status
FROM friendships f
JOIN users a ON a.id = f.user_id_a
JOIN users b ON b.id = f.user_id_b
JOIN users r ON r.id = f.requested_by;
```

### Resetting data

Empty the tables but keep the schema and migration history:

```
docker compose exec db psql -U checkin -d checkin \
  -c "TRUNCATE users, friendships, alerts, acknowledgements, messages CASCADE;"
```

Prefer this over `docker compose down -v`, which destroys the volume too.
Plain `down` keeps your data.

---

## Testing endpoints with curl

Guarded routes read a JWT from an httpOnly cookie, so you need a cookie jar.
Note the two flags:

- `-c FILE` — **c**reate/write the jar (login/signup)
- `-b FILE` — **b**rowse/read the jar (every guarded request)

Reading from a jar you never wrote to gives `401 Not logged in`, which looks
like an auth bug and isn't.

**Use `https://localhost`, not a port.** Since Caddy landed, the proxy is the
only way in — the frontend's old `5173` mapping was removed, so anything
pointing at it now fails with a connection error rather than an HTTP one. The
`-k` flag tells curl to accept the mkcert development certificate, which it
otherwise refuses because it isn't in the system trust store. Without `-k` you
get `SSL certificate problem: unable to get local issuer certificate`.

Plain `http://localhost` also works but returns `301 Moved Permanently` to the
https URL, and curl doesn't follow redirects unless you pass `-L` — so a
login through it silently writes no cookie and every later request 401s.

```
# log in and save the cookie
curl -ik -c /tmp/me1.txt -X POST https://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"me1@example.com","password":"mypassword1"}'

# use it
curl -ik -b /tmp/me1.txt https://localhost/api/alerts

# status code only — useful for checking 201 vs 409 vs 404
curl -sk -o /dev/null -w "%{http_code}\n" -b /tmp/me1.txt \
  -X POST https://localhost/api/alerts \
  -H "Content-Type: application/json" -d '{"alertType":"need_chat"}'
```

**Sessions last 7 days.** If every request suddenly 401s across all your
jars, the tokens expired — log in again rather than debugging the auth code.

**Two users at once.** Anything involving friends, alerts or acknowledgements
needs two accounts. Use two jars (`/tmp/me1.txt`, `/tmp/me2.txt`), one per
user. Mixing them up is the most common source of confusing 403s and 404s.

**Testing concurrency.** Backgrounding with `&` then `wait` fires requests in
parallel, which catches races that sequential testing misses:

```
for i in 1 2 3 4 5; do
  curl -sk -o /dev/null -w "%{http_code}\n" -b /tmp/me1.txt \
    -X POST https://localhost/api/alerts \
    -H "Content-Type: application/json" -d '{"alertType":"need_chat"}' &
done; wait
```

---

## Testing in the browser

The signup and login forms exist now, so the quickest route to a session is
just to use them. The console method below is still useful for driving a
second account in a private window, or for testing a request in isolation.

Get a session from the DevTools
console. `credentials: "include"` matters — without it the cookie isn't
stored.

```js
await fetch("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "me1@example.com", password: "mypassword1" }),
  credentials: "include",
});

await (await fetch("/api/auth/me", { credentials: "include" })).json();
```

For a **second user simultaneously**, use a private window — separate cookie
store, so you can drive two accounts side by side.

**Firefox's multi-line console editor re-runs the whole block.** Declare
`const s = ...`, run the block twice, and you get
`SyntaxError: redeclaration of let s` — and *nothing* executes, because it
fails at parse time. Select just the lines you want, or use fresh names.

### Service workers serve stale code

The PWA registers a service worker that outlives the tab, so it can hand you
an old version of the app long after you changed the code. If something looks
impossibly out of date: Chrome DevTools → **Application** → **Service
Workers** →

- **Bypass for network** — ignore the SW. If the problem vanishes, it was the SW.
- **Update on reload** — forces a fresh SW every reload while you work.
- **Unregister** — removes it (re-registers on next load in dev; expected).

`frontend/dev-dist/` showing as untracked is the dev-mode SW output. It's
gitignored; leave it.

---

## WebSockets

```js
const s = new WebSocket(`ws://${location.host}/api/ws`);
s.onmessage = (e) => console.log("received:", e.data);
s.onclose   = (e) => console.log("closed, code:", e.code);
```

A successful connection replies `{"type":"connected"}`.

**Never hardcode `ws://` in application code** — derive it, so the client
upgrades itself when HTTPS lands:

```js
const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const socket = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
```

**Is a socket still open?** `s.readyState` — `1` OPEN, `3` CLOSED. More
reliable than the Network tab, which can't tell you which JS variable owns
which connection.

**Seeing connections:** Network tab → **WS** filter. Sockets show as
`101 Switching Protocols`; click one for every frame in both directions. Two
caveats: sockets opened before DevTools won't appear, and one entry is always
Vite's own HMR socket (recognisable by `?token=...` in its path).

**Vite must be told to proxy WebSocket upgrades** — `ws: true` on the `/api`
proxy entry in `frontend/vite.config.js`. Without it the upgrade never
reaches Fastify and you get a 404 that looks like a missing route.

**Saving a file restarts the backend**, dropping every open socket. If your
sockets vanish for no apparent reason, that's usually why.

---

## Writing a backend endpoint

Copy the shape of `backend/src/routes/friends.ts` or `alerts.ts` — every
route file follows the same skeleton:

```ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth, authedUserId } from "../lib/requireAuth.js";

const bodySchema = z.object({ /* ... */ });

export async function thingRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", requireAuth);   // guards every route below

  fastify.post("/", async (request, reply) => {
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid input" });

    const me = authedUserId(request);           // definite string
    // ... prisma work ...
    return reply.send({ /* ... */ });
  });
}
```

Register it in `src/server.ts`:

```ts
import { thingRoutes } from "./routes/thing.js";
await fastify.register(thingRoutes, { prefix: "/api/thing" });
```

- **Validate everything** with Zod — bodies *and* URL params.
- **Zod validators run in order.** `.max(500).trim()` measures the raw string,
  so a 498-character note with trailing whitespace gets rejected. Write
  `.trim().max(500)` when you mean "500 characters of content".
- **`requireAuth` as a plugin-wide preHandler** when every route in the file
  needs a login; per-route (`{ preHandler: requireAuth }`) when only some do.
- **Always `select`** on Prisma queries, so `passwordHash` can't escape.
- **`.js` extensions on imports**, even though the file is `.ts` — ESM
  convention. TypeScript never rewrites import paths, so the path has to name
  the compiled output.

**`JWT_SECRET` must be set.** The backend throws on startup if it's missing —
deliberately, so a misconfigured deploy fails loudly rather than silently
signing tokens with the string `"undefined"`. Generate one with
`openssl rand -base64 48`.

---

## Writing frontend UI

**Feedback goes through toasts**, not local state:

```ts
import { useToast } from "../components/ToastProvider.tsx";

const toast = useToast();
toast.success("Friend request accepted");   // also .error() and .info()
```

`ToastProvider` wraps the app in `main.tsx`, so `useToast()` works anywhere.
Don't build a per-page `message` state — that's what the notifications module
replaced.

**Refresh after actions.** Every mutation re-fetches from the server rather
than patching local state, so the server stays the single source of truth.

**Vite does not type-check.** Type errors survive dev mode silently. Before
pushing: `cd frontend && npx tsc --noEmit`.

**Accessibility is a subject requirement.** Inputs need a `<label>`, or at
minimum an `aria-label`. A placeholder is not a label — it disappears as soon
as the user types.

**Named vs default imports.** Braces mean "the export with exactly this name";
no braces means "whatever this module calls its default export".

```ts
import BrowserRouter from "react-router-dom";       // wrong
import { BrowserRouter } from "react-router-dom";   // right — named export
```

Getting it backwards produces errors that never mention imports:
`'BrowserRouter' cannot be used as a JSX component` and `does not have any
construct or call signatures`. Read those as "check the import line."

---

## Reading errors

**Two kinds of 404.** Telling them apart is the difference between a
five-second fix and an hour of confusion.

```
{"message":"Route POST:/api/x not found","error":"Not Found","statusCode":404}
```

Fastify's router. The route isn't registered — or, just as often, **the
backend has crashed and is serving nothing**. A crash-looping container still
accepts connections and 404s everything, so it looks exactly like a missing
route. Check `docker compose logs backend --tail 30` before assuming a
routing bug.

```
{"error":"Alert not found"}
```

Our own handler. The route exists and ran; the data doesn't, or isn't yours.

**Unexpected nested folders in `git status`** (`frontend/frontend/`,
`frontend/backend/`) come from a `docker run -v` with a wrong `$PWD` —
Docker silently creates missing host directories rather than erroring, then
the command fails on something downstream that doesn't explain the cause.
Harmless; `rm -rf` them. Prefer `docker compose run` for ad-hoc commands,
since it uses the compose file's already-correct paths.

### Right code, wrong build

Live chat looked broken for hours. The Prisma `select` had `alertId: true`.
The frontend type declared `alertId: string`. Both correct — and the WebSocket
frame simply didn't contain the field. The container was running different code
from the source. `docker compose restart backend` fixed it.

**Read the frame before you read either codebase.** It is the only thing that
tells wrong code from right code in a stale build. If a frame is missing a
field that both sides agree on, stop looking for the bug in the code.

The same failure came back when a container's generated Prisma client went
stale after a new model landed — see
[Database and migrations](#database-and-migrations). Different cause, identical
shape: source right, running process wrong.

**Diagnose in this order:** backend logs, then `tsc --noEmit` *inside the
container*, then the editor. The editor is the least reliable of the three —
it reads the host's `node_modules` and is one build behind by design.

---

## Git

- **Merged PRs don't propagate to your local branches.** Merging on GitHub
  updates GitHub's `main`. `git pull` on main updates your local main — and
  nothing else. Each feature branch still needs its own `git merge main`.
- **Always branch from an up-to-date main**, explicitly:
  `git checkout main && git pull && git checkout -b feature/whatever`.
  Branching from wherever you happen to be standing is how a branch ends up
  carrying someone else's unmerged commits.
- **Sync before opening a PR** so the reviewer sees what will actually land:
  `git checkout main && git pull && git checkout your-branch && git merge main`
- **Squash-merge orphans your branch's commits.** Git can't see them as
  merged, so `git branch -d` may refuse to delete a branch that genuinely is.
  `-D` is safe once you've confirmed via the PR — not via git's reachability
  check.
- **`git status` before every commit**, and verify before declaring anything
  done: curl the endpoint, click through in the browser, `docker compose ps`.