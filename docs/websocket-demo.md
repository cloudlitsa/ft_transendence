# Demo: real-time alert delivery (WebSockets)

Reproducible walkthrough of the Real-Time WebSockets module — from two empty
accounts to a live alert appearing in a second browser with no refresh.

Run it from a clean database (`TRUNCATE`, see `DEVELOPMENT.md`) or skip to the
part you need. Every step below has been run end to end.

**What this demonstrates for the module:**
authenticated socket handshake · real-time delivery across clients ·
broadcast scoped to accepted friends only (not every connected socket) ·
graceful connect/disconnect · one user, multiple sockets.

---

## 0. Prerequisites

Containers up, database migrated:

```bash
docker compose up --build
docker compose exec backend npx prisma migrate dev
docker compose ps          # four containers, db healthy
```

Keep backend logs visible in a second terminal — you'll see `ws connected`
and `ws disconnected` as sockets open and close:

```bash
docker compose logs -f backend
```

---

## 1. Create two accounts (terminal)

Two separate cookie jars, one per user. `-c` writes the jar, `-b` reads it.

```bash
# user 1
curl -i -c /tmp/me1.txt -X POST http://localhost:5173/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"me1@example.com","password":"mypassword1","displayName":"Me One"}'

# user 2
curl -i -c /tmp/you2.txt -X POST http://localhost:5173/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"you2@example.com","password":"mypassword2","displayName":"You Two"}'
```

If either returns `409 An account with this email already exists`, the account
is already there — log in instead to get a fresh cookie:

```bash
curl -i -c /tmp/me1.txt -X POST http://localhost:5173/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"me1@example.com","password":"mypassword1"}'
```

---

## 2. Make them friends

me1 sends the request:

```bash
curl -i -b /tmp/me1.txt -X POST http://localhost:5173/api/friends/request \
  -H "Content-Type: application/json" \
  -d '{"email":"you2@example.com"}'
```

you2 lists pending requests to get the friendship id:

```bash
curl -s -b /tmp/you2.txt http://localhost:5173/api/friends
```

you2 accepts (paste the id from the previous response):

```bash
curl -i -b /tmp/you2.txt -X POST \
  http://localhost:5173/api/friends/FRIENDSHIP_ID/accept
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

Private window → `http://localhost:5173` → DevTools console.

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
const s = new WebSocket(`ws://${location.host}/api/ws`);
s.onmessage = (e) => console.log("received:", e.data);
s.onclose   = (e) => console.log("closed, code:", e.code);
```

Expected immediately:

```
received: {"type":"connected"}
```

That single line proves the whole chain: browser → Vite proxy (`ws: true`) →
Fastify upgrade → cookie read → JWT verified → user exists in DB → socket
added to the registry → server-initiated message back down the pipe.

The backend log shows `"msg":"ws connected"` with you2's userId.

---

## 4. me1 sends an alert (terminal)

One active alert per user, so close any existing one first:

```bash
# find it
curl -s -b /tmp/me1.txt http://localhost:5173/api/alerts

# close it (paste the id from myAlert)
curl -i -b /tmp/me1.txt -X POST \
  http://localhost:5173/api/alerts/ALERT_ID/close
```

Send:

```bash
curl -i -b /tmp/me1.txt -X POST http://localhost:5173/api/alerts \
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
const s2 = new WebSocket(`ws://${location.host}/api/ws`);
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
const s = new WebSocket(`ws://${location.host}/api/ws`);
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
| Nothing at all, 404 on the upgrade | `ws: true` missing from the `/api` proxy in `vite.config.js` |
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
- `frontend/vite.config.js` — `ws: true` on the `/api` proxy so upgrade
  requests reach Fastify in dev
