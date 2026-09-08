# ft_transcendence — project definition

*PO working doc: scope, reasoning, and the decisions we changed our minds
about. `README.md` is the reference — what the project is, who did what, how to
run it, what it claims. This file is why. Technical reasoning lives in
`docs/DECISIONS.md`.*

*Last updated: 08/09/26*

## What this is

A web app for sending check-in alerts to a small circle of friends. Sometimes
you're not okay, sometimes you just want someone to reach out, and it shouldn't
take a phone call or a long explanation. You hit a button, your close friends
get notified in real time, they can acknowledge, and you can chat from there.

Not an emergency service. We say so in the app and in the ToS. For real
emergencies, people call 999/112. This is for the in-between.

## Why this and not a game

Games eat time. Multiplayer sync is hard, AI opponents are hard, tournaments
are CRUD on top of game state. Too much for a short timeline.

A check-in app is mostly auth, users, friends, one WebSocket layer used
everywhere, a list of alerts, and a chat. Most of the modules we claim stack on
the same infrastructure, and that has held up: the connection registry built
for alerts also drives online status, the profile page counts towards two
majors at once, and the storage engine written for chat attachments is what
avatars now run on.

## Target user

Someone in their 20s or 30s with a small group of close friends they actually
trust. Not the general public, not anonymous strangers, not a social network.
Closed circle, mutual consent to be on each other's lists.

## Core MVP

The bar for "done". If we can't do all of these, the project isn't finished —
regardless of how many module points we've collected.

- sign up / log in with email and password
- profile page with avatar
- find users, add friends, accept/decline, see the list
- send a check-in ("I'm not okay" / "Need a chat" / "Could someone reach out")
- friends see it in real time
- friends acknowledge → sender sees who has
- friends chat with the sender from the alert
- sender marks themselves all clear
- alert history for the sender and the people involved
- accessible ToS and Privacy pages

That's it. Keep it simple.

## What we are not building

(Just in case we get carried away.)

- no SMS or phone calls
- no integration with real emergency services
- no location sharing (privacy minefield plus scope creep)
- no native mobile app
- no AI features
- no anonymous mode or public alerts
- no groups beyond the friends list
- no payments, no premium tier, none of that

If it isn't in the MVP and isn't a claimed module, it doesn't get built.

## Scope decisions

The module list, the point calculation and the per-module justification are in
`README.md` under *Modules* — one authoritative copy, so the two can't drift.
What's here is the reasoning behind the shape of that list, including the parts
we got wrong first time.

### 14 points, deliberately

The minimum. A module that's incomplete at evaluation scores **zero**, so a
smaller set that all work beats a larger set with a weak link. Everything we
claim is something the app needs anyway.

### File upload — why we changed our minds

It was on the dropped list, and the reason it was dropped still stands as the
test it had to pass: we build avatar upload anyway inside Standard user
management, so claiming file upload separately only works if there's real
substance that isn't the avatar work wearing a different hat.

It clears that bar. Attachments hang off `Message`, not `User` — an image or a
PDF on a chat message, with its own validation, storage and deletion story.

**The duplication challenge answers itself.** Avatar upload didn't become file
upload. `profile.ts` moved onto the shared storage engine, which is how avatars
gained a magic-byte check they never had. The module improved the avatar path
rather than being derived from it, which is the opposite of claiming the same
work twice.

### Still dropped, and why

- **2FA** (Minor, 1 pt) — schema migration, enrolment flow, second login step,
  backup codes, all of it touching the one subsystem that already works. High
  risk for one point, and it was stalling. Parked, not deleted.
- **Advanced search** (Minor, 1 pt) — would be forced. Nothing in a closed
  friends circle needs filtering, sorting and pagination.

**Honest note:** "Advanced permissions" is about admin/user/moderator roles
with CRUD on users. It does *not* fit "friend tiers" naturally, however much we
wanted it to.

### The buffer problem — resolved, and not the way we planned

We have a fifteenth point. Nobody went and built one.

Through August the position was exactly 14 with no slack, and a deliberate
decision not to add a buffer. That was right at the time: three of the fourteen
were still in flight, and starting fresh work to insure against a smaller risk
meant taking time from the larger one. The mitigation was to make the merged
points undeniable and get the outstanding ones owned.

Then file upload got built anyway and turned out to stand on its own. So the
buffer exists without our having paid for it.

**The consequence matters more than the point does. OAuth is no longer
load-bearing.** For most of this project the biggest risk was that OAuth —
unowned for weeks, then late — wouldn't land, and that its one point was the
difference between passing and failing. That's no longer true.

### OAuth — conditional, and the condition is GDPR

