# Demo: real-time alert delivery (WebSockets)

Reproducible walkthrough of the Real-Time WebSockets module — from two empty
accounts to a live alert appearing in a second browser with no refresh.

Run it from a clean database (`TRUNCATE`, see `DEVELOPMENT.md`) or skip to the
part you need.

**Last verified:** the URLs and flags were updated for the Caddy reverse proxy
on 24 Aug 2026. Re-run it end to end before the evaluation dry run rather than
trusting that date.

**What this demonstrates for the module:**
authenticated socket handshake · real-time delivery across clients ·
broadcast scoped to accepted friends only (not every connected socket) ·
graceful connect/disconnect · one user, multiple sockets.

---

## 0. Prerequisites

Containers up, database migrated:

```bash
docker compose up --build
docker compose exec backend npx prisma migrate deploy
docker compose ps          # five services up, db healthy
```

Five services: `proxy` (Caddy), `db`, `backend`, `frontend`, `mailhog`.

`migrate deploy` applies existing migrations and nothing else. `migrate dev`
is the authoring command — it can prompt, and on a drifted schema it offers to
reset the database. Use `deploy` for anything you just want running.

Keep backend logs visible in a second terminal — you'll see `ws connected`
and `ws disconnected` as sockets open and close:

```bash
docker compose logs -f backend
```

---

## 1. Create two accounts (terminal)

Two separate cookie jars, one per user. `-c` writes the jar, `-b` reads it.

**Note the URL and the flags.** Everything goes through Caddy on
`https://localhost` — the frontend's old `5173` mapping was removed when the
reverse proxy landed, so anything pointing at that port now fails with a
connection error. `-k` tells curl to accept the mkcert development
certificate, which it otherwise refuses because it isn't in the system trust
store. Plain `http://localhost` returns a `301` to the https URL and curl
won't follow it without `-L`, so a login through it silently writes no cookie
and every later request 401s.

```bash
# user 1
curl -ik -c /tmp/me1.txt -X POST https://localhost/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"me1@example.com","password":"mypassword1","displayName":"Me One"}'

# user 2
curl -ik -c /tmp/you2.txt -X POST https://localhost/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"you2@example.com","password":"mypassword2","displayName":"You Two"}'
```

If either returns `409 An account with this email already exists`, the account
is already there — log in instead to get a fresh cookie:

```bash
curl -ik -c /tmp/me1.txt -X POST https://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"me1@example.com","password":"mypassword1"}'
```

---

## 2. Make them friends

me1 sends the request:

```bash
curl -ik -b /tmp/me1.txt -X POST https://localhost/api/friends/request \
  -H "Content-Type: application/json" \
  -d '{"email":"you2@example.com"}'
```

you2 lists pending requests to get the friendship id:

```bash
curl -sk -b /tmp/you2.txt https://localhost/api/friends
```

you2 accepts (paste the id from the previous response):

```bash
curl -ik -b /tmp/you2.txt -X POST \
  https://localhost/api/friends/FRIENDSHIP_ID/accept
```

**Verify the friendship is accepted** — friendships are UUID pairs, so this
query translates them to emails:

```bash
docker compose exec db psql -U checkin -d checkin -c "
SELECT a.email AS user_a, b.email AS user_b, f.status
FROM friendships f
JOIN users a ON a.id = f.user_id_a
JOIN users b ON b.id = f.user_id_b;"
```

Expected:

```
      user_a       |     user_b      |  status
-------------------+-----------------+----------
 you2@example.com  | me1@example.com | accepted
```

The broadcast only reaches **accepted** friends. If this row says `pending`,
nothing will arrive and the module will look broken when it isn't.

---

## 3. Open you2's socket (browser)

Private window → `https://localhost` → DevTools console.

Firefox will warn about the mkcert certificate the first time; accept it. The
warning is expected — the certificate is locally generated and trusted by your
system but not by the browser's own store until you allow it.

A private window has its own cookie store, so you2 can be logged in here while
me1 is logged in elsewhere.

**Log in.** `credentials: "include"` matters — without it the cookie isn't
stored:

```js
await fetch("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "you2@example.com", password: "mypassword2" }),
  credentials: "include",
});
```

**Confirm the session:**

```js
await (await fetch("/api/auth/me", { credentials: "include" })).json();
// → { user: { id: "...", email: "you2@example.com", displayName: "You Two" } }
```

**Open the socket and leave it listening:**

```js
const s = new WebSocket(`wss://${location.host}/api/ws`);
s.onmessage = (e) => console.log("received:", e.data);
s.onclose   = (e) => console.log("closed, code:", e.code);
```

Expected immediately:

```
received: {"type":"connected"}
```

**`wss://`, not `ws://`.** The page is served over HTTPS, and a browser blocks
a plaintext WebSocket opened from a secure page as mixed content — it fails
before any request is made, which looks like a broken server and isn't.

That single line proves the whole chain: browser → Caddy (TLS terminated,
upgrade forwarded) → Fastify upgrade → cookie read → JWT verified → user
exists in DB → socket added to the registry → server-initiated message back
down the pipe.

The cookie travels because it's `Secure` and the connection is TLS; the same
handshake over plain `ws://` would not carry it even if the browser allowed
the connection.

The backend log shows `"msg":"ws connected"` with you2's userId.

---

## 4. me1 sends an alert (terminal)

