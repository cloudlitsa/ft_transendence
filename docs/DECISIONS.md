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

### Two deliberate exceptions to the identical-404 rule

The attachment routes answer something other than 404 in two places. Both are
exceptions on purpose, not oversights, and both should stay.

**410 Gone for an attachment its sender removed.** The caller can already see
that this attachment exists — it comes back in the message payload with
`deleted_at` set — so there is nothing left to conceal, and 410 lets the UI
tell "removed" apart from "broken link".

**403 when you are not the message's author.** By the time that check runs the
caller has passed `canAccessAlert`, so they can already see the attachment and
who posted it. A 404 would hide nothing they don't already know, and would
just be less useful than saying "you can't delete someone else's photo".

The rule the entry above protects is about **what a caller can learn that they
could not already learn**. Where the answer is "nothing", the specific status
code is the better one.

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

### Uploads are judged by their bytes, not by their label

A `Content-Type` is written by the client — a claim, not evidence. A shell
script sent as `image/png` passes any check that reads only that header. So
`lib/fileStorage.ts` requires both to agree: the declared type must be on the
allowlist **and** the first bytes must carry that format's signature
(`89 50 4E 47…` for PNG, `FF D8 FF` for JPEG). The avatar route had only the
first half until attachments arrived and the two started sharing an engine.

The stored name is a UUID with an extension taken from the allowlist, never
from the client's filename, so a name can't carry a path (`../../`) or a second
extension. The original is kept in its own column, for display only.

**Allowed types are per route, not global.** `storeFile` takes an `accept`
list, so being in the engine's table is necessary but not sufficient: chat
takes images and PDF, avatars images only, because a PDF avatar would be a
broken `<img>`. One shared list had silently let PDFs into the avatar route.

Trade-off: adding a format is a code change, not config. That is the point.
Archives are excluded for the same reason the rule exists — a `.zip` signature
proves only that a file is a zip, not what is inside it; the README's *File
upload and management* section records that in full.

---

## Who can see what

### The export shows original names, not stored ones

`GET /export` omits `filename` — the internal `<uuid>.<ext>` on disk — and
keeps `originalName`, which is what the user uploaded and would recognise.

`filename` is an implementation detail, and it's the exact value the
access-control test uses to prove that a direct request to
`/api/account/export` returns 404. Handing it out in a file the user keeps
is pointless at best.

It's `.map` rather than `select` so a column added later doesn't silently drop
out of everyone's export.

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

### Deleting an account takes the thread with it

Two cascade paths reach `messages`: `sender_id → users`, and
`alert_id → alerts → users`. Both are `onDelete: Cascade`. So deleting an
account removes your messages wherever you wrote them, *and* every message in
an alert you sent, whoever wrote it.

Both directions surprise people. A friend who replied to your check-in loses
their reply. And you leaving puts gaps in conversations you were only a guest
in.

The alternative is what most chat apps do — keep other people's messages, and
keep yours in their threads, on the grounds that a reply is its author's own
expression. We don't, for two reasons. A check-in thread is a conversation
about one person's distress, so leaving it readable after they've gone means
their crisis stays on other people's screens. And erasure is the right we're
claiming, so an ambiguous case should resolve toward removing more rather than
less.

The cost is real and falls on someone who didn't delete anything. That's why
it's stated in the Privacy Policy rather than left to be discovered.

### Closing an alert ends its conversation

A closed check-in accepts no new messages (`409`), but stays readable and is
listed under *Past check-ins* on the alerts page.

The alert is what grants permission to talk, so withdrawing it withdraws the
permission. Leaving the chat open would be one-sided in practice: closing
removes the sender's link to the thread, so a friend with the tab still open
could keep posting into a conversation the sender can no longer reach.

The status check lives in `POST /messages` alone, not in `canAccessAlert` —
that helper is shared with the message GET and both attachment routes, so
history, images and an author's own attachment delete all keep working.

`409` rather than the usual `404`: the caller can already see `status: "closed"`
from `GET /api/alerts/:id`, so a 404 would hide nothing.

### Past check-ins show only the ones you took part in

`pastAlerts` lists closed alerts you sent, acknowledged or posted in — not every
closed alert you could once see. The live list shows every friend's active
check-in because that is a "someone needs you now" signal; a browsable record of
every friend's past bad days is a different thing.

### Chat access doesn't require acknowledging first

Any accepted friend of the sender can post, whether or not they've acknowledged.
Gating chat behind acknowledgement would mean two different trust boundaries on
the same alert, and a confusing "I can see this but can't reply" state. One
rule, applied in both places.

### Attachments are deletable by their sender; message text is not

Message text stays immutable — no edit, no delete. An attachment is a separate
resource, so its sender may remove it: a duty-of-care measure, un-sharing an
image they regret. "Sender" means the author of the **message**, not of the
alert — a friend who posts a photo into someone else's check-in owns it.

The delete is **soft**. The file is unlinked but the row stays with
`deleted_at` set, so the bubble can render a "removed" placeholder. A hard
delete would take the row too, leaving a message indistinguishable from one
that never had an attachment — the record would quietly rewrite itself.

Unlinking is best-effort; the accepted cost is a file nothing points at. The
removal is broadcast to everyone on the alert **including the deleter**, unlike
`message:new` — they may have the conversation open on another device.

### Every message carries a caption; an attachment is optional

Content keeps its `min(1)` rule. An attachment rides alongside the required
text, never instead of it. That gives every file context — and every image a
screen-reader label — and keeps validation simple: there is no empty-message
case.

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

### A write spanning disk and database goes to disk first

Sending a message with an attachment touches two stores that can't participate
in one transaction: the filesystem and Postgres. Whichever order you pick, a
crash in the middle leaves them disagreeing — the only choice is *which*
disagreement you'd rather have.

We write the file first, then commit the message and the attachment row in one
transaction, and unlink the file if that transaction throws.

The other order can't be made safe: a commit can't be undone, so a disk write
that fails afterwards leaves a row pointing at a missing file — a permanently
broken image. Ours fails the other way, leaving a file no row references:
invisible, and sweepable.

Message and attachment share one transaction for the reason the placeholder
exists (see "Attachments are deletable by their sender").

**Deleting reverses the order.** `DELETE /api/attachments/:id` commits
`deleted_at` first, then unlinks — here the surviving row is what the UI needs,
and a leftover file is unreachable once the row says deleted. One rule in both
directions: put the failure where nobody can see it.

### Account deletion collects filenames before it deletes

`ON DELETE CASCADE` is a Postgres feature. It removes rows and knows nothing
about the filesystem — so deleting a user wiped the attachment and avatar rows
and left the files sitting on the volumes.

The rows were the only record of which file belonged to whom. Filenames are
UUIDs; once the rows are gone there is nothing left to identify the orphans by.
So `routes/gdpr.ts` collects every live attachment filename and the avatar URL
**before** `prisma.user.delete`, then unlinks after it commits.

Order matters in both directions. Collect before, or there is nothing left to
collect. Unlink after, or a delete that fails partway has already destroyed
files for an account that still exists.

Unlink failures are logged, never thrown — the same rule as the confirmation
emails. A file that won't unlink must not stop someone deleting their account;
that would be a worse problem than the one this fixes.

The query filters on `deletedAt: null`, because a soft-deleted attachment had
its file removed at the time — see "A write spanning disk and database goes to
disk first".

### Attachment uploads extend the message endpoint, they don't get their own

`POST /alerts/:id/messages` branches on `isMultipart()` — JSON for a plain
message, multipart when a file rides along. The alternative was a separate
upload endpoint returning an id the client then attaches to a message.

Two endpoints would leave a window where an uploaded file belongs to nobody,
needing a cleanup job for abandoned uploads. One endpoint means the message and
its attachment commit together or not at all.

The access check runs **before** the body is read, so a caller with no business
in the conversation never gets to stream megabytes at us or have a file written
on their behalf.

### Friendships store a canonical pair

A friendship between A and B is one row, not two, with the constraint
`userIdA < userIdB` (string comparison on the UUIDs). Without a canonical
ordering you'd need to check both directions on every query, and you could
end up with duplicate rows describing the same relationship.

