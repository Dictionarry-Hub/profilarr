# Contributing to Profilarr

This guide covers how to submit changes and what we expect from contributions.
For the branching model, release process, and versioning, see
[DEVELOPMENT.md](DEVELOPMENT.md).

- [Getting Started](#getting-started)
- [Making a Change](#making-a-change)
  - [Starting Your Branch](#starting-your-branch)
  - [Staying Up to Date](#staying-up-to-date)
  - [Submitting a Pull Request](#submitting-a-pull-request)
  - [PR Scope](#pr-scope)
- [Guidelines](#guidelines)
  - [Naming](#naming)
  - [Code Conventions](#code-conventions)
  - [AI-Assisted Contributions](#ai-assisted-contributions)
  - [Off-Limits](#off-limits)
  - [Reporting Issues](#reporting-issues)
  - [Closing Issues](#closing-issues)
- [Examples](#examples)
  - [Community contribution](#community-contribution)
  - [Contributor needs to rebase](#contributor-needs-to-rebase)
- [Reference](#reference)

## Getting Started

### Prerequisites

| Tool                                      | Version              | Required | Description                                              |
| ----------------------------------------- | -------------------- | -------- | -------------------------------------------------------- |
| [Git](https://git-scm.com/)               | 2.x+                 | Yes      | Version control; also used at runtime for PCD operations |
| [Deno](https://deno.com/)                 | See `.tool-versions` | Yes      | Runtime, task runner, and package manager                |
| [Node.js](https://nodejs.org/)            | See `.tool-versions` | Yes      | Required by Vite and svelte-check                        |
| [.NET SDK](https://dotnet.microsoft.com/) | 8.0+                 | No       | Only needed for the parser service (CF/QP testing)       |

```bash
git clone https://github.com/Dictionarry-Hub/profilarr.git
cd profilarr
deno task dev
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

### PR Scope

One feature or fix per PR. If you spot something small while working (a typo,
a missing null check, a wrong label) and it's in code you're already touching,
it's fine to include it. If you'd describe the PR as doing two things, split it.

The reason is squash merging: everything collapses into one commit. If a bundled
change causes a regression, you can't revert just that part; you revert the
whole PR. Keeping unrelated changes separate preserves that option.

Doc-only changes (comments, wording, formatting) are always fine to bundle.

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

A release takes the version of its highest-impact change. See
[Versioning](DEVELOPMENT.md#versioning) for how to decide which row a change
falls into.

### Code Conventions

- **Svelte 5, no runes.** Use `onclick`, no `$state` / `$derived`.
- **Alerts for feedback.** Use `alertStore.add(type, message)`.
- **Dirty tracking.** Use the dirty store to block saves + warn on navigation.
- **Routes > modals.** Only use modals for confirmations or rare one-off forms.
- **API:** extend `/api/v1/*` only; legacy routes are migration targets.

### AI-Assisted Contributions

AI tools may be used as assistants, but the contribution must be yours. You are
responsible for the code, the reasoning behind it, and the communication around
it.

PR descriptions, issue comments, and review replies must reflect your own
understanding of the change. Do not submit generated summaries, invented
context, unrelated validation notes, or explanations you cannot personally stand
behind. Using AI to tidy wording is fine; outsourcing the substance of the
conversation is not.

AI-assisted contributions must still follow the normal project rules:

- Keep the PR focused to one feature, fix, or documentation change.
- Follow the existing architecture, style, and conventions.
- Do not include unrelated cleanup, generated noise, editor metadata, chat logs,
  AI tool configuration, or promotional links.
- Be ready to answer questions and make follow-up changes yourself.

When reporting validation, use this project's commands. For code changes, that
usually means the same Deno-based checks used by CI: `deno task lint`,
`deno task check`, `deno task build`, or the relevant `deno task test ...`
command. Do not list unrelated npm, framework, or generated tool commands as if
they validate Profilarr.

If you could not run a relevant check, say that plainly and explain why. A PR
does not need to be perfect before review, but the validation notes should be
accurate.

Maintainers may close PRs that appear to be unreviewed generated output,
issue-scraping submissions, advertising, or changes the author cannot explain.

### Off-Limits

The **PCD module** (Profilarr Compliant Database system) is complex and tightly
coupled. Don't modify it without discussing with the maintainer first. This
includes the op replay system, the compile pipeline, and the export flow. See
`docs/ARCHITECTURE.md` for how it works.

### Reporting Issues

Use the
[GitHub issue templates](https://github.com/Dictionarry-Hub/profilarr/issues/new/choose).
There are templates for bugs, feature requests, and general feedback.

### Closing Issues

Close an issue when the fixing PR merges into `develop`. There's no need to
wait for a stable release. The work is done and in the pipeline. Leave a short
comment so the reporter knows what to expect:

> Fixed in `develop`, will ship with the next release.

Duplicates, out-of-scope requests, and won't-fix decisions should be closed
immediately with a brief explanation.

If a report can't be reproduced or is missing details, label it `❓ needs info`
and ask for what's needed, usually the Profilarr log export and the Arr log from
the time of the event. If there's no reply after 7 days, close it with a short
comment. It can be reopened once the information is available:

> Closing as can't reproduce. Happy to reopen if you can share the logs.

## Examples

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
- `docs/DEVELOPMENT.md` - branching model, release process, versioning
- `deno task stats` - per-module code stats (TS/JS/Svelte/CSS/SQL/C#)
