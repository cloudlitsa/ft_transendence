# ft_transcendence — project definition

*PO working doc. Scope, plan and reasoning. For live module status see
`README.md`; for technical decisions see `docs/DECISIONS.md`.
Last updated: 23/08/26*

## What this is

A web app for sending check-in alerts to a small circle of friends. The idea is simple: sometimes you're not okay, sometimes you just want someone to reach out, and it shouldn't take a phone call or a long explanation. You hit a button, your close friends get notified in real-time, they can acknowledge, and you can chat from there.

Not an emergency service. We say this clearly in the app and in the ToS. For real emergencies, people call 999/112. This is for the in-between — the stuff that isn't a crisis but you still want someone to notice.

## Why this and not a game

Games eat time. Multiplayer sync is hard, AI opponents are hard, tournaments are CRUD on top of game state. For a short timeline it's too much.

A check-in app is mostly:
- auth + users + friends
- real-time notifications (one WebSocket layer, used everywhere)
- a list of alerts in the database
- a chat

Most modules we claim stack on the same infrastructure. That's the whole point, and it has held up: the WebSocket connection registry built for real-time alerts is also what online status uses, and the profile page counts towards two majors at once.

## Target user

Someone in their 20s or 30s with a small group of close friends they actually trust. Not for the general public, not for anonymous strangers, not a social network. Closed circle. Mutual consent to be on each other's lists.

## Core MVP — what the app must do

Just these. If we can't do all of these, the project isn't done.

- sign up / log in with email + password (mandatory per subject anyway)
- profile page with avatar
- find users, add friends, accept/decline requests, see friends list
- send a check-in alert ("I'm not okay" / "Need a chat" / "Could someone reach out")
- friends see the alert in real-time
- friends can acknowledge → sender sees who has acknowledged
- friends can chat with the sender from the alert
- sender can mark themselves "all clear" to close the alert
- alert history (past alerts visible to sender + people involved)
- accessible ToS + Privacy pages (mandatory per subject)

That's it. Keep it simple.

## What we are not building

(Just in case we get carried away)

- no SMS or phone calls
- no integration with real emergency services
- no location sharing (privacy minefield + scope creep)
- no native mobile app
- no AI features
- no anonymous mode / public alerts
- no groups beyond the friends list
- no payments, no premium tier, none of that

If something isn't in the MVP and isn't on the module list below, it doesn't get built.

## Module plan — 14 points

Modules must be fully functional and properly justified or they count as **zero**
at evaluation, so this list is deliberately limited to things the app needs
anyway. Live status (done / in progress) lives in `README.md`, not here — this
section is the plan and the justification.

