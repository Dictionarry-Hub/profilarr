# Flow Tests

**Source:** `tests/flows/`

Flow tests drive the built app in a real browser, the way a user would. They
check what the app stored, not only what the page shows. Each test gets its
own Profilarr instance with a fixtures database already linked. Tests run
offline, except the few tagged `@online`. For PCD behavior below the browser,
see [pcd-tests.md](./pcd-tests.md).

## Table of Contents

- [Running](#running)
- [Layout](#layout)
- [How a Test Runs](#how-a-test-runs)
- [Auth, SSO and Proxies](#auth-sso-and-proxies)
- [Adding a Scenario](#adding-a-scenario)
- [Adding a Helper](#adding-a-helper)
- [Adding a Fake Target](#adding-a-fake-target)
- [Updating the Fixtures](#updating-the-fixtures)

## Running

```bash
pnpm test:flows                    # every test
pnpm test:flows --grep "score"     # matching tests; any Playwright flag works
pnpm test:flows --ui               # Playwright UI mode at http://localhost:8080
pnpm test:flows --build            # rebuild the app first
pnpm test:flows --online           # give the container network, so @online tests run too
pnpm test:flows --quiet            # print only the end-of-run summary, no line per test
pnpm test:flows --deal=2/4         # the 2nd of 4 sets of spec files, as CI shard 2 runs
```

The suite runs in the official Playwright Docker image, so no browsers are
installed locally. The app binary is built only when it's missing. App changes
need `--build`, and test changes don't. `FLOWS_WORKERS` overrides the worker
count. By default it is half the CPU cores locally and 4 on CI. `FLOWS_VIDEO=1`
records a full-size video of each test. The trace viewer then plays the video
in place of its small screencast frames. Recording slows runs, so leave it off
unless you want to watch.

On CI, the suite is split across four `Flow Tests (n/4)` jobs. Each one runs
with `--deal=n/4` and `--online`. A deal splits the spec files by their recorded
run times in `harness/timings.json`. The slowest file goes first, each to the
shard with the least time so far, so every shard takes about as long. A file
with no recorded time counts as the average one. Playwright's `--shard` cuts
even blocks by count instead. The deal and the Playwright config skip the same
folders (`harness/specFiles.ts`).

`pnpm flows:timings [dir]` rewrites the timings from Playwright blob
reports. CI's are the `flow-blob-*` artifacts of a run, kept for a day:
`gh run download <run> --pattern 'flow-blob-*' --dir <dir>`. Refresh them when
the shards drift apart, e.g. after a big new area. An empty deal is an error, because
Playwright given no file runs the whole suite. `pnpm check` type-checks the
suite along with the unit tests. On CI the config adds
Playwright's blob reporter. Each shard uploads its blob report. The `Flow Tests`
job merges them and prints every result in one list. If any shard failed, the
job uploads the merged HTML report with traces. Then it fails. The `develop`
ruleset requires only this check.

## Layout

```text
tests/flows/
  playwright.config.ts   global-setup.ts   reporter.ts
  harness/      app processes, seeding, git, ports (helpers use it, specs don't)
  helpers/      what tests import, grouped by area, each with its spec beside it
    core/       test fixtures, forms, navigation, page data, screen sizes, job runs
    entities/   typed page data readers per entity
    sync/       Arr instances, the fake Arr and its targets, Sync page setup
    git/        database pull and publish, the local upstream
    auth/       local accounts, Settings › Security
    sso/        SSO providers
    proxy/      reverse proxies in front of an app
    settings/   Settings pages, such as Backups
  scenarios/    real user flows, by area
    arrs/   auth/   databases/   entities/<entity>/   sync/   git/   settings/   workflows/ (more than one area)
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
   `AUTH=off`, unless the spec's options change it (see
   [Auth, SSO and Proxies](#auth-sso-and-proxies)).
3. The container has no network unless the run passes `--online`. Either
   way, a per-test `gitconfig` rewrites the fixtures database's GitHub URL to
   a local bare repo. Linking, pulling and publishing reach that repo instead
   of GitHub.
4. Arr instances point at a fake Arr (`helpers/sync/fakeArr.ts`). The fake
   serves recorded API responses and keeps changes in memory.

## Auth, SSO and Proxies

A spec changes how its app starts with options:

```ts
test.use({
	appEnv: { AUTH: 'on' }, // environment over the defaults, applied last
	ssoProvider: 'fake', // an SSO provider, reached as the `sso` fixture
	appProxy: { tls: true } // a reverse proxy, reached as the `reverseProxy` fixture
});
```

- **Start order.** The provider and the proxy start first. The app then gets
  the provider's `OIDC_*` settings, and the proxy's address as `ORIGIN` and
  `baseURL`. Once the app is up, both get its address through `target`. The
  provider then accepts sign-ins that return to each of the app's origins, and
  the proxy forwards to it.
- **Origins.** `appOrigins` chooses what `ORIGIN` holds: `default` is the
  browser-facing address (the proxy's, else the app's), `unset` leaves it
  empty, and `direct-and-proxy` lists both the app's direct address and the
  proxy's, so one app answers on two origins. `appEnv.ORIGIN` overrides all
  three. A proxy's `publicHost` of `localhost` or `profilarr.test` gives it a
  different hostname from the app's `127.0.0.1`, so the two origins keep
  separate cookies. `profilarr.test` resolves to `127.0.0.1` inside the test
  container; use it for proxies that reserve `localhost` themselves.
- **Accounts.** `createAccount` makes the first account through the setup
  form. `signIn`, `signInWithSso` and `signOut` cover the rest
  (`helpers/auth/accounts.ts`).
- **SSO providers.** `helpers/sso/providers.ts` lists them. `fake` runs
  in the test process, registers only the app's exact callback URLs, and can
  misbehave on purpose. `authelia` runs Authelia in a container. Each entry
  lists the features it `supports`.
- **Reverse proxies.** `helpers/proxy/proxies.ts` lists them. `fake` can
  serve HTTPS, change request headers, cap response header size, or fail.
  `traefik`, `nginx-proxy-manager` and `swag` run the real proxy in a
  container. Each entry lists the options it `supports`. Entries marked
  `originOnly` only run in the origin scenarios, not in every proxied
  scenario through `proxySetups()`. A proxy readiness check accepts the app's
  `303` to first-run setup as well as `200` (`answeredByApp`).
- **Forward auth.** With `appProxy: { forwardAuth: true }`, the proxy asks
  the SSO provider before it forwards each request, and sends a signed-out
  browser to the provider's login page. Traefik and Authelia support it.
- **HTTPS.** HTTPS services serve the run's self-signed certificate
  (`harness/tls.ts`). It's a leaf certificate, because Deno rejects a
  self-signed CA. A provider gives it to the app as `NODE_EXTRA_CA_CERTS`, and
  the browser ignores certificate errors.
- **Real services.** Entries marked `needsDocker` run in a container that
  shares the test container's network namespace. They stay offline and reach
  the app on `127.0.0.1` (`harness/docker.ts`). `pnpm test:flows` mounts
  the Docker socket and pulls any missing images pinned in
  `tests/flows/services.Dockerfile`, which Dependabot keeps current. Their
  tests carry the `@docker` tag, and they're skipped when the host has no
  Docker socket. A failed test gets their logs attached.

## Adding a Scenario

- Put it in its area under `scenarios/`, or in `workflows/` when it crosses
  areas.
- Import with `#flows/`, or `./` for files beside or below the spec. Take
  `test` and `expect` from `#flows/helpers/core/test.ts`, and use helpers
  rather than the harness.
- Use `openPage` from `helpers/core/nav.ts` for full loads of Profilarr pages
  before interacting. It waits for the root layout's `data-hydrated` marker,
  set in `onMount`, so hydration cannot clear typed values. After a reload,
  call `waitForHydration`. Sidebar and account helpers already wait. These
  waits are for Profilarr pages, not SSO provider pages or proxy error responses.
- Check what the app stored through the typed readers or `pageData`, not only
  what an input shows.
- Read expected names and values from `fixture` and `fixtures`
  (`helpers/core/fixtureData.ts`), not literals.
- To cover the ways users reach the app, loop over `proxySetups()`
  (`helpers/proxy/proxies.ts`): no proxy, then each real proxy over HTTPS. A
  new real proxy then joins every such scenario.
- A test that reaches the internet carries `ONLINE_TAG` and calls
  `skipWithoutNetwork()` (`helpers/core/realServices.ts`), so it only runs
  with `--online`. To reach GitHub instead of the local bare repo, the spec
  sets `appEnv: { GIT_CONFIG_GLOBAL: '/dev/null' }`. An empty config drops
  the URL rewrite for that app. Keep such tests few. They depend on GitHub
  and count against its rate limits.
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

Real services, such as `authelia` and `traefik`, have no spec beside them.
The scenarios that run them are their tests.

## Adding a Fake Target

A target is one app at one API version, described in
`helpers/sync/targets.ts`. An entry holds the image, major version, API base,
recorded endpoints, how each path behaves, and capabilities. Add an entry,
then record it:

```bash
pnpm fixtures:arr sonarr-6
```

The recording starts a throwaway container. It fails if the container reports
a different major version. Helpers branch on capabilities, never versions.
The helper specs loop over every target, so a new target is covered without
other changes.

## Updating the Fixtures

```bash
pnpm fixtures:update [ref]
```

This replaces `data/fixtures` and `data/schema` from Dictionarry-Hub/fixtures
and rewrites the snapshot, `data/fixtures.json`. It fails if the ops don't
compile. Tests read names from the snapshot. Most fixture changes therefore
need no test edits.
