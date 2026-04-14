# Utilities

**Source:** `src/lib/server/utils/`

Shared backend infrastructure used across the codebase. Each module is small
but foundational -- other subsystems extend or import these. This doc covers
the HTTP client, config, cache, markdown, Git, and TMDB utilities.

## Table of Contents

- [HTTP Client](#http-client)
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

Extended by:

| Client          | Source                          |
| --------------- | ------------------------------- |
| Arr clients     | `utils/arr/base.ts`             |
| Parser client   | `utils/arr/parser/client.ts`    |
| TMDB client     | `utils/tmdb/client.ts`          |
| Webhook clients | `notifications/notifiers/base/` |

## Config

**Source:** `utils/config/config.ts`

Singleton that reads environment variables and exposes application
configuration. Key properties:

| Property    | Source env         | Purpose                          |
| ----------- | ------------------ | -------------------------------- |
| `basePath`  | `APP_BASE_PATH`    | Data directory root              |
| `port`      | `PORT`             | Server port                      |
| `host`      | `HOST`             | Bind address                     |
| `authMode`  | `AUTH`             | `'on'`, `'off'`, or `'oidc'`     |
| `parserUrl` | `PARSER_HOST/PORT` | Parser microservice URL          |
| `oidc`      | `OIDC_*`           | OIDC discovery URL, client creds |
| `timezone`  | `TZ`               | Fallback to system timezone      |

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

**Source:** `utils/markdown/markdown.ts`

Two functions wrapping the `marked` library:

- `parseMarkdown(text)` -- converts Markdown to sanitized HTML. Sanitization
  prevents XSS from user-generated content.
- `stripMarkdown(text)` -- extracts plain text for previews and summaries.

Used for entity descriptions (quality profiles, custom formats) where users
can write Markdown.

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