OAuth is worth one bonus point. It is not worth one of the fourteen.

**It ships only with the account-deletion fix.** Deletion confirms with a
password. A Google-only account hasn't got one. GDPR is one of our fourteen and
a half-working module scores zero, so merging OAuth alone would gain a spare
point and put a required one at risk.

Two conditions:

1. **A confirmation route for accounts with no password.** Agreed 07/09: type
   DELETE. The password flow is unchanged. Not as strong as re-authenticating
   with Google — for a password account the confirmation authenticates, for a
   Google-only account it only confirms intent — and we say that rather than
   pretend otherwise.
2. **Login stays quiet.** With `passwordHash` nullable, a Google-only user
   typing into the password form must still get the generic "Invalid email or
   password". Saying "this account uses Google" turns login into a way to
   discover which addresses are Google accounts. *Done in the OAuth PR.*

The migration touches the shared `User` model, so everyone re-runs migrations
when it lands and the fresh-clone test gets re-run after it.

**If those aren't met with time to spare, we don't merge it.** Evaluating at 14
and saying why beats fifteen points with one broken.

## Documents

- `README.md` — what it is, how to run it, who did what, what it claims
- `CONTRIBUTING.md` — branches, PRs, review
- `docs/PROJECT.md` — this file: scope, reasoning, risks
- `docs/DECISIONS.md` — why the code is the way it is, and what we rejected
- `docs/DEVELOPMENT.md` — day-to-day workflow and the gotchas that cost an afternoon
- `docs/websocket-demo.md` — reproducible end-to-end demo of the WebSockets module
- `docs/tailwind-reference.md` — Tailwind v4 reference (v4 differs from v3)
- `docs/git-guide.md` — personal git reference

Team, roles, tools and working agreements are in `README.md` under *Team
Information* and *Project Management*.

## Risks

- **The mandatory requirements, not the points.** All fourteen are merged, so
  what can still sink us are the pass/fail checks that earn nothing: zero
  console errors in Chrome, the README's required sections including the
  AI-usage description, fresh-clone deploy, multi-user concurrency,
  accessibility. These fail the whole project rather than costing one point.
- **Merged is not validated.** Each module is demonstrated individually and one
  that wobbles on the day scores zero. The fifteenth buys us one mistake and no
  more.
- **The Google app is in Testing mode.** Only allowlisted accounts can sign in,
  so an evaluator's Google account won't work unless we add it live or publish
  the app to Production first. Decide before the day, not during it.
- **PWA push notifications on iOS are flaky.** Documented limitation, scoped
  out of the module (which covers installability and offline). We surface it in
  the app rather than cover it up.

### Closed risks

Kept rather than deleted — the record that a risk was handled is worth as much
at evaluation as the warning was beforehand.

- **Exactly 14 points with no buffer** — resolved 04/09. File upload landed and
  stands on its own, so we evaluate at 15 with 14 required, and OAuth moved
  from load-bearing to optional.
- **3 of the 14 points in progress** — resolved. Chat merged; the fourteenth is
  covered by file upload rather than by OAuth.
- **Uneven contribution** — resolved 07/09, and open longest. The eval sheet
  asks each member individually to explain their work and checks git history,
  and one member had nothing merged. He has left the group; the four who remain
  each have work of their own to demonstrate.
- **Uploaded files surviving account deletion** — resolved 07/09. Cascade
  removes rows, not files; deletion now collects filenames before the delete
  and unlinks after. See `docs/DECISIONS.md`.
- **HTTPS** — resolved. Caddy terminates TLS as the single public entry point,
  and the frontend's port mapping was removed, so there's no unencrypted route
  into the app rather than an encrypted one that happens to be preferred.
- **Legal pages** — resolved. ToS and Privacy merged, linked from a global
  footer. Both describe rights rather than mechanisms, so they don't go stale
  when the UI changes.
- **Project Manager unfilled** — resolved. Ade joined mid-project.

## Resolved questions

- **Can we claim both Standard user management and User interaction?** Yes,
  confirmed with Yassir. This is what closed the gap from 12 to 14.
- **WebSocket library** — `@fastify/websocket`.
- **Who is driving the chat frontend?** Maria. Merged.
- **Do we add a 15th point for buffer?** Originally no, now yes via file
  upload. The original reasoning is kept above rather than deleted, because the
  change of position is the useful part.
- **What's the cut-off for OAuth?** Not a cut-off question any more — the
  module is optional. It merges if the GDPR condition is met with time to
  spare, and otherwise it doesn't.
- **How does a Google-only user confirm deletion?** Typed DELETE. Agreed 07/09.