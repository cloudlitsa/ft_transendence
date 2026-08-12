# ft_transcendence — project definition

*PO working doc. Scope, plan and reasoning. For live module status see
`README.md`; for technical decisions see `docs/DECISIONS.md`.
Last updated: 12/08/26*

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

### The buffer problem

We are at **exactly 14**, with no slack. The eval sheet is explicit that a
non-functional or incomplete module scores zero, so a single module wobbling on
the day drops us to 12 or 13 and we fail. Options for a 15th point, in order of
preference: **File upload** (avatar work is happening anyway), **2FA**
(unparked), **Advanced search** (forced, last resort).

**Important honest note**: the "Advanced permissions" module is about admin/user/moderator roles with CRUD on users — it does NOT fit "friend tiers" naturally.

## Tech stack

- Frontend: React + TypeScript + Vite + react-router-dom
- Backend: Fastify + TypeScript (TypeScript on both sides means shared types)
- Database: PostgreSQL with Prisma ORM
- WebSockets: `@fastify/websocket` (agreed — raw WebSocket API, reuses the existing cookie/JWT auth path, no client bundle; rationale in `docs/DECISIONS.md`)
- Auth: bcryptjs, JWT with httpOnly cookies, Zod validation
- Deployment: Docker Compose
- HTTPS: reverse proxy terminating TLS, to be added (mandatory per subject)

Why TypeScript both sides: shared interfaces between frontend and backend save bugs. Why Postgres: relational data (users, friendships, alerts, messages) fits perfectly. Why Prisma: the ORM minor module needs an ORM that's actually used, Prisma makes that obvious.

Full reasoning for these and the security patterns is in `docs/DECISIONS.md`.

## Roles

- **Litsa** — Product Owner + Developer
- **Maria** — Tech Lead + Developer
- **TBD** — Project Manager + Developer
- **Muktim** — Developer

4 people, not 5. Less coordination overhead. PO + PM + Tech Lead all double as
devs, which the subject explicitly allows for a team this size.

## Ways of working

- **Comms:** Discord
- **Board:** Jira (project TRAN)
- **Git:** feature branches → PR → 1 approving review required → squash and merge → delete branch. See `CONTRIBUTING.md`.
- **Docs:** `README.md` (what it is, how to run it, module status) · `CONTRIBUTING.md` (branches and PRs) · `docs/DEVELOPMENT.md` (day-to-day workflow and gotchas) · `docs/DECISIONS.md` (why things are built the way they are)

## Risks

- **Exactly 14 points, no buffer.** One module failing at evaluation = fail. Mitigation: pick a 15th (see above) once the current work lands.
- **Team size.** The subject specifies 4–5 people and the eval sheet's first check is that all members are present. Any further drop below four needs resolving with staff, not absorbing quietly.
- **Uneven contribution.** Every member is asked individually to explain their work, and git history is checked. Everyone needs merged commits, not just assigned tickets.
- **HTTPS is still missing.** Mandatory requirement, not a point — currently a rejection risk rather than a scoring one.
- **Legal pages.** Missing or placeholder ToS/Privacy is an explicit rejection condition. Small work, high consequence.
- **PWA push notifications on iOS are flaky.** Documented limitation; scoped out of the PWA module (which covers installability + offline). We surface it in the app rather than cover it up.

## Resolved questions

- **Can we claim both Standard user management and User interaction?** Yes — confirmed with pedago. This is what closed the gap from 12 to 14.
- **Stack** — agreed as above.
- **WebSocket library** — `@fastify/websocket`.
- **Comms / project management** — Discord and Jira.

## Open questions

- Who takes Project Manager?
- Which module do we add as the 15th point, and who owns it?
