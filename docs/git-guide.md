# Git — personal reference

Litsa · last reorganised 19 Aug 2026

Commands I actually use, grouped by what I'm trying to do.
*why* is included where getting it wrong costs an hour.

---

## Index

1. [Daily loop](#1-daily-loop)
2. [Branches](#2-branches)
3. [Staging and committing](#3-staging-and-committing)
4. [Merging and conflicts](#4-merging-and-conflicts)
5. [Reviewing someone else's PR](#5-reviewing-someone-elses-pr)
6. [Inspecting: what changed, what's where](#6-inspecting-what-changed-whats-where)
7. [Undoing and rescuing](#7-undoing-and-rescuing)
8. [.gitignore and untracking files](#8-gitignore-and-untracking-files)
9. [Cleaning up branches](#9-cleaning-up-branches)
10. [Remotes and first-time setup](#10-remotes-and-first-time-setup)
11. [SSH keys](#11-ssh-keys)
12. [Auditing for secrets](#12-auditing-for-secrets)
13. [When git misbehaves](#13-when-git-misbehaves)
14. [Rules I've learned the hard way](#14-rules-ive-learned-the-hard-way)

---

## 1. Daily loop

```bash
git status                      # always. before and after everything
git checkout main && git pull   # start from current main
git checkout -b feature/thing   # new branch
# ... work ...
git add <specific files>
git commit -m "feat: what and why"
git push -u origin feature/thing
```

`-u` sets the upstream so later pushes are just `git push`.

**Why `&&` and not `;`** — with `&&`, if `git checkout main` fails (which it
will if you have conflicting local changes), the `pull` never runs. With `;` the
pull runs anyway and you pull into whatever branch you were standing on.

---

## 2. Branches

```bash
git branch                      # local branches, * marks current
git branch --show-current       # just the name
git branch -vv                  # local branches + what they track + ahead/behind
git branch -r                   # remote branches
git branch -a                   # all
```

**New branch, always from fresh main:**
```bash
git checkout main && git pull
git checkout -b feature/thing
```

**Switch to an existing remote branch** (teammate's work):
```bash
git fetch origin
git checkout feature/their-branch
```
`fetch` downloads all remote branch state; `checkout` finds it and sets up
tracking automatically.

**Rename current branch:**
```bash
git branch -m new-name
```

**Started work on the wrong branch?** See [§7](#7-undoing-and-rescuing).

---

## 3. Staging and committing

```bash
git add path/to/file.ts         # specific — the default habit
git add -A                      # everything: modified, new, deleted, whole repo
git add .                       # current directory downward only
```

`git add -A` vs `git add .` — the difference is scope. `-A` covers the entire
working tree regardless of where you're standing; `.` only covers the directory
you're in and below.

**Be specific when a branch has unrelated changes floating in it.** Naming files
explicitly is what stops an unrelated `.gitignore` edit riding along into a
styling PR.

**Staging is all-or-nothing.** If one path in `git add a b c` doesn't exist, the
whole command aborts and *nothing* gets staged. Check `git status` after.

```bash
git commit -m "feat: broadcast acknowledgements to the sender"
git commit                      # opens editor — use for merge commits
```

Commit message prefixes in use: `feat:` `fix:` `chore:` `docs:` `refactor:`

---

## 4. Merging and conflicts

**Bring main into your feature branch** (do this before opening a PR if main has
moved):
```bash
git checkout main && git pull
git checkout feature/thing
git merge main
```

Pulling main does **not** touch your feature branch. Without the merge, your
branch still doesn't have main's newer work.

**When it conflicts**, git marks the files and stops:
```bash
git status                      # "Unmerged paths" lists them
```

In each file you'll see:
```
<<<<<<< HEAD
your version
=======
their version
>>>>>>> main
```

Decide what the file should say, delete all three marker lines. **Often both
sides are wanted** — two people added different things in the same place and git
can't tell they don't conflict semantically.

Then check nothing survived:
```bash
git diff --check
grep -rn "<<<<<<<\|>>>>>>>" <files>
```

**Editing isn't enough — `git add` is the signal that says "resolved":**
```bash
git add <the conflicted files>
git status                      # Unmerged paths should be empty
git commit                      # accept the default merge message
```

**Verify before committing, not after.** Type-check, run the app, click the page
that exercises the merged code. A resolution that compiles isn't necessarily
correct.

**Keep the merge commit pure.** Resolve conflicts only. Unrelated fixes go in a
separate commit after, so the merge stays reviewable at a glance.

---

## 5. Reviewing someone else's PR

```bash
git checkout main && git pull
git fetch origin
git checkout feature/their-branch
git log --oneline -5            # sanity: their commits on top of main
```

**See just their hand-written changes**, skipping lockfile noise:
```bash
git diff main --stat                          # where the bulk is
git diff main -- frontend/src/                # the real changes
git diff -w main -- frontend/src/App.tsx      # ignoring whitespace
```

**If you edited files while testing**, revert before approving:
```bash
git checkout -- path/to/file.tsx
git status                      # must be clean
```

**Don't commit into someone else's branch.** Comment instead. They lose
visibility, don't learn the reasoning, and it muddies who authored what — which
matters when contribution is assessed individually.

---

## 6. Inspecting: what changed, what's where

```bash
git log --oneline -5                    # recent commits
git log --oneline -5 -- path/to/file    # recent commits touching one file
git log -p --all                        # full history with diffs (huge)

git diff                                # unstaged changes
git diff --cached                       # staged changes
git diff main                           # this branch vs main
git diff main --stat                    # summary of the above
```

**What does main have that my branch doesn't?**
```bash
git log feature/thing..main --oneline
```

**Does this branch have real commits, or is it a stale pointer?**
```bash
git log feature/thing --oneline -5
```

**Search tracked files:**
```bash
git grep -n "searchterm"                        # whole repo
git grep -n "searchterm" path/to/file.ts        # one file
```
Faster than `grep -r` and skips ignored files automatically.

---

## 7. Undoing and rescuing

**Discard changes to a file** (unstaged):
```bash
git checkout -- path/to/file.tsx
```
This is the preferred pattern for temporary test code: edit freely, then throw
it away. No branch needed.

**Unstage a file, keeping the changes:**
```bash
git restore --staged path/to/file
```

**Working on the wrong branch?** Stash, branch, unstash:
```bash
git status                      # note what's uncommitted
git stash
git checkout -b feature/correct-branch
git stash pop
git status                      # your changes are back, on the right branch
git stash list                  # see what's stashed
```

**Uncommitted changes follow you between branches.** They aren't attached to a
branch — they float on top of whatever you check out. This is why an edit made
on one branch turns up in another branch's diff.

---

## 8. .gitignore and untracking files

**Add a rule:**
```bash
echo ".DS_Store" >> .gitignore
echo "notes/" >> .gitignore
```

**The trap: `.gitignore` only affects *untracked* files.** Once git is tracking
something, adding it to `.gitignore` does nothing at all. You must untrack it:

```bash
git rm --cached .DS_Store           # single file
git rm -r --cached .vscode          # directory
```

`--cached` removes it from git's index but **leaves it on disk**. Without
`--cached`, `git rm` deletes the actual file.

Then commit the removal:
```bash
git add .gitignore
git commit -m "chore: stop tracking editor config"
```

**If `git rm --cached` says "did not match any files"** — good news, it was never
tracked. Your ignore rule works as-is, nothing to do.

---

## 9. Cleaning up branches

**Local:**
```bash
git checkout main && git pull
git branch --merged main        # branches whose work is already in main
git branch -d feature/thing     # safe delete
git branch -D feature/thing     # force delete
```

**Squash-merge orphans the commits**, so git often won't recognise a
squash-merged branch as merged and `-d` refuses. `-D` forces it — safe *only*
when you've confirmed the work is on main (check `git log --oneline` on main
first).

**Remote:**
```bash
git push origin --delete feature/thing
```

**Tidy stale remote-tracking refs** after branches are deleted on GitHub:
```bash
git fetch --prune
git branch -r                   # now shows only what actually exists
```

Without `--prune`, `git branch -r` keeps listing branches that are long gone,
which is how you end up confused about what's live.

**Better:** turn on *Automatically delete head branches* in repo settings so
GitHub does the remote half for you.

---

## 10. Remotes and first-time setup

**New repo:**
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin git@github.com:username/repo.git
git push -u origin main
```

Create the repo on GitHub **without** a README, .gitignore or licence — an empty
repo avoids an immediate conflict.

**Check / change remotes:**
```bash
git remote -v                   # what am I connected to
git remote remove origin
git remote add origin <url>
```

**Start over completely** (nuclear — destroys all history):
```bash
rm -rf .git
git init
```

---

## 11. SSH keys

**Generate:**
```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -C "cloudlitsa@newlaptop"
```
- `-t ed25519` — modern, secure key type
- `-C` — a comment so you can identify the key later

Creates two files:
- `~/.ssh/id_ed25519` — **private key, never share**
- `~/.ssh/id_ed25519.pub` — public key, safe to share

**Add to GitHub:**
```bash
cat ~/.ssh/id_ed25519.pub
```
Copy it → GitHub Settings → SSH keys → New SSH key.

**Config** (needed for a custom key name or multiple accounts):
```bash
cat >> ~/.ssh/config << EOF
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519
EOF
```

**Test:**
```bash
ssh -T git@github.com
```

---

## 12. Auditing for secrets

Run before any submission. A secret deleted from the working tree is **still in
history** and still findable.

```bash
# tracked files that shouldn't be
git ls-files | grep -iE '\.env|\.pem$|\.key$|certs/'

# assigned values, not just mentions of the word
git log -p --all | grep -inE '(PASSWORD|SECRET|API_KEY|TOKEN)=[^$ ]' | grep -v example

# JWTs anywhere in history
git log -p --all | grep -E 'eyJ[A-Za-z0-9_-]{20,}' | head

# confirm the ignore rules exist
git show HEAD:.gitignore | grep -E '\.env|certs'
```

**Expect false positives.** Variable *names* (`JWT_SECRET`, `POSTGRES_PASSWORD`)
in compose files and docs are fine. Placeholder values in `.env.example` are
fine and should be committed. npm `integrity` hashes look like base64 but are
public checksums. You're looking for a real assigned value.

---

## 13. When git misbehaves

**Stale ref error on pull:**
```bash
git update-ref -d refs/remotes/origin/main   # delete the stale local pointer
git fetch origin
git pull
```
Safe — it's a local bookmark, not history.

**If that fails:**
```bash
git gc --prune=now
git pull
```

**"Your local changes would be overwritten by checkout"** — you have uncommitted
work in a file the checkout wants to change. Commit it or stash it
([§7](#7-undoing-and-rescuing)).

---

## 14. Rules I've learned the hard way

- **`git status` before and after staging.** Every time.
- **Always branch from fresh main** — `git checkout main && git pull` explicitly,
  never assume.
- **Don't stack branches.** If your work needs an unmerged PR, wait or split the
  work in two.
- **Verify in the browser before declaring done.** Compiling is not working.
- **`package.json` and `package-lock.json` are a pair** — change one, commit
  both, same commit. Never hand-edit the lockfile; let npm regenerate it.
- **Uncommitted changes are not attached to a branch.** They follow you.
- **`.gitignore` has no power over tracked files.**
- **Never sync a repo through iCloud or Dropbox.** Git writes many small files in
  a specific order; a half-synced `.git` corrupts. Use GitHub as the sync
  mechanism between machines — commit and push on one, pull on the other.
- **After any `git pull`, look at what changed** before assuming your environment
  still works. New dependency in `package.json`? New migration? Reinstall or
  migrate before running.