`requestedBy` is stored separately, so "who asked" survives the ordering.

### Injection and XSS: why the defence is structural

Two classic web attacks involve a user typing something that stops being
*data* and starts being *instructions*. Neither is possible here, and in both
cases that comes from how the tools work rather than from anything clever we
wrote.

#### SQL injection

Prisma never builds queries by joining strings. The
instruction (`WHERE email = $1`) and the value are sent to the database
separately. The database works out what the query means before the user's
text arrives, so by then the shape of the query is fixed and the text can
only be a value. If someone types SQL into the email box, the database
simply looks for a user whose email address is that exact text, and doesn't
find one.

**The one exception to know about.** Prisma has `$queryRawUnsafe` and
`$executeRawUnsafe`, which *do* glue strings together and would reintroduce
the risk. We don't use them.

We do use raw SQL in two places, both safe:

- `backend/src/server.ts` — the health check runs `SELECT NOW() as time`,
  a fixed string with no user input.
- The migration adding the partial unique index on active alerts — a fixed
  migration, run once, with no user input.

Both use the backtick form, `` $queryRaw`...` ``, which is a tagged template.
Even if a value were interpolated into it, Prisma extracts that value and
sends it as a bound parameter rather than pasting it into the SQL text. The
string-concatenating behaviour only exists in the `Unsafe` variants.

#### Cross-site scripting (XSS)

**The attack.** Someone sets their display name to:

```
<script>alert(1)</script>
```

If the app drops that text into the page as HTML, then when a *different* user
opens their friends list, their browser sees a real `<script>` tag and runs it.
`alert(1)` just shows a popup, which is why it's the standard harmless test.
A real attack would read the victim's session or act as them.

This matters for us specifically: display names and check-in notes are written
by one user and shown on another user's screen. That is exactly the situation
XSS needs.

**Why it can't happen here.** When React renders `{user.displayName}`, it sets
that value as **text**, not as HTML. The browser method React uses for text
does not parse tags at all — a `<` character stays a `<` character on screen.
So a display name containing `<script>` shows up as the literal, visible
characters `<script>alert(1)</script>`, which looks silly but is completely
inert.

Again, nothing is being stripped or filtered. The text simply never reaches
the part of the browser that turns tags into elements.

**The one exception to know about.** React has an escape hatch called
`dangerouslySetInnerHTML`, which does insert raw HTML. It is deliberately given
an alarming name. We don't use it.

#### What we still validate, and why

Since neither attack is possible, validation is doing a different job:

- **Backend (Zod)** — rejects data that would be *wrong* rather than
  dangerous: malformed emails, passwords under 8 characters, missing fields,
  absurdly long strings. This is the security boundary, because anyone can
  bypass the browser and post directly to the API with curl.
- **Frontend** — mirrors the same rules purely so the user gets an instant,
  helpful error instead of a round trip. It is a convenience, not a
  protection, and we assume it can be skipped entirely.

#### How to demonstrate this at evaluation

1. Sign up with the display name `<script>alert(1)</script>`
2. Add that account as a friend from a second account
3. Open the friends list — the name appears as visible text, no popup
4. Try `' OR 1=1--` in the login email field — a normal "invalid credentials"
   response, no 500, no login

A 500 error on either would be the warning sign: it would mean the input
reached somewhere it should never have got to.

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

### Avatar storage: files on disk, not in the database

Uploaded avatars are stored as files in `/app/uploads` in the backend
container, on a named Docker volume, and served as static files by
`@fastify/static`. The `users.avatar_url` column holds a URL path, not image
bytes.

Storing the bytes in Postgres was the alternative. It would grow the database,
add a query to every avatar load, and inflate every backup — for no gain,
since nothing about an image benefits from being in a relational table.

Validation is **server-side**, because the browser can be bypassed entirely: a
JPEG/PNG/WebP allowlist, a 2 MB cap, and a check that the file's bytes match
its declared type (see "Uploads are judged by their bytes"). That logic now
lives in `lib/fileStorage.ts`, shared with chat attachments, rather than
inline in the route. Stored files get a randomly generated name — the client's
filename is never trusted, since a caller controls it completely and a path
like `../../etc/passwd` is just a string until something uses it. The previous
file is unlinked on replace or delete, so the volume doesn't accumulate
orphans. An empty `avatar_url` renders a default avatar rather than a broken
image.

