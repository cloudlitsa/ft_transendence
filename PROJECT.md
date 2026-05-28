# ft_transcendence — project definition

*Draft. PO working doc. Will change once team is in place. Last updated: 27/05/26

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

Most modules I want to claim stack on the same infrastructure. That's the whole point.

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

(Just in case I/we get carried away)

- no SMS or phone calls
- no integration with real emergency services
- no location sharing (privacy minefield + scope creep)
- no native mobile app
- no AI features
- no anonymous mode / public alerts
- no groups beyond the friends list
- no payments, no premium tier, none of that

If something isn't in the MVP and isn't on the module list below, it doesn't get built.

## Module plan — aiming for 14 points

Since modules must be fully functional and properly justified or they count as zero, I want to be honest about what fits the check-in app vs what would be forced.

**Web (majors stack well here)**
- Major: Use frameworks for both frontend and backend — 2 pts
- Major: Real-time features with WebSockets — 2 pts (this is the core of the app, not an add-on)

**User Management**
- Major: Standard user management (profile, avatar, friends, online status) — 2 pts
- Minor: OAuth (Google or 42 or GitHub) — 1 pt

**Web (minors)**
- Minor: ORM — 1 pt (we'd use one anyway, just claim it)
- Minor: Notification system for create/update/delete actions — 1 pt
- Minor: PWA with offline support and installability — 1 pt (this is the closest a web app gets to "lock screen notifications", which is exactly what a check-in app needs)
- Minor: File upload (for avatars + maybe attaching context to an alert) — 1 pt

**Cybersecurity / User Management (pick one)**
- Minor: 2FA — 1 pt (genuinely useful for a trust-based app like this)

That's 2+2+2+1+1+1+1+1+1 = **12 points**. Two short.

**Options for the remaining 2 points — needs team discussion:**

1. Major: "Allow users to interact" (chat + profile + friends) — 2 pts. We're building this anyway. But it overlaps with Standard user management. Need to check if the school will accept both.
2. Minor: GDPR compliance (data export + delete) — 1 pt. Fits the app's "we respect privacy" angle. Plus 1 more minor.
3. Minor: Advanced search (with filters/sorting/pagination, applied to friends/alerts) — 1 pt. Plus 1 more minor.
4. Minor: Custom design system with 10+ reusable components — 1 pt. We need a design system anyway, so this is "free" if we're disciplined. Plus 1 more minor.

My current preference: option 1 (the user interaction major) if the school accepts it alongside Standard User Management. If not, GDPR + Advanced Search + Custom design system gives us 3 points, which gives a buffer in case one module gets rejected at evaluation.

**Important honest note**: the "Advanced permissions" module is about admin/user/moderator roles with CRUD on users — it does NOT fit "friend tiers" naturally.

## Tech stack (open to team discussion)

Going to commit to something so we can start. Tech Lead can override once they're on the team.

- Frontend: React + TypeScript + Tailwind
- Backend: NestJS or Fastify (TypeScript on both sides means shared types)
- Database: PostgreSQL with Prisma ORM
- WebSockets: Socket.IO
- Auth: bcrypt + JWT, plus an OAuth provider
- Deployment: Docker Compose, HTTPS via self-signed cert for dev / Caddy or similar in front

Why TypeScript both sides: shared interfaces between frontend and backend save bugs. Why Postgres: relational data (users, friendships, alerts, messages) fits perfectly. Why Prisma: the ORM minor module needs an ORM that's actually used, Prisma makes that obvious.

If the Tech Lead wants Django / Express / something else, we can talk about it.

## Roles

- Me — Product Owner + Developer
- TBD — Tech Lead + Developer
- TBD — Project Manager + Developer
- TBD — Developer

4 people, not 5. Less coordination overhead. PO + PM + Tech Lead all double as devs.

## Timeline (rough, one month)

- **Week 1**: Team formation finalised. Stack agreed. Docker skeleton running with hello-world frontend + backend + DB. Auth done by end of week.
- **Week 2**: Friends system + profiles + avatars. WebSocket layer up. First check-in alert flowing end-to-end (sender → backend → friend's screen).
- **Week 3**: Acknowledge flow. Chat. Notifications. PWA setup.
- **Week 4**: Polish, ToS/Privacy pages, README, OAuth, 2FA, GDPR. Mock evaluations.
- **Extension (14 days)**: Buffer. Bug fixes. Anything that slipped. Stretch modules if we're somehow ahead.

If we're behind in week 2, we cut features, not modules. If we're behind in week 3, we need to think about which module to drop. :-/

## Risks 

- **No team yet.** Message posted, talking to people. Biggest single risk.
- **Using WebSockets in production.** Plan: test it/work it on it in week 1, before depending on it.
- **PWA push notifications on iOS are flaky.** Documented limitation, we bring it up it in the app rather than cover it.
- **Module rejection at evaluation = 0 pts for that module.** Mitigation: aim slightly over 14 (15-16) so we have a buffer.

## Open questions (for the team, once formed)

- Stack: do we all agree on TS / React / NestJS or Fastify / Postgres / Prisma?
- Can we claim both "Standard user management" (major) and "User interaction" (major) without overlap rejection? Need to check with Yassir.
- What's everyone's exam date? Need a shared calendar in week 1.
- Communication channel — WhatsApp, something else?
- Project management — GitHub Issues, Trello, plain markdown?

## What I'm doing this week as PO + Dev solo

1. Initialize the repo with this doc + a README stub + .gitignore.
2. Stand up the Docker skeleton (frontend container + backend container + DB container, hello-world routes).
3. Keep recruiting.
