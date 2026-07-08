# Contributing to the check-in app

This is our shared workflow for making changes to the code. It exists so that
`main` stays stable, our history stays readable, and no one is left guessing
what the next step is.

Read this before your first PR. Push back on anything you disagree with — we
can update it together.

## The one hard rule

**Never push directly to `main`.** Everything goes through a feature branch
and a pull request. `main` is protected on GitHub and will refuse direct
pushes anyway, but the rule matters even without the technical enforcement —
it means every change on `main` has been reviewed by at least one other
person.

## Branch names

Use a forward-slash prefix that says what kind of change it is, then a short
kebab-case description of what you're building:

- `feature/<what-you-are-building>` — new features (most common)
- `fix/<what-is-broken>` — bug fixes
- `chore/<what-you-are-cleaning>` — refactors, docs, dependency updates

Examples: `feature/friends-system`, `feature/auth-forms`,
`fix/cookie-secure-flag`, `chore/update-readme`.

Why the prefix: it makes the kind of change obvious at a glance, and
`feature/` groups related work together in git tools. GitHub already shows
who opened a PR, so we don't need names in the branch itself.

## Starting a new branch

Always branch from an up-to-date `main`:

```bash
git checkout main
git pull
git checkout -b feature/<whatever-you-build-next>
```

## While you're working

Commit as often as you like. Small "wip: trying x" commits are fine —
squash-merging (see below) collapses them into one clean commit on `main`.
Don't stress about commit messages on your feature branch; do stress about
the final PR title and description, because that's what shows up on `main`
forever.

## Before you open a PR

1. Bring your branch up to date with `main`:
   ```bash
   git checkout main
   git pull
   git checkout feature/your-branch
   git merge main
   ```
2. Resolve any conflicts **locally**, never in GitHub's web UI. The web UI
   doesn't run the app, so you can't verify the resolution actually works.
3. Test that things still work: `docker compose up --build`, and click
   through the affected part of the app in the browser.
4. Push your branch:
   ```bash
   git push -u origin feature/your-branch
   ```

We use **merge** to sync `main` into feature branches, not rebase. Rebasing
rewrites history, and if you push a rewritten branch someone else has
already pulled, git gets confused and so do people. Merging is loud and
safe.

## Opening the PR

- **Clear title.** In a sentence, what does this PR do? This becomes the
  squash commit message on `main`, so it needs to be readable a month from
  now.
- **Description.** What changed, why, and how the reviewer can check it
  works. If it touches the API, include a `curl` example. If it touches
  the UI, include the route to click.
- **Keep it small.** One thing per branch. `feature/friends-system` is
  probably actually two PRs: `feature/friends-endpoints` and
  `feature/friends-page`. Smaller PRs get reviewed faster and are easier
  to revert if something goes wrong.

## Review

- Wait for at least one approval before merging.
- If a reviewer requests changes, push more commits to the same branch —
  the PR updates automatically. No need to close and reopen.
- Review each other's code. It's how we all learn the codebase, and every
  team member has to be able to defend the whole project at evaluation.

## Merging

- Use **Squash and Merge** on GitHub. This collapses all your feature-branch
  commits into one clean commit on `main`.
- Delete the branch after merging (GitHub gives you a button, and you can
  turn on auto-delete in repo Settings → General → Automatically delete head
  branches).

## Keeping your active branches fresh

You don't need to update every open branch every time `main` moves — that's
just noise. Sync when:

- You sit down to work on your branch and haven't pulled in a while
- You know the merged change touches files you're working on
- You're about to open your own PR (this one matters most)

```bash
git checkout main
git pull
git checkout feature/your-branch
git merge main
```

## If something bad lands on `main`

Unlikely with branch protection, but if it happens: **do not force-push a
fix.** Ping the team on Discord, hit the Revert button on the offending
merged PR (GitHub creates a revert PR for you), and open a proper fix PR
after.

## Rules of the road

- No force-pushes to `main`. Ever.
- No rebase — we merge.
- No merging your own PR without review, even for small changes.
- No committing `.env` or anything with secrets. `.env` is gitignored; if
  a secret slips in by accident, tell the team immediately so we can
  rotate it.
