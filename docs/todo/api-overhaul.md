# API Overhaul

## Why

The current API grew organically — routes were added as features were built
without thinking about structure, naming, or consistency. Endpoints are split
across three "eras" (legacy page routes, unversioned `/api/`, and `/api/v1/`)
with no consistent resource naming, ad-hoc nesting, and internal helpers mixed
in with public endpoints.

## Current Structure

### Legacy (outside `/api/`)

| Method | Route                 | Purpose                      |
| ------ | --------------------- | ---------------------------- |
| POST   | `/arr/test`           | Test arr instance connection |
| GET    | `/auth/logout`        | Destroy session + redirect   |
| GET    | `/auth/oidc/login`    | Start OIDC flow              |
| GET    | `/auth/oidc/callback` | OIDC callback                |

### Unversioned `/api/`

| Method | Route                                         | Purpose                        |
| ------ | --------------------------------------------- | ------------------------------ |
| GET    | `/api/ai/status`                              | Check if AI is configured      |
| GET    | `/api/backups/download/[filename]`            | Download backup file           |
| GET    | `/api/databases`                              | List all linked databases      |
| GET    | `/api/databases/[id]/changes`                 | Git status + draft changes     |
| GET    | `/api/databases/[id]/commits`                 | Commit history                 |
| POST   | `/api/databases/[id]/generate-commit-message` | AI commit message from diff    |
| GET    | `/api/github/avatar/[owner]`                  | Proxy + cache GitHub avatar    |
| GET    | `/api/regex101/[id]`                          | Fetch regex101 pattern + tests |
| GET    | `/api/tmdb/search`                            | Search TMDB                    |
| POST   | `/api/tmdb/test`                              | Validate TMDB API key          |

### Versioned `/api/v1/`

| Method | Route                             | Purpose                                  |
| ------ | --------------------------------- | ---------------------------------------- |
| GET    | `/api/v1/health`                  | System health check                      |
| GET    | `/api/v1/openapi.json`            | Serve OpenAPI spec                       |
| GET    | `/api/v1/arr/library`             | Get arr library (`?instanceId=`)         |
| DELETE | `/api/v1/arr/library`             | Invalidate library cache                 |
| GET    | `/api/v1/arr/library/episodes`    | Get episodes (`?instanceId=&seriesId=`)  |
| GET    | `/api/v1/arr/releases`            | Search releases (`?instanceId=&itemId=`) |
| POST   | `/api/v1/arr/cleanup`             | Scan/execute stale config cleanup        |
| POST   | `/api/v1/arr/sync-entity`         | Push single entity to arr                |
| GET    | `/api/v1/pcd/export`              | Export entity as JSON                    |
| POST   | `/api/v1/pcd/import`              | Import portable entity                   |
| POST   | `/api/v1/entity-testing/evaluate` | Evaluate releases against CFs            |
| POST   | `/api/v1/regex/validate`          | Validate regex via parser                |

## Internal vs Public Routes

### The split

Not every endpoint should be part of the public API. Some routes exist only to
support the Profilarr UI — proxying requests to external services, testing
connections, fetching avatars. Exposing these publicly adds attack surface for
no benefit.

```
/api/v1/*         → public API, documented in OpenAPI, stable contract
/api/internal/*   → UI-only, not versioned, can change freely
```

### Auth rule

Public and internal routes use different auth:

- **`/api/v1/*`** — accepts session cookie OR `X-Api-Key` header
- **`/api/internal/*`** — accepts session cookie ONLY

This is enforced in the auth middleware by path prefix. If a request to
`/api/internal/*` carries an API key but no session, it gets a 403.

The session cookie proves the request came from a logged-in browser session.
SvelteKit's built-in CSRF protection (Origin header check on mutations) ensures
it came from our origin. Together, these guarantee that only the Profilarr UI
can call internal routes — no extra tokens or signing needed.

### What goes where

**Internal** — UI helpers, proxies, connection tests:

| Method | Route                                 | Purpose                        |
| ------ | ------------------------------------- | ------------------------------ |
| POST   | `/api/internal/arr/test`              | Test arr instance connection   |
| GET    | `/api/internal/github/avatar/{owner}` | Proxy + cache GitHub avatar    |
| GET    | `/api/internal/regex101/{id}`         | Fetch regex101 pattern + tests |
| GET    | `/api/internal/ai/status`             | Check if AI is configured      |
| GET    | `/api/internal/tmdb/search`           | Search TMDB                    |
| POST   | `/api/internal/tmdb/validate-key`     | Validate TMDB API key          |

**Public** — everything else under `/api/v1/`

### Why not form actions?

SvelteKit form actions are the strongest option — there's no URL to hit
externally. But they don't support fetch-based UX (loading spinners, progress
indicators) without extra wiring. For operations where the UI needs async
feedback (library loading, connection tests), `+server.ts` routes behind
session-only auth are the right tradeoff.