One active alert per user, so close any existing one first:

```bash
# find it
curl -sk -b /tmp/me1.txt https://localhost/api/alerts

# close it (paste the id from myAlert)
curl -ik -b /tmp/me1.txt -X POST \
  https://localhost/api/alerts/ALERT_ID/close
```

Send:

```bash
curl -ik -b /tmp/me1.txt -X POST https://localhost/api/alerts \
  -H "Content-Type: application/json" \
  -d '{"alertType":"need_chat","note":"testing broadcast"}'
```

**you2's console prints the alert instantly, with no refresh:**

```
received: {"type":"alert:new","alert":{"id":"...","alertType":"need_chat",
"note":"testing broadcast","status":"active","createdAt":"...",
"sender":{"id":"...","displayName":"Me One","avatarUrl":null}}}
```

The payload carries the alert data rather than a "something changed, refetch"
signal — a distress alert should appear immediately, and a refetch would add a
round trip at exactly the moment latency matters. It deliberately matches an
entry in `GET /api/alerts`'s `friendsAlerts`, so the UI renders it with the
same component either way.

---

## 5. Prove the scoping (the interesting part)

The broadcast goes to a **named list of user IDs**, not every connected
socket. To show that:

Open a **third** browser profile, sign up a user who is *not* a friend of
me1, log them in and open a socket the same way. Send another alert from me1
(closing the current one first). The non-friend's console stays silent; you2's
receives it.

Same trust boundary as `GET /api/alerts`, enforced by the shared
`getFriendIds()` helper in `lib/friendships.ts` so the two paths can't drift
apart.

---

## 6. Prove multi-socket and graceful disconnect

**One user, several sockets** — in you2's console:

```js
const s2 = new WebSocket(`wss://${location.host}/api/ws`);
s2.onmessage = (e) => console.log("second socket:", e.data);
```

Both print `{"type":"connected"}`, and both receive the next alert. The
registry is `Map<userId, Set<WebSocket>>` — a `Set`, not a single socket,
because one user can be on two tabs, a laptop and a phone. Storing one socket
per user would silently orphan the first: still open, never receiving
anything.

**Disconnect cleanly:**

```js
s2.close();
s2.readyState   // 3 = CLOSED
s.readyState    // 1 = OPEN — the other socket is unaffected
```

The backend log shows `"msg":"ws disconnected"`. The close handler clears the
heartbeat interval and removes only that socket from the Set; you2 stays
online because `s` is still open. When the last socket closes, the empty Set
is deleted so the Map only ever contains online users — which is what makes
presence a lookup rather than separate bookkeeping.

**Dead connections** are caught by a 30-second heartbeat: the server pings,
the browser pongs automatically at protocol level, and a socket that hasn't
ponged by the next sweep is terminated. Without it, a closed laptop lid leaves
a dead socket in the registry and the user appears online forever.

---

## 7. Prove the socket is actually guarded

New private window, **do not log in**, then:

```js
const s = new WebSocket(`wss://${location.host}/api/ws`);
s.onclose = (e) => console.log("closed, code:", e.code);
```

The connection fails or closes immediately — no `{"type":"connected"}`.

Authentication happens in a `preValidation` hook, *before* the upgrade
completes, so an unauthenticated client never gets a socket at all. It reuses
the same cookie/JWT verification as every guarded route, including the
"does this user still exist" check, so a GDPR-deleted account can't hold a
live connection.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| `401 Not logged in` from curl | Reading a cookie jar you never wrote to — check `-c` vs `-b` and the filename |
| Socket connects, no alert arrives | Friendship isn't `accepted` — run the psql check in step 2 |
| Nothing at all, 404 on the upgrade | Caddy isn't forwarding the upgrade — check the `/api` route in the `Caddyfile` |
| Connection fails instantly, mixed-content error | You used `ws://` on an HTTPS page — use `wss://` |
| `curl: (60) SSL certificate problem` | Missing `-k`; curl doesn't trust the mkcert certificate |
| `301 Moved Permanently`, then everything 401s | You used `http://`; the login redirect wasn't followed, so no cookie was written |
| Sockets vanish for no reason | Saving a backend file restarts tsx, dropping every connection |
| `SyntaxError: redeclaration of let s` | Firefox's console re-runs the whole block — use a fresh variable name |
| Every request 401s at once | Sessions last 7 days; the token expired. Log in again |

---

## Files involved

- `backend/src/routes/ws.ts` — the `/api/ws` endpoint: authenticated upgrade,
  heartbeat, close/error handling
- `backend/src/lib/wsRegistry.ts` — connection registry and
  `broadcastToUsers()`
- `backend/src/routes/alerts.ts` — broadcasts on alert create
- `backend/src/lib/friendships.ts` — `getFriendIds()`, shared by the GET
  endpoint and the broadcast
- `Caddyfile` — routes `/api/*` to the backend and terminates TLS; the
  WebSocket upgrade is forwarded through it

> **Check this against your `Caddyfile` before relying on it at evaluation.**
> Traffic now enters through Caddy rather than Vite, but whether `/api/ws`
> reaches Fastify directly or via the frontend container depends on how the
> routes are written. Open the `Caddyfile`, confirm which it is, and correct
> the chain described in step 3 if needed. Being able to trace the request
> path out loud is the part an evaluator will actually ask about.