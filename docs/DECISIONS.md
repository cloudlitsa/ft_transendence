# Technical decisions

Why things are built the way they are. `DEVELOPMENT.md` covers *how* to work
on the project; this file covers the reasoning, including the trade-offs we
knowingly accepted.

Two reasons it exists. New contributors shouldn't have to reverse-engineer
intent from code. And at evaluation we're asked to justify our technical
choices and explain the challenges we hit — this is that answer, written down
while it's fresh rather than reconstructed under pressure.

When you make a non-obvious choice, add it here with the alternative you
rejected and why.

---

## Security patterns

### Identical responses, on purpose

"Doesn't exist", "not yours" and "not their friend" all return the same 404.
If they differed, an attacker could send requests with guessed IDs and learn
which resources exist from the *shape* of the failure, without ever seeing
the data.

The same principle drives two other places:

- **Friend requests** return a neutral "if that person has an account,
  they'll receive your request" whether or not the email exists, so the
  endpoint can't be used to check who's registered.
- **Login** returns one error for both "no such user" and "wrong password".

Trade-off: less helpful error messages. Accepted, because the alternative
leaks the membership of a small, private, trust-based friend list.

### Passwords and sessions

Passwords are hashed with **bcryptjs** at cost factor 12 (~250ms per hash —
slow enough to make brute-forcing expensive, fast enough not to hurt real
logins).

Sessions are **JWTs in httpOnly cookies**, not tokens in `localStorage`.
`localStorage` is readable by any JavaScript on the page, so a single XSS bug
hands over every session. An httpOnly cookie can't be read by JavaScript at
all. Cookies are also `secure` and `sameSite=lax`.

Every Prisma query uses `select`, so `passwordHash` can't accidentally end up
in a response — including the GDPR data export.

### `JWT_SECRET` fails fast

The backend throws on startup if `JWT_SECRET` is missing, rather than falling
back to a default. A default would mean a misconfigured deployment silently
signs tokens with a publicly-known key. Better to refuse to boot.

---

## Who can see what

### Chat is a group conversation, not per-friend threads

A `Message` belongs to an alert and has **no recipient field**. Its audience is
everyone who can see the alert: the sender, plus the sender's accepted friends.
Five friends receive a check-in, all five can post, and everyone sees the whole
conversation.

The alternative was per-friend threads — a `recipientId` on `Message`, so the
sender holds a separate private conversation with each friend.

We chose group because someone in a bad moment shouldn't have to repeat
themselves five times, and because friends coordinating between themselves
("I'm nearby, I'll call" / "I've got tonight") is the point of having a trusted
circle rather than a list of individuals.

**The trade-off we accepted:** a friend can't say something privately, and
friends who don't know each other end up sharing a conversation about someone's
state of mind. Anyone wanting a private word uses another channel. For a closed
circle of people who all chose each other that's a reasonable default — but it
is a choice, not an accident of the schema.

### Closing an alert stops acknowledgements, not chat

Once an alert is closed nobody else can acknowledge it, but the conversation
stays open and messages can still be posted.

Status describes the *alert*; the conversation belongs to the *people in it*,
and the useful part often starts after someone says they're alright. There's
nothing extra to build for this — chat access derives from the alert's
audience, not from its status.

### Chat access doesn't require acknowledging first

Any accepted friend of the sender can post, whether or not they've acknowledged.
Gating chat behind acknowledgement would mean two different trust boundaries on
the same alert, and a confusing "I can see this but can't reply" state. One
rule, applied in both places.

---

## Data integrity

### Enforce invariants in the database, not in application code

"One active alert per user" was originally a `findFirst` check before the
`create`. A reviewer reproduced the race: five concurrent requests, two
succeeded, two active alerts in the database. Read-then-write is not atomic —
both requests can see "nothing there" before either writes.

It's now a **partial unique index**, in a raw SQL migration because Prisma
can't express filtered uniques:

```sql
CREATE UNIQUE INDEX "one_active_alert_per_sender"
ON "alerts" ("sender_id") WHERE "status" = 'active';
```

The `WHERE` clause matters. A plain unique index on `sender_id` would also
stop the duplicate — and then permanently prevent the user from ever sending
a second alert, because their closed history would block it.

The application catches Prisma's `P2002` and returns the same 409 as before,
so the API contract is unchanged. The database is the thing that can't be
raced.

### Idempotency via constraints

Acknowledging an alert twice is the same as acknowledging it once, so the
composite primary key `(alertId, userId)` makes a duplicate row impossible,
and `P2002` is caught and treated as **success**. The desired state is
already true; that isn't an error.

