# Utilities

**Source:** `src/lib/server/utils/`

Shared backend infrastructure used across the codebase. Each module is small
but foundational -- other subsystems extend or import these. This doc covers
the HTTP client, outbound proxy, trusted certificates, config, cache, markdown,
Git, and TMDB utilities.

## Table of Contents

- [HTTP Client](#http-client)
- [Arr Basic Auth](#arr-basic-auth)
- [Arr Version Detection](#arr-version-detection)
- [Outbound Proxy](#outbound-proxy)
- [Trusted Certificates](#trusted-certificates)
- [Config](#config)
- [Cache](#cache)
- [Markdown](#markdown)
- [Git](#git)
- [TMDB](#tmdb)

## HTTP Client

**Source:** `utils/http/` (BaseHttpClient, HttpError)

`BaseHttpClient` is the generic HTTP foundation. It provides typed methods
(`get`, `post`, `put`, `delete`, `patch`) with automatic JSON
serialization/parsing, connection pooling via `Deno.createHttpClient`, and
request timeouts using `AbortController`.

Retry logic uses exponential backoff for transient failures (5xx status codes
by default, configurable). Each subclass can override the retry status codes,
delay, and max attempts.

`HttpError` standardizes failures with status code, response body, and cause
chain.

A body that isn't JSON on an error status is kept as text, so the status error
is what callers see. A successful `text/html` answer to a JSON request throws
`HtmlResponseError`, which names the host that answered and whether a redirect
led there. This is usually a reverse proxy login page, such as Authelia
redirecting an unauthenticated request to its portal. Its message is safe to
show, and the Arr connection test returns it to the UI.

Extended by:

| Client          | Source                          |
| --------------- | ------------------------------- |
| Arr clients     | `utils/arr/base.ts`             |
| Parser client   | `utils/arr/parser/client.ts`    |
| TMDB client     | `utils/tmdb/client.ts`          |
| Webhook clients | `notifications/notifiers/base/` |

## Arr Basic Auth

**Source:** `utils/arr/base.ts`, `utils/arr/factory.ts`,
`src/lib/shared/arr/basicAuth.ts`

An Arr instance behind a reverse proxy can store a Basic Auth username and
password. `BaseArrClient` then sends an `Authorization: Basic` header alongside
`X-Api-Key` on every request, so the proxy lets the request through and the
Arr still checks its key.

Every client built from a stored instance must take its options from
`arrClientOptionsFromInstance()`, passing any timeout or retry overrides
through it. A client built without it reaches an unproxied instance but fails
behind the proxy.

The credentials are saved as a pair. `basicAuthPairError()` rejects a username
without a password or the reverse, and the query layer, both instance form
actions and the instance form all use it. See
[security.md](./security.md#secrets-follow-their-destination) for what happens
to them when the URL changes.

## Arr Version Detection

**Source:** `utils/arr/base.ts` (`detectVersion`), `utils/arr/version.ts`,
`src/lib/shared/arr/capabilities.ts`

Sonarr v5 keeps quality size limits on quality profile items instead of the
global quality definitions, so sync and the UI need to know which generation
an instance speaks. `BaseArrClient.detectVersion()` reads `appName` and
`version` from `/api/{version}/system/status`, then asks the unversioned
`GET /api` which generation is `current` (`v3` on Sonarr v4 and Radarr, `v5`
on Sonarr v5). A missing or non-JSON `/api` answer is not an error; the
version major is the fallback.

`probeAndRecordVersion()` runs the probe and stores the answer in
`arr_instances.detected_version`, `detected_api` and `detected_at` through
`recordDetectedVersion()`. It never throws: a failed probe is logged and the
stored values keep their last good answer. It runs wherever a client is about
to read or write config: instance create, the settings form when the URL or key
changes, every sync job and entity resync, drift, and the `arr.version.check`
job at boot. The Test button calls `detectVersion()` and
`recordDetectedVersion()` itself, so it can report why a probe failed.
Pages read the stored columns; writers trust the live probe.

`hasProfileItemSizes()` and `isExperimentalVersion()` in
`src/lib/shared/arr/capabilities.ts` derive capabilities from those columns
for server and UI alike. Today both are true only for Sonarr whose current API
is v5 or later (or, without an `/api` answer, whose version major is 5 or
later).

## Outbound Proxy

**Source:** `utils/http/proxy.ts`, `utils/logger/startup.ts`

Profilarr has no proxy setting of its own. Deno applies the standard
`HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, and `NO_PROXY` variables to every
fetch, including `Deno.createHttpClient` clients, and git reads them too. That
covers GitHub, PCD operations, notifications, and TMDB.

```yaml
environment:
  - HTTPS_PROXY=http://user:pass@gluetun:8888
  - NO_PROXY=localhost,127.0.0.1,parser,radarr,sonarr
```

- Proxy URLs take the form `scheme://user:pass@host:port`, where the scheme is
  `http`, `socks5`, or `socks5h`. `socks5h` sends DNS lookups through the
  proxy too.
- Special characters in the username and password must be URL-encoded (`@` as
  `%40`, `:` as `%3A`).
- `NO_PROXY` takes host names, IPs, and ranges (e.g. `192.168.1.0/24`). Arr
  instances and the parser belong there; unlisted hosts are sent to the proxy,
  which usually can't reach them. `HTTP_PROXY` and `ALL_PROXY` also cover
  `http://` addresses, so this matters most when either is set.

`getProxyEnv()` reads the same variables (uppercase first, then lowercase, like
Deno) and reduces each proxy URL to `scheme://host:port`, masking any login as
`***@`. At startup,
`logProxyConfig()` logs the result and warns when a URL can't be parsed or
`NO_PROXY` is empty. Credentials are never logged.

## Trusted Certificates

Profilarr has no certificate setting of its own. The runtime reads the standard
`NODE_EXTRA_CA_CERTS` variable and trusts the certificates in the PEM file it
names, on top of its built-in public roots. Plain `fetch` and `BaseHttpClient`
both use them, so the variable covers Arr instances, OIDC discovery,
notifications, and TMDB.

```yaml
environment:
  - NODE_EXTRA_CA_CERTS=/certs/ca.pem
volumes:
  - ./certs/ca.pem:/certs/ca.pem:ro
```

- For a private CA, the file holds the CA's certificate. For a self-signed
  server, it holds the server's own certificate. Several certificates can share
  one file.
- If the path is wrong, the runtime logs a warning to the container output and
  Profilarr starts without the extra certificates.
- The entrypoint isn't involved, so root and non-root containers behave the
  same.
- Deno rejects a self-signed certificate marked as a CA (`CA:TRUE`, the
  `openssl req -x509` default) with `CaUsedAsEndEntity`, even when
  `NODE_EXTRA_CA_CERTS` includes it. Node and OpenSSL clients such as curl
  accept it. Users have to recreate the certificate with `CA:FALSE`.
- Git doesn't read the variable. PCD repositories must be on GitHub, which uses
  a public CA.
- There is no option to skip certificate verification. Skipping it would send
  Arr API keys to whatever answers at the address.

## Config

**Source:** `utils/config/config.ts`

Singleton that reads environment variables and exposes application
configuration. Key properties:

| Property      | Source env         | Purpose                          |
| ------------- | ------------------ | -------------------------------- |
| `basePath`    | `APP_BASE_PATH`    | Data directory root              |
| `port`        | `PORT`             | Server port                      |
| `host`        | `HOST`             | Bind address                     |
| `authMode`    | `AUTH`             | `'on'` or `'off'`                |
| `parserUrl`   | `PARSER_HOST/PORT` | Parser microservice URL          |
| `oidc`        | `OIDC_*`           | OIDC discovery URL, client creds |
| `oidcEnabled` | `OIDC_*`           | All three set and `AUTH=on`      |
| `timezone`    | `TZ`               | Fallback to system timezone      |

The `paths` object computes derived directories (logs, database, backups,
data) from `basePath`. `init()` creates all required directories at startup
and is the first call in `hooks.server.ts`.

## Cache

**Source:** `utils/cache/cache.ts`

In-memory key-value cache with per-entry TTL. Backed by a `Map` with
timestamp-based expiration checked on access.

| Method                   | Purpose                      |
| ------------------------ | ---------------------------- |
| `get<T>(key)`            | Retrieve, auto-expire if old |
| `set<T>(key, data, ttl)` | Store with TTL in seconds    |
| `delete(key)`            | Remove single entry          |
| `deleteByPrefix(prefix)` | Bulk remove by key prefix    |
| `clear()`                | Empty entire cache           |

## Markdown

**Source:** `src/lib/shared/utils/markdown.ts`

There is no server-only markdown helper. `renderMarkdown(text, { inline, links })`
is shared code, imported by server load functions and components alike, so the
server-rendered page and the browser produce the same HTML. It is the only
place `marked` is imported; see
[security.md](./security.md#xss-via-markdown--html) for what it enforces.

## Git

**Source:** `utils/git/` (exec.ts, read.ts, write.ts, types.ts)

Three layers for Git repository operations:

**exec.ts** -- runs git commands in a sandboxed environment. Sets
`GIT_TERMINAL_PROMPT=0` to prevent interactive prompts, applies configurable
timeouts, and captures stdout/stderr.

**read.ts** -- read-only operations:

| Function               | Returns                        |
| ---------------------- | ------------------------------ |
| `getBranch()`          | Current branch name            |
| `getBranches()`        | All local branches             |
| `getStatus()`          | Working tree status            |
| `checkForUpdates()`    | Whether remote has new commits |
| `getIncomingChanges()` | Commit list from remote        |
| `getCommits()`         | Commit history with metadata   |
| `getDiff()`            | File-level diff output         |

**write.ts** -- mutating operations (clone, fetch, pull, push, commit) with
GitHub API integration. Handles rate limiting, authentication failures, and
private repository detection. Credentials are injected into remote URLs for
authenticated operations.

Used by the PCD manager for all repository operations: linking databases,
pulling updates, pushing exports, and displaying branch/commit info in the UI.

## TMDB

**Source:** `utils/tmdb/client.ts`

`TMDBClient` extends `BaseHttpClient` with TMDB API v3 endpoints:

| Method            | Purpose                         |
| ----------------- | ------------------------------- |
| `validateKey()`   | Check API key validity          |
| `searchMovies()`  | Search movies with pagination   |
| `searchTVShows()` | Search TV shows with pagination |

Uses bearer token authentication and defaults to `en-US` language. Used by
[entity testing](./pcd-entities.md#entity-testing) for adding test movies and
series via TMDB search.