### Chat attachments live outside the served directory

`@fastify/static` serves all of `/app/uploads` at `/api/uploads/` with **no
authentication** — right for a profile picture, wrong for a photo shared in a
check-in. So attachments go to `/app/private` instead, on its own volume,
matched by no static prefix: the only way to read one is
`GET /api/attachments/:id`, which runs `canAccessAlert` first.

Sharing the directory would have been less code, and would have made that
gated route decorative — the file would also be reachable at a plain URL, with
none of our code running. A UUID filename is no substitute: an unguessable URL
is still a URL, and URLs get forwarded, logged and pasted.

The two share an *engine*, not a directory. `lib/fileStorage.ts` validates,
stores and removes for both, taking the destination as an argument — one place
to fix a validation bug, two trust levels.

Three headers follow from the file being access-controlled. `Cache-Control:
private`, never `public`, or a shared cache would hand a copy to anyone asking
for the same URL. `nosniff`, so the browser can't second-guess the declared
type. And `Content-Disposition: inline` for images, `attachment` for everything
else — a PDF opened inline runs in the browser's viewer on *our* origin, where
some viewers execute embedded JavaScript.

`/app/private` is created and chowned in the Dockerfile before the `USER node`
switch — see "Non-root containers".

### Dev mail goes to a catcher, not a real inbox

Confirmation emails for GDPR export and deletion send over SMTP to a
**Mailhog** container in development, viewable at `localhost:8025`. Going live
is an env-var change, not a code change: `sendMail` is a generic helper with
no GDPR-specific logic.

Sends are **fire-and-forget**. A mail failure is logged and never blocks the
export or the delete, because a user's GDPR right must not depend on an SMTP
server being reachable.

On Apple Silicon the Mailhog image is `linux/amd64` and runs under emulation,
which Docker warns about on every `up`. It works; it's just slower to start.
Not worth pinning a platform or swapping the image for a dev-only mail
catcher.

Two consequences we accepted:

- Mailhog's web UI is the one published port besides the proxy. It serves no
  application code and holds no user data, so it doesn't weaken the HTTPS
  requirement — but it's worth being able to explain rather than being caught
  by it. Its SMTP port (1025) stays internal to the Docker network.
- The Privacy Policy deliberately **doesn't** promise confirmation emails,
  even though they are sent. A legal page that names a mechanism goes stale
  the moment the mechanism changes; under-promising there costs nothing,
  while over-promising is the error that actually matters.

### Alpine base images

`node:22-alpine`, `postgres:16-alpine`, `caddy:2-alpine`. The subject doesn't
ask for this; we chose it.

**Size.** `node:22-alpine` is around 130 MB against roughly 1.1 GB for the full
image. That's faster builds and faster pulls, and it matters directly at
evaluation — a fresh clone has to download all of it before the app starts.

**Attack surface.** Fewer installed packages means fewer things carrying CVEs.
Alpine ships busybox and musl rather than a full GNU userland. Same reasoning
as running as `node` rather than root: ship the minimum.

**The trade-off** is musl libc instead of glibc. Packages with native binaries
sometimes have no prebuilt musl build and either compile from source at install
time or don't work at all.

We don't hit it, and not by luck — see *bcryptjs over bcrypt*. That choice was
made to avoid native compilation, which is exactly the class of problem Alpine
makes worse. The two decisions hold each other up.

**Mailhog is the exception, and it's fine.** It publishes an amd64 image only,
so on Apple Silicon it runs under emulation and Docker warns about the platform
mismatch on every `up`. It's a dev-only mail catcher that never ships, and it
works. Pinning `platform: linux/amd64` would silence the warning on one
machine and risk breaking it on another architecture, so we leave it.

### Non-root containers

Both Dockerfiles run as `node` rather than `root`, so a compromised process
doesn't have root inside the container. Cost: a `chown` step in the build and
occasional `--user root` on one-off write commands (see `DEVELOPMENT.md`).

