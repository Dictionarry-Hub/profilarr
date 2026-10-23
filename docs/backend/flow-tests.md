# Flow Tests

**Source:** `tests/flows/`

Flow tests drive the built app in a real browser, the way a user would. They
check what the app stored, not only what the page shows. Each test runs
offline against its own Profilarr instance, with a fixtures database already
linked. For PCD behavior below the browser, see [pcd-tests.md](./pcd-tests.md).

## Table of Contents

- [Running](#running)
- [Layout](#layout)
- [How a Test Runs](#how-a-test-runs)
- [Adding a Scenario](#adding-a-scenario)
- [Adding a Helper](#adding-a-helper)
- [Adding a Fake Target](#adding-a-fake-target)
- [Updating the Fixtures](#updating-the-fixtures)

## Running

```bash
deno task flows                    # every test
deno task flows --grep "score"     # matching tests; any Playwright flag works
deno task flows --ui               # Playwright UI mode at http://localhost:8080
deno task flows --build            # rebuild the app first
```

The suite runs in the official Playwright Docker image, so no browsers are
installed locally. The app binary is built only when it's missing. App changes
need `--build`, and test changes don't. `FLOWS_WORKERS` overrides the worker
count. By default it is half the CPU cores locally and 4 on CI.

On CI, the `Flow Tests` job type-checks the suite with `deno check tests/flows`
and runs it. When the job fails, it uploads the report and traces.

## Layout

```text
tests/flows/
  playwright.config.ts   global-setup.ts   reporter.ts
  harness/      app processes, seeding, git, ports (helpers use it, specs don't)
  helpers/      what tests import, grouped by area, each with its spec beside it
    core/       test fixtures, forms, navigation, page data, screen sizes
    entities/   typed page data readers per entity
    sync/       Arr instances, the fake Arr and its targets, Sync page setup
    git/        database pull and publish, the local upstream
  scenarios/    real user flows, by area
    entities/<entity>/   sync/   git/   workflows/ (more than one area)
  data/         vendored fixtures, their snapshot, recorded Arr responses
```

A new area gets its folder with its first test. The reporter prints a tree of
these folders with a pass count for each.

## How a Test Runs

1. Global setup builds a golden data folder once per run. It migrates an
   empty app, seeds the fixtures database, and starts the app once to compile
   it.
2. Each test's `app` fixture copies the golden folder and points the copy's
   database rows at its own repos. It then starts the app on a free port with
   `AUTH=off`.
3. The container has no network. A per-test `gitconfig` rewrites the fixtures
   database's GitHub URL to a local bare repo. Pulling and publishing reach
   that repo instead of GitHub.
4. Arr instances point at a fake Arr (`helpers/sync/fakeArr.ts`). The fake
   serves recorded API responses and keeps changes in memory.

## Adding a Scenario

- Put it in its area under `scenarios/`, or in `workflows/` when it crosses
  areas.
- Import with the `$flows/` alias only. Take `test` and `expect` from
  `$flows/helpers/core/test.ts`, and use helpers rather than the harness.
- Check what the app stored through the typed readers or `pageData`, not only
  what an input shows.
- Read expected names and values from `fixture` and `fixtures`
  (`helpers/core/fixtureData.ts`), not literals.
- Pin a known app bug with `test.fail()` and a one-line comment.

### Describing a Test

Every spec explains itself in its own file, so a reader never needs another
document:

- **File header.** A short bulleted list of what the file protects, such as
  the threat and the defence for a security spec.
- **Comment before each test.** A numbered **Flow** with the steps a user
  takes, then a bulleted **Expects** with what must be true afterwards.
- **Title.** Name the behaviour under test, not the steps that reach it. For
  example, "when client-rendered" rather than "after a sidebar click".

```ts
/**
 * Flow:
 * 1. The developer commits a custom format description holding the payload.
 * 2. The user pulls it on the Changes tab.
 * 3. The user opens Custom Formats and reloads, so the server renders the
 *    page (SSR).
 *
 * Expects:
 * - the description renders
 * - no <img onerror> reaches the page
 * - the handler never runs
 * - the payload shows as plain text
 */
test("don't run embedded HTML when server-rendered", async ({ app, page }) => {
```

### Making the Checks Count

- Set up state the way a real user gets it. A database change arrives as an
  upstream commit that the user pulls, not as a row written into the database.
- Check that the page rendered what's under test before checking that
  something is absent. Otherwise an empty page passes.
- Order the checks so the most important check fails first. Give each check
  an `expect` message that names it. A failure then says what broke.
- For a security spec, confirm once that it fails with the defence switched
  off. A spec that can't fail proves nothing.

## Adding a Helper

Put the helper in the `helpers/` area it serves, with a header comment. Wrap
its body in `test.step(..., { box: true })`, so a failure points at the line
that called it. Add a spec beside the helper that proves it works on a real
page.

## Adding a Fake Target

A target is one app at one API version, described in
`helpers/sync/targets.ts`. An entry holds the image, major version, API base,
recorded endpoints, how each path behaves, and capabilities. Add an entry,
then record it:

```bash
deno task fixtures:arr sonarr-6
```

The recording starts a throwaway container. It fails if the container reports
a different major version. Helpers branch on capabilities, never versions.
The helper specs loop over every target, so a new target is covered without
other changes.

## Updating the Fixtures

```bash
deno task fixtures:update [ref]
```

This replaces `data/fixtures` and `data/schema` from Dictionarry-Hub/fixtures
and rewrites the snapshot, `data/fixtures.json`. It fails if the ops don't
compile. Tests read names from the snapshot. Most fixture changes therefore
need no test edits.