Rethrow everything that isn't `P2002` — swallowing unknown errors hides real
failures.

### Conditional atomic updates

Closing an alert uses `updateMany` with the ownership and status conditions
in the `WHERE`, then checks `result.count`:

```ts
const result = await prisma.alert.updateMany({
  where: { id, senderId: me, status: "active" },
  data: { status: "closed", closedAt: new Date() },
});
if (result.count === 0) return reply.code(404).send({ error: "Alert not found" });
```

One query, no window between check and write. The trade-off: `count === 0`
doesn't say *why* — missing, not yours, or already closed. That's fine here,
because all three should return the same 404 anyway (see above). Use
fetch-then-check when you genuinely need to distinguish the cases.

### Friendships store a canonical pair

A friendship between A and B is one row, not two, with the constraint
`userIdA < userIdB` (string comparison on the UUIDs). Without a canonical
ordering you'd need to check both directions on every query, and you could
end up with duplicate rows describing the same relationship.

`requestedBy` is stored separately, so "who asked" survives the ordering.

---

## Stack choices

### bcryptjs over bcrypt

`bcrypt` compiles native C++ at install time via `node-pre-gyp`, which pulls
in an old vulnerable `tar` as a build dependency — two high-severity audit
findings unrelated to our code and unfixable without replacing the package.

`bcryptjs` is pure JavaScript: same API, no native compile step, no
vulnerable build chain, and hash-compatible with `bcrypt` (both implement the
same standard algorithm), so switching didn't invalidate existing accounts.

### @fastify/websocket over Socket.IO

The subject asks for real-time features "using WebSockets or similar". Socket.IO
would give us reconnection, rooms and transport fallbacks for free — but it
silently falls back to HTTP long-polling when WebSockets aren't available,
which is awkward to defend when the module being claimed is specifically
WebSockets.

`@fastify/websocket` is the raw WebSocket API. It integrates with Fastify's
hook system, so socket authentication reuses the existing cookie/JWT path
rather than growing a second one, and there's no client-side bundle — the
browser's `WebSocket` is built in.

The cost we accepted: writing heartbeat and reconnection ourselves. About
forty lines.

### Connection registry: `Map<userId, Set<WebSocket>>`

A `Set`, not a single socket, because one user can be connected from two tabs,
a laptop and a phone. Storing one socket per user would silently orphan the
first connection — still open, never receiving anything.

Removing the empty `Set` when a user's last socket closes means the Map only
ever contains online users, which makes presence a lookup rather than
separate bookkeeping.

Broadcasts go to a **named list of user IDs**, not to every connected socket.
That's the "efficient message broadcasting" the subject asks for: an alert
reaches the sender's friends, nobody else.

### Non-root containers

Both Dockerfiles run as `node` rather than `root`, so a compromised process
doesn't have root inside the container. Cost: a `chown` step in the build and
occasional `--user root` on one-off write commands (see `DEVELOPMENT.md`).

### TypeScript on both sides

Frontend and backend share types, so a change to an API response shape
surfaces as a compile error in the consuming code rather than a runtime
surprise. Postgres because the data is relational — users, friendships,
alerts, acknowledgements, messages are all joins. Prisma because the ORM
module requires an ORM that's genuinely used, and Prisma makes that visible.

---

## Accepted risks

### Long-lived sockets outlive their token

A WebSocket authenticated at 14:00 with a token expiring at 15:00 is still
open at 16:00. Nothing re-validates it, because after the handshake there are
no more requests.

Options were: ignore it, close the socket at `exp`, or require periodic
re-auth over the socket. We ignore it, deliberately — sessions are 7 days,
the socket dies on any page reload or backend restart, and the added
complexity isn't justified at this scale. Documented rather than unnoticed.

### Three open npm audit findings

All transitive dependencies of Fastify and tsx, none triggerable by this app:

- **find-my-way** (Fastify's router) — HTTP/2 DDoS. We don't serve HTTP/2.
- **fast-uri** — host confusion via malformed URIs. We don't parse untrusted URIs.
- **esbuild** (via tsx) — arbitrary file read, *dev server on Windows only*.

Resolving them needs a major Fastify version bump, judged too risky this close
to evaluation. **Don't run `npm audit fix`** — it pulls npm's own dependency
tree into the project and reports more findings than it fixes.

Note the contrast with the `bcrypt` case above: there, a compatible drop-in
existed, so the right call was removing the findings rather than accepting
them. Which situation you're in depends on whether an alternative exists.