**The cost is real, and it bit us.** Docker creates a named volume's mount
point as `root` if the path doesn't already exist in the image. `/app/uploads`
didn't, so on a fresh volume the directory was owned by `root` while the
process ran as `node` — and every avatar upload failed silently at the
filesystem. Nothing in the logs, nothing in the network tab, just an empty
directory and a `NULL` `avatar_url`.

The fix is to create the directory in the image, with the right owner, before
switching user:

```dockerfile
RUN chown -R node:node /app
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
RUN mkdir -p /app/private && chown -R node:node /app/private
USER node
```

Docker then seeds the volume from the image directory and the ownership comes
with it.

Two things worth keeping from this. **A fresh-clone test has to exercise the
features that touch volumes**, not just confirm the containers start —
ours passed while avatar upload was broken, because nothing in the smoke test
wrote a file. And **`--user root` in a one-off `exec` masks the problem**: it
fixes the running container while leaving the image, and therefore every
future clone, unchanged.

### Design system decisions live in the README

The palette, typography, icon registry and per-component reasoning (why alert
actions are amber rather than red, why `focus-visible` rather than `focus`,
why the online-status indicator is `role="status"`) are documented in
`README.md` under *Custom design system*, alongside the module claim they
support. They are not duplicated here — one authoritative copy, so the two
can't drift apart.

### TypeScript on both sides

Frontend and backend share types, so a change to an API response shape
surfaces as a compile error in the consuming code rather than a runtime
surprise. Postgres because the data is relational — users, friendships,
alerts, acknowledgements, messages are all joins. Prisma because the ORM
module requires an ORM that's genuinely used, and Prisma makes that visible.

### Workbox logs in the dev service worker

The console shows Workbox precache misses for `/api/*` routes. They are
`console.debug` from the service worker. The messages are correct
behaviour: API responses are not precached, so the request falls through
to the network.

The eval sheet allows minor third-party warnings if explained; this is
the explanation.

### `startTime` TypeError from DevTools live metrics

An `Uncaught TypeError: Cannot read properties of undefined (reading
'startTime')` appears on idle while DevTools is open. It comes from a
script DevTools injects into the inspected page to measure INP and CLS
(the source references `reportSoftNavs: window.devTools`). It reads
`entries[0].startTime` on an empty array after a client-side route
change.

It is not in our dependency tree — `npm ls web-vitals` returns nothing —
and it does not reproduce on a static page with no soft navigations.
It only exists while DevTools is open.

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

<<<<<<< HEAD
### OAuth account linking is one-directional.

When a user logs in with Google, we link to an existing password account on the same email automatically — 
but only when Google reports email_verified: true. We trust Google's verification of ownership, 
not the user's unverified claim; linking on an unverified email would let someone pre-register 
a password account on an address they don't own and have it taken over via Google.

The reverse — a Google-only user adding a password — is not supported. 
Signup returns 409 for any existing email regardless of how that account authenticates, 
so a Google-only user cannot currently set a password. This is a deliberate MVP scope decision, not an oversight. 
Reverse-linking would require a "set password" action on the profile/settings page, 
available only to an already-authenticated user (proving they own the account) — 
it cannot go through the public signup endpoint without opening an account-takeover hole. 
If we decide the UX is worth it, it's a separate ticket.
=======
### Attachment images load eagerly

Chrome's DevTools flags `loading="lazy"` on an image with no explicit
dimensions: it reserves a 0×0 box, then shifts the page when the file
arrives. Every other image in the app carries `width`/`height` and does
not shift.

Attachments are user uploads, so we don't know their dimensions at
render time. Options were: store `width`/`height` on the Attachment
record at upload; reserve a fixed aspect ratio in CSS and crop; or load
eagerly. We load eagerly.

Storing dimensions is the correct fix and stays on the list — it's a
schema change, rejected this close to evaluation. Cropping loses part
of the image in the thumbnail. Eager loading costs a full download of
every image in a long conversation, which is the trade we accepted: a
conversation is a bounded list and the images are inside the visible
scroll region anyway.
>>>>>>> origin/main