**Web**
- Major: Frameworks for both frontend and backend — 2 pts
- Major: Real-time features with WebSockets — 2 pts *(the core of the app, not an add-on)*
- Minor: ORM — 1 pt *(we'd use one anyway, just claim it)*
- Minor: Notification system for create/update/delete actions — 1 pt
- Minor: PWA with offline support and installability — 1 pt *(closest a web app gets to "lock screen notifications", which is exactly what a check-in app needs)*
- Minor: Custom design system, 10+ reusable components — 1 pt *(the subject requires a styling solution regardless, so this converts an obligation into a point)*

**User Management**
- Major: Standard user management (profile, avatar, friends, online status) — 2 pts
- Major: User interaction (chat, profile, friends) — 2 pts
- Minor: OAuth — 1 pt

**Data and Analytics**
- Minor: GDPR compliance (data export + delete) — 1 pt *(fits the app's privacy angle; the data here is genuinely sensitive)*

**Total: 14 points.**

### Dropped, and why

- **2FA** (Minor, 1 pt) — schema migration, enrolment flow, second login step, backup codes, and all of it touching the one subsystem that already works. High risk for one point, and it was stalling. Parked, not deleted: it's the first thing to reach for if we need a replacement.
- **File upload** (Minor, 1 pt) — we're building avatar upload anyway as part of Standard User Management, so claiming it separately would need genuine extra substance (validation, size limits, storage strategy) to survive "does this add real value". Worth revisiting as a **buffer point** if we want to go above 14.
- **Advanced search** (Minor, 1 pt) — would be forced. Nothing in a closed friends circle needs filtering, sorting and pagination.

### The buffer problem — decided: no buffer

We are at **exactly 14**, with no slack, and we are staying there.

The eval sheet is explicit that a non-functional or incomplete module scores
zero, so a single module wobbling on the day drops us to 12 or 13 and we fail.
The obvious mitigation was a 15th point — **File upload**, **2FA**, or
**Advanced search**, in that order of preference.

**We are not taking it.** As of 23/08 there are nine days to the team
deadline, 11 of the 14 points are merged, and the remaining 3 sit in work that
is still in progress — chat (TRAN-22 backend, TRAN-23 frontend) and OAuth
(TRAN-21). Adding a fifteenth module would mean starting fresh work while two
already-claimed modules are still to land: spending scarce time buying
insurance against a risk smaller than the one we'd be ignoring.

The mitigation is therefore a different shape: **make the 11 merged points
undeniable, and get the remaining 3 owned.** Concretely —

- every merged module verified end to end and documented in `README.md`, so
  none of them is the one that wobbles
- the mandatory requirements cleared (zero console errors, fresh-clone
  deploy, multi-user concurrency, accessibility pass) — these are pass/fail
  on the whole project, so they outrank any single point
- an evaluation dry run booked, with each member able to explain their own
  work
- TRAN-21, TRAN-22 and TRAN-23 each with a clear owner and a date, so that if
  any isn't going to land we drop the module early and deliberately rather
  than discover it on the day

If OAuth or chat is formally written off with a week still to run, revisit
this — **File upload** remains the cheapest replacement, since avatar upload
already exists and only needs the validation and storage story documented as
its own module. That is a decision to take deliberately, not a plan to drift
into.

**Important honest note**: the "Advanced permissions" module is about admin/user/moderator roles with CRUD on users — it does NOT fit "friend tiers" naturally.

## Tech stack

- Frontend: React + TypeScript + Vite + react-router-dom
- Backend: Fastify + TypeScript (TypeScript on both sides means shared types)
- Database: PostgreSQL with Prisma ORM
- WebSockets: `@fastify/websocket` (agreed — raw WebSocket API, reuses the existing cookie/JWT auth path, no client bundle; rationale in `docs/DECISIONS.md`)
- Auth: bcryptjs, JWT with httpOnly cookies, Zod validation
- Deployment: Docker Compose
- HTTPS: Caddy reverse proxy terminating TLS, the single public entry point
  (rationale in `docs/DECISIONS.md`)

Why TypeScript both sides: shared interfaces between frontend and backend save bugs. Why Postgres: relational data (users, friendships, alerts, messages) fits perfectly. Why Prisma: the ORM minor module needs an ORM that's actually used, Prisma makes that obvious.

Full reasoning for these and the security patterns is in `docs/DECISIONS.md`.

## Roles

- **Litsa** — Product Owner + Developer
- **Maria** — Tech Lead + Developer
- **Ade** — Project Manager + Developer
- **Mihaela** — Developer
- **Muktim** — Developer

Five people. PO, PM and Tech Lead all double as devs, which the subject
explicitly allows. Every member needs merged commits they can explain
individually — see *Risks*.

## Ways of working

- **Comms:** Slack (primary coordination), Discord (informal)
- **Board:** Jira (project TRAN)
- **Git:** feature branches → PR → 1 approving review required → squash and merge → delete branch. See `CONTRIBUTING.md`.
- **Docs:**
  - `README.md` — what it is, how to run it, module status and per-module justification
  - `CONTRIBUTING.md` — branches and PRs
  - `docs/PROJECT.md` — this file: scope, plan, roles, risks
  - `docs/DECISIONS.md` — why things are built the way they are, and the trade-offs accepted
  - `docs/DEVELOPMENT.md` — day-to-day workflow and gotchas
  - `docs/websocket-demo.md` — reproducible end-to-end demo of the WebSockets module
  - `docs/tailwind-reference.md` — Tailwind v4 reference (v4 configures differently from v3)
  - `docs/git-guide.md` — personal git reference

## Risks

- **Exactly 14 points, no buffer.** One module failing at evaluation = fail. Mitigation: pick a 15th (see above) once the current work lands.
- **Team size.** The subject specifies 4–5 people and the eval sheet's first check is that all members are present. Any further drop below four needs resolving with staff, not absorbing quietly.
- **Uneven contribution.** Every member is asked individually to explain their work, and git history is checked. Everyone needs merged commits, not just assigned tickets.
- **3 of the 14 points are still in progress.** User Interaction (2 pts) needs chat: TRAN-22 (backend) is in progress, TRAN-23 (frontend) is not yet assigned. OAuth (TRAN-21, 1 pt) is in progress. Together these carry 3 of the 14 points, so this is the project's largest open risk. Each needs a clear owner with capacity and an agreed date after which the module is dropped deliberately rather than discovered incomplete on the day.
- **PWA push notifications on iOS are flaky.** Documented limitation; scoped out of the PWA module (which covers installability + offline). We surface it in the app rather than cover it up.

### Closed risks

Kept rather than deleted — the record that a risk was handled is worth as much
at evaluation as the warning was beforehand.

- **HTTPS** — resolved. Caddy terminates TLS as the single public entry point,
  and the frontend's direct port mapping was removed, so there is no
  unencrypted route into the app rather than an encrypted one that happens to
  be preferred.
- **Legal pages** — resolved. Terms of Service and Privacy Policy merged,
  linked from a global footer on every page. Both describe rights rather than
  mechanisms, so they don't go stale when the UI changes.
- **Project Manager unfilled** — resolved. Ade joined mid-project.

## Resolved questions

- **Can we claim both Standard user management and User interaction?** Yes — confirmed with pedago. This is what closed the gap from 12 to 14.
- **Stack** — agreed as above.
- **WebSocket library** — `@fastify/websocket`.
- **Comms / project management** — Slack for coordination, Jira for the board.
- **Project Manager** — Ade, joined mid-project.
- **Do we add a 15th point for buffer?** No — see *The buffer problem* above.

## Open questions

- **Who is driving TRAN-23 (chat frontend)?** Unassigned. The backend
  (TRAN-22) is in progress, but without the frontend the User Interaction
  major (2 pts) doesn't count.
- **What is the cut-off date for chat and OAuth (TRAN-21)?** We need a date on
  which we either have them or drop the module, so the decision is taken with
  time to spare rather than at the deadline.
- **TRAN-3 (buffer module) is still open on the board.** Per *The buffer
  problem* above it should be closed as won't-do, or kept only as a documented
  fallback if chat or OAuth is formally dropped.
- **When is the evaluation dry run?** No date set. Every member needs to be
  able to explain their own work.