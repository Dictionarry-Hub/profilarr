# Contributing to Profilarr

- [Getting Started](#getting-started)
- [Development Model](#development-model)
  - [Feature Branches](#feature-branches)
  - [Develop](#develop)
  - [Stable](#stable)
- [Making a Change](#making-a-change)
  - [Starting Your Branch](#starting-your-branch)
  - [Staying Up to Date](#staying-up-to-date)
  - [Submitting a Pull Request](#submitting-a-pull-request)
- [Guidelines](#guidelines)
  - [Naming](#naming)
  - [Code Conventions](#code-conventions)
  - [Off-Limits](#off-limits)
  - [Reporting Issues](#reporting-issues)
- [Examples](#examples)
  - [Adding a settings page](#adding-a-settings-page)
  - [Bug found during testing](#bug-found-during-testing)
  - [Hotfix while mid-feature](#hotfix-while-mid-feature)
  - [Multiple features in progress](#multiple-features-in-progress)
  - [Community contribution](#community-contribution)
  - [Contributor needs to rebase](#contributor-needs-to-rebase)
- [Reference](#reference)

## Getting Started

### Prerequisites

| Tool                                      | Version | Required | Description                                              |
| ----------------------------------------- | ------- | -------- | -------------------------------------------------------- |
| [Git](https://git-scm.com/)               | 2.x+    | Yes      | Version control; also used at runtime for PCD operations |
| [Deno](https://deno.com/)                 | 2.x     | Yes      | Runtime, task runner, and package manager                |
| [Node.js](https://nodejs.org/)            | 20+     | Yes      | Required by Vite and svelte-check                        |
| [.NET SDK](https://dotnet.microsoft.com/) | 8.0+    | No       | Only needed for the parser service (CF/QP testing)       |

```bash
git clone https://github.com/Dictionarry-Hub/profilarr.git
cd profilarr
deno task dev
```

## Development Model

Changes flow through three stages:

- **Feature branches**: where work gets built
- **`develop`** (`:develop`): where work gets tested
- **Stable** (`:latest`): where work gets released

```
feature branches → develop (:develop) → tagged release (:latest)
```

### Feature Branches

All new work happens on feature branches created off `develop`. There can be
multiple in progress at once, both internal and community contributions. Each
branch is independent and gets deleted after merging.

When a feature branch is ready, it gets **squash merged** into `develop` for
testing. Squash merging collapses all the commits on the branch into a single
commit on `develop`. This keeps develop's history clean: one feature, one
commit, regardless of how many "wip" or "fix typo" commits happened on the
branch. The squashed commit message is the PR title, so develop reads as a list
of conventional commit entries.

The maintainer decides which branches go in and when; if there's contention,
it's discussed with testers. Smaller batches are preferred to avoid overloading
beta testers and to keep the gap between `:develop` and `:latest` short.

### Develop

`develop` is the default branch, but it's not where day-to-day work happens.
It's the **testing branch**: it always contains the next minor version being
evaluated by beta testers. Every push to `develop` builds the `:develop` Docker
image.

`:develop` is not guaranteed to be stable. Expect untested features and minor
issues. It won't have major breaking changes, but things may not work perfectly.
Don't run it on a setup you depend on.

**Nothing is committed directly to `develop`.** Bug fixes found during testing
go through the same feature branch → PR → squash merge flow as everything else.
This ensures all changes run through CI before landing. Active feature branches
rebase onto `develop` to pick up these fixes.

### Stable

A release needs either **1 week on `develop` with no issues reported**, or
**sign-off from the maintainer + 2 testers**, whichever comes first. Automated
tests must pass in both cases. Once the criteria are met, `develop` gets tagged
(e.g. `v2.3.0`) which builds the `:latest` and `:v2.3.0` Docker images.

Then the cycle repeats: the next batch of complete feature branches is merged
into `develop` for testing.

#### Hotfixes

If a core feature is broken in a stable release and it can't wait for the next
minor version, a hotfix is applied against the stable tag. The bar for this is
high; a core feature must be broken, not a cosmetic issue or minor annoyance.
Small issues wait for the next minor release.

```
develop:  A — B — C — D — E — F — G  (HEAD, testing v2.3.0)
                      ↑
                  v2.2.0 (broken)
```

```bash
# Branch from the stable tag
git checkout -b hotfix/v2.2.0-sync-crash v2.2.0

# Fix the bug, verify locally
git commit -m "fix: crash when syncing empty profiles"

# Tag the patch release
git tag v2.2.1
git push origin hotfix/v2.2.0-sync-crash --tags
```

This builds `:latest` from the fix without including any untested work. The
maintainer tests the fix locally before tagging; hotfixes don't go through the
full beta testing cycle. If the fix isn't something you can confidently verify
yourself, it's not a hotfix.

Then the fix is brought into `develop`:

```bash
git checkout develop
git cherry-pick <commit-hash>
# If the cherry-pick conflicts, resolve and continue:
#   git add <resolved-file>
#   git cherry-pick --continue
git push

# Clean up
git branch -d hotfix/v2.2.0-sync-crash
```

## Making a Change

### Starting Your Branch

Branch off `develop` with a descriptive name:

```bash
git checkout develop
git pull
git checkout -b feat/settings-redesign
```

Work on your branch, committing as you go. Your branch is yours; commit as often
as you like.

### Staying Up to Date

While you work, `develop` keeps moving: bug fixes land, other things get merged.
Your branch falls behind. You need to pull those changes in.

We use **rebase** for this, not merge. Rebase takes your commits and replays
them on top of the latest `develop`, as if you started your branch today:

```
Before rebase:

develop:  A — B — C — D — E
               \
feat:           X — Y — Z

After rebase:

develop:  A — B — C — D — E
                             \
feat:                         X' — Y' — Z'
```

X', Y', Z' are the same changes but with new commit hashes; they have a
different starting point now. This keeps history clean and linear instead of
creating a web of merge commits.

To rebase:

```bash
git fetch origin
git rebase origin/develop
```

If there are conflicts, git pauses on each one:

```bash
# Open the conflicted files, resolve the markers (<<<<, ====, >>>>)
git add <resolved-file>
git rebase --continue
```

If it goes badly wrong:

```bash
git rebase --abort
```

After rebasing, the remote still has the old commits, so you need to force push:

```bash
git push --force-with-lease
```

`--force-with-lease` is safer than `--force`; it refuses to push if someone else
has pushed to the branch since you last fetched.

### Submitting a Pull Request

Before opening a PR, rebase one final time to make sure your branch is current:

```bash
git fetch origin
git rebase origin/develop
git push --force-with-lease
```

Then open a PR on GitHub targeting `develop`. A template will pre-fill the
description: fill in what the PR does, link any related issues, and check off
the checklist items.

**The PR title is the commit message.** Since we squash merge, the PR title
becomes the single commit on `develop`. It must follow conventional commit
format:

```
feat: add regex filter type
fix: sync status not updating after save
refactor: extract profile compilation logic
```

One feature or fix per PR. Keep changes focused and update docs when behavior
changes. Tests are written by the maintainer; contributors don't need to include
them.

Community PRs follow the same process as internal feature branches: they sit in
the queue until `develop` is free, then get included in the next batch for
testing. Community contributions are prioritised for testing over internal work
where possible.

## Guidelines

### Naming

**Branches:**

| Prefix      | Use                          | Example                     |
| ----------- | ---------------------------- | --------------------------- |
| `feat/`     | New features                 | `feat/settings-redesign`    |
| `fix/`      | Bug fixes (non-critical)     | `fix/sync-status-display`   |
| `hotfix/`   | Critical fixes against a tag | `hotfix/v2.2.0-sync-crash`  |
| `refactor/` | Code restructuring           | `refactor/db-query-layer`   |
| `chore/`    | Maintenance, deps, CI        | `chore/update-dependencies` |
| `docs/`     | Documentation changes        | `docs/contributing-guide`   |

**Commits** - [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add regex filter type
fix: sync status not updating after save
docs: update contributing guide
refactor: extract profile compilation logic
chore: update Deno to 2.x
```

The message after the colon is imperative: what the commit does when applied,
not what you did.

**Tags** - [Semantic Versioning](https://semver.org/):

| Change          | Example             |
| --------------- | ------------------- |
| Bug fix         | `v2.1.0` → `v2.1.1` |
| New feature     | `v2.1.0` → `v2.2.0` |
| Breaking change | `v2.1.0` → `v3.0.0` |

### Code Conventions

- **Svelte 5, no runes.** Use `onclick`, no `$state` / `$derived`.
- **Alerts for feedback.** Use `alertStore.add(type, message)`.
- **Dirty tracking.** Use the dirty store to block saves + warn on navigation.
- **Routes > modals.** Only use modals for confirmations or rare one-off forms.
- **API:** extend `/api/v1/*` only; legacy routes are migration targets.

### Off-Limits

The **PCD module** (Profilarr Compliant Database system) is complex and tightly
coupled. Don't modify it without discussing with the maintainer first. This
includes the op replay system, the compile pipeline, and the export flow. See
`docs/ARCHITECTURE.md` for how it works.

### Reporting Issues

Use the
[GitHub issue templates](https://github.com/Dictionarry-Hub/profilarr/issues/new/choose).
There are templates for bugs, feature requests, and general feedback.

## Examples

### Adding a settings page

You want to add a settings page. There's nothing currently being tested on
`develop`; the last release was tagged.

```bash
# Start your feature branch
git checkout develop
git pull
git checkout -b feat/settings-page
```

You work on it over a few days. Commits don't matter much since they'll be
squashed:

```bash
git commit -m "wip: settings page layout"
git commit -m "feat: wire up settings form"
git commit -m "fix: form validation"
git push origin feat/settings-page
```

It's ready. You open a PR on GitHub targeting `develop`. The PR title is your
commit message:

```
feat: add settings page
```

You squash merge the PR. `develop` now has one clean commit:
`feat: add settings page`. The `:develop` image rebuilds. Beta testers start
testing.

A week goes by with no issues. Automated tests pass. You tag it:

```bash
git checkout develop
git pull
git tag v2.4.0
git push --tags
```

`:latest` and `:v2.4.0` build. Stable users get the update. You delete the
feature branch.

### Bug found during testing

The settings page feature is on `develop`. A beta tester reports that saving
settings clears the form instead of showing a success message.

Create a fix branch, just like any other change:

```bash
git checkout develop
git pull
git checkout -b fix/settings-save-message
```

Fix the bug, commit, and push:

```bash
git commit -m "fix: show success message after saving settings"
git push origin fix/settings-save-message
```

Open a PR targeting `develop` with the title
`fix: show success message after saving settings`. CI runs. Once it passes,
squash merge the PR. `:develop` rebuilds. The tester confirms the fix.

No other issues come up. Two testers and the maintainer sign off. You tag it:

```bash
git checkout develop
git pull
git tag v2.4.0
git push --tags
```

The bug fix shipped as part of the minor release. No separate patch needed.

If you have feature branches in progress, they rebase onto `develop` to pick up
the fix:

```bash
git checkout feat/notifications
git fetch origin
git rebase origin/develop
git push --force-with-lease
```

### Hotfix while mid-feature

You're halfway through building a notifications system on `feat/notifications`.
A user reports that syncing crashes on the stable release (`v2.4.0`). It's a
core feature, so it needs a hotfix.

```bash
# Stash or commit your in-progress work
git checkout feat/notifications
git commit -m "wip: notification preferences"

# Branch from the stable tag
git checkout -b hotfix/v2.4.0-sync-crash v2.4.0

# Fix the bug, verify locally
git commit -m "fix: crash when syncing empty profiles"

# Tag the patch release
git tag v2.4.1
git push origin hotfix/v2.4.0-sync-crash --tags
```

`:latest` rebuilds from the fix. Stable users get `v2.4.1`.

Now bring the fix into `develop` and clean up:

```bash
git checkout develop
git cherry-pick <commit-hash>
git push
git branch -d hotfix/v2.4.0-sync-crash
```

Then go back to your feature and rebase to pick up the fix:

```bash
git checkout feat/notifications
git fetch origin
git rebase origin/develop
git push --force-with-lease
```

Your feature branch now includes the sync fix. You continue working where you
left off.

### Multiple features in progress

The settings page (`feat/settings-page`) is on `develop` being tested. While
that happens, you finish a notifications system and start working on a dark mode
feature.

```
feat/settings-page    → merged into develop, being tested
feat/notifications    → complete, waiting in queue
feat/dark-mode        → in progress
```

Testers sign off on the settings page. You tag it:

```bash
git checkout develop
git pull
git tag v2.4.0
git push --tags
```

Now `develop` is free. The notifications feature is next. You open a PR for
`feat/notifications` targeting `develop`, rebase first:

```bash
git checkout feat/notifications
git fetch origin
git rebase origin/develop
git push --force-with-lease
```

Squash merge the PR. `:develop` rebuilds with the notifications feature. Beta
testers start testing.

Meanwhile, you keep working on dark mode. When a bug fix lands on `develop`
during notifications testing, you rebase to pick it up:

```bash
git checkout feat/dark-mode
git fetch origin
git rebase origin/develop
git push --force-with-lease
```

When notifications is tagged, dark mode is next in the queue.

### Community contribution

A contributor wants to add a dark mode toggle. They fork the repo, clone it, and
create a branch:

```bash
git clone https://github.com/their-username/profilarr.git
cd profilarr
git remote add upstream https://github.com/Dictionarry-Hub/profilarr.git
git checkout -b feat/dark-mode-toggle
```

They build the feature, commit, and push to their fork:

```bash
git commit -m "feat: dark mode toggle"
git push origin feat/dark-mode-toggle
```

They open a PR on GitHub targeting `develop`. The PR title follows conventional
commits: `feat: add dark mode toggle`.

Right now, the notifications feature is being tested on `develop`. The PR waits.
The maintainer reviews the code and leaves feedback. The contributor pushes
updates.

Notifications testing finishes and gets tagged as `v2.5.0`. The maintainer
decides to include the dark mode PR in the next batch. The contributor rebases
first:

```bash
git fetch upstream
git rebase upstream/develop
git push --force-with-lease
```

The maintainer squash merges the PR. `:develop` rebuilds with the dark mode
toggle. Beta testers start testing. The contributor's work goes through the same
cycle as any internal feature.

### Contributor needs to rebase

A contributor opened a PR for `fix/sync-status-display` two weeks ago. Since
then, several bug fixes and a feature have landed on `develop`. Their PR now has
merge conflicts.

The maintainer comments on the PR: "Please rebase from develop."

The contributor updates their branch:

```bash
git fetch upstream
git rebase upstream/develop
```

Git pauses on a conflict in `src/lib/client/ui/SyncStatus.svelte`:

```
const status = getSyncStatus(profile);
```

The contributor resolves it, keeping the correct version:

```bash
git add src/lib/client/ui/SyncStatus.svelte
git rebase --continue
```

No more conflicts. They force push to update the PR:

```bash
git push --force-with-lease
```

The PR is now clean and up to date. The maintainer can review and squash merge
when `develop` is free.

## Reference

- `docs/ARCHITECTURE.md` - full codebase encyclopedia (modules, data flow, PCD)
- `bash scripts/stats.sh` - per-module code stats (TS/JS/Svelte/CSS/SQL/C#)
