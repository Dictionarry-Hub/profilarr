# Development

This guide covers the branching model, release process, and versioning. For
how to submit changes, see [CONTRIBUTING.md](CONTRIBUTING.md).

- [Development Model](#development-model)
  - [Feature Branches](#feature-branches)
  - [Develop](#develop)
  - [Stable](#stable)
    - [Hotfixes](#hotfixes)
- [Versioning](#versioning)
- [Examples](#examples)
  - [Adding a settings page](#adding-a-settings-page)
  - [Bug found during testing](#bug-found-during-testing)
  - [Fast patch release](#fast-patch-release)
  - [Hotfix while mid-feature](#hotfix-while-mid-feature)
  - [Multiple features in progress](#multiple-features-in-progress)
- [Reference](#reference)

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
It's the **testing branch**: it always contains the next release being
evaluated by beta testers. Every push to `develop` builds the `:develop` Docker
image.

`:develop` is not guaranteed to be stable. Expect untested features and minor
issues. It won't have major breaking changes, but things may not work perfectly.
Don't run it on a setup you depend on.

**Nothing is committed directly to `develop`.** Bug fixes found during testing
go through the same feature branch → PR → squash merge flow as everything else.
This ensures all changes run through CI before landing. Active feature branches
rebase onto `develop` to pick up these fixes.

Before merging anything into a free `develop`, define the next release batch:
target version, included PRs, whether it needs a soak, and what kind of fixes
are allowed while it soaks. Use a local `.release-plan.md` scratch file if
useful; it's ignored by git so the plan can change without repo churn.

Once the batch is assembled, treat `develop` as that release candidate. Don't
add unrelated work during the soak; it either fixes the current batch or waits
for the next one. Small, low-risk bug fixes may be added if they are easy to
verify and don't change the release risk profile.

### Stable

What a release needs depends on what's in it. Automated tests must pass either
way.

If the batch contains anything that needs other people to verify it (a new
feature, anything risky, or anything the author can't confidently confirm
alone), it **soaks** on `develop` until the maintainer is satisfied it's ready.

If the batch is entirely small, low-risk changes the author can verify
themselves (most bug fixes, docs, dependency bumps, minor tweaks), it can be
tagged **as soon as CI passes**; no soak needed.

This is the same bar as a hotfix, pointed forward: if you can confidently verify
it yourself, it doesn't need the beta cycle. Once the criteria are met,
`develop` gets tagged (e.g. `v2.3.0`) which builds the `:latest` and `:v2.3.0`
Docker images.

The soak applies to the batch as a whole. Once a batch is being soaked, don't
tack new untested work onto it; that resets the testing clock. New features
wait for the next batch.

Then the cycle repeats: the next batch of complete feature branches is merged
into `develop` for testing.

#### Release Communication

When a minor or major release starts soaking on `develop`, two things happen:

1. **Bulletin announcement**: publish an announcement via the
   [bulletin repo](https://github.com/Dictionarry-Hub/bulletin) targeting the
   current stable version range. This reaches every running instance and lets
   users know a new release is available for testing on `:develop`.

2. **GitHub Discussion**: open a discussion in the profilarr repo summarizing
   what's in the batch, what to watch for, and where to report issues. Link
   this discussion from the announcement's `link` field so users go straight
   from the inbox to the feedback thread.

Both go out once `:develop` has rebuilt with the full batch merged. Don't
announce a planned release before there's something to test.

Patch releases that skip the soak (bug fixes, deps, docs) don't need either.
They're tagged as soon as CI passes and show up in the normal release notes.

#### Excluding Absorbed Fixes from Release Notes

If a fix only corrects a feature that has not reached stable yet, omit the fix
from the eventual release notes by adding this footer to the extended commit
message when squash merging the PR:

```text
changelog: ignore
```

`changelog: skip` works too; both spellings are matched.

For a commit that has already been merged without the footer, add its full SHA
to `.cliffignore`.

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

## Versioning

Version bumps are scoped to what the user achieves, not what the developer
changed. Define each feature by its atomic goal: the smallest user-facing unit
with a describable purpose. Version against that goal, not against the size of
the diff or whether the code is "new."

**Patch**: the goal stays the same; the how changes.

A number input's goal is "increase and decrease an integer." Adding
hold-to-change with an acceleration curve is a patch. The user still increases
and decreases an integer; the interaction just got smoother. New code, new
behavior, but same atomic plane.

**Minor**: the goal expands.

That same number input gains float support. The user can now do something they
couldn't before: work with decimal values. The atomic plane grew, even if the
code diff is small.

**Major**: the product-level contract breaks.

The PCD format changes and existing databases can't be read without migration.
The Docker volume layout changes and existing mounts break on upgrade. An entire
workflow gets removed that users built around. Major means the user's existing
setup stops working or requires manual intervention to continue. This is about
the application's contract with its users, not individual components.

A release batch takes the version of its highest-impact change. If any change
in the batch is a minor, the release is a minor. If every change is a patch,
the release is a patch.

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

### Fast patch release

The last minor (`v2.5.0`) is tagged. Since then, three small changes have landed
on `develop`: a dropdown clipping fix, a typo in an error message, and a
dependency bump. All three are low-risk and easy to verify yourself.

There's no feature in the batch and nothing risky, so it doesn't need a soak.
Once CI passes, you tag it:

```bash
git checkout develop
git pull
git tag v2.5.1
git push --tags
```

`:latest` and `:v2.5.1` build. It's a patch because the batch is only fixes. If
a feature had landed in the batch it would be a minor, and anything needing
verification would soak first.

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

## Reference

- `docs/ARCHITECTURE.md` - full codebase encyclopedia (modules, data flow, PCD)
- `docs/CONTRIBUTING.md` - how to submit changes, guidelines, conventions
- `deno task stats` - per-module code stats (TS/JS/Svelte/CSS/SQL/C#)
