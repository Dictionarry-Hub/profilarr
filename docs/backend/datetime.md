# Date and Time

**Source:** `src/lib/shared/utils/dates.ts`, `src/lib/client/stores/timezone.ts`

## Table of Contents

- [Principles](#principles)
- [Layers](#layers)
  - [Database](#database)
  - [Query Layer](#query-layer)
  - [API](#api)
  - [Frontend](#frontend)
- [Timezone Store](#timezone-store)
- [Formatting](#formatting)
- [Lint Enforcement](#lint-enforcement)

## Principles

Three rules govern how Profilarr handles time:

1. **Store UTC.** The database and API deal exclusively in UTC. No local
   timestamps enter the persistence layer.
2. **Transport UTC.** Every `date-time` field in the API is an ISO 8601 string
   with a `Z` suffix. API consumers are responsible for converting to their
   local timezone.
3. **Display in server TZ.** The frontend converts UTC timestamps to the
   server's configured timezone (`TZ` environment variable) before rendering.
   Browser-local time is never used.

## Layers

### Database

All timestamp columns are `TEXT`. Two formats coexist:

| Format          | Source                           | Example                    |
| --------------- | -------------------------------- | -------------------------- |
| ISO 8601 with Z | `new Date().toISOString()` in TS | `2026-04-19T14:30:45.123Z` |
| Bare UTC        | SQLite `CURRENT_TIMESTAMP`       | `2026-04-19 14:30:45`      |

Both are UTC. The difference is cosmetic: bare timestamps lack the `T`
separator and `Z` suffix, so `new Date()` in JavaScript may misinterpret
them as local time.

`CURRENT_TIMESTAMP` is used extensively in column defaults and UPDATE
statements across the query layer (~90 call sites). The values it produces
are correct but ambiguous. Migrating all existing data and rewriting every
query site to use `toISOString()` was evaluated and rejected -- the blast
radius is large and the data itself is fine. Instead, the query layer
normalizes timestamps on the way out. New code should use
`new Date().toISOString()` for writes. `CURRENT_TIMESTAMP` is not banned
but is discouraged for new work.

When comparing timestamps in SQL, normalize with `replace()` so both
formats work with `datetime()`:

```sql
datetime(replace(replace(run_at, 'T', ' '), 'Z', '')) <= datetime('now')
```

### Query Layer

The query layer is where normalization happens. Query functions call
`toUTC()` on timestamp fields before returning, so every caller -- API
routes and page server load functions alike -- receives clean ISO 8601
strings with a `Z` suffix. No downstream code needs to worry about which
format the database used.

```ts
import { toUTC } from '$shared/utils/dates';

function rowToRecord(row: SomeRow): SomeRecord {
	return {
		createdAt: toUTC(row.created_at),
		startedAt: toUTC(row.started_at)
		// ...
	};
}
```

This is the single normalization boundary. Components, API handlers, and
page servers never call `toUTC()` directly.

### API

Every `date-time` field in the OpenAPI spec is UTC ISO 8601 with a `Z`
suffix. Because the query layer normalizes on read, API routes relay
timestamps directly without further transformation.

External timestamps from Radarr and Sonarr (e.g. `added`, `firstAired`)
are passed through as-is. These are already ISO 8601 from the upstream
APIs.

The `/api/v1/status` endpoint includes a `timezone` field so clients can
discover the server's configured TZ without a separate call:

```json
{
  "timezone": "Asia/Kuala_Lumpur",
  "sync": { ... },
  "jobs": { ... }
}
```

### Frontend

The frontend receives normalized UTC strings from page server load
functions (which get them from the query layer). It converts these to the
server's configured timezone for display using the `timezone` store
(populated from `/api/v1/status` on app startup) and `Intl.DateTimeFormat`
with the `timeZone` option. Browser-local time is never used.

All date display goes through a single formatting function. Raw calls to
`Date.toLocaleString()`, `toLocaleDateString()`, or `toLocaleTimeString()`
are banned in Svelte files (see [Lint Enforcement](#lint-enforcement)).

## Timezone Store

```
src/lib/client/stores/timezone.ts
```

A read-only store that holds the IANA timezone string from the server. It is
initialized once during app startup from the `/api/v1/status` response and
does not change for the lifetime of the session.

```ts
import { serverTimezone } from '$stores/timezone';

// In a component
const tz = $serverTimezone; // "Asia/Kuala_Lumpur"
```

The store is the single source of truth for what timezone to display dates in.
Components never hardcode a timezone or read it from `Intl.DateTimeFormat()
.resolvedOptions()`.

## Formatting

```
src/lib/shared/utils/dates.ts
```

Two categories of function:

**Normalization.** `toUTC()` and `parseUTC()` handle the SQLite
bare-timestamp problem described in [Database](#database). Called in the
query layer only (see [Query Layer](#query-layer)).

**Display.** `formatDateTime()`, `formatDate()`, and `formatRelative()`
accept a UTC timestamp string and the server timezone, and return a
human-readable string. These are the only functions that produce text shown
to users. Called in Svelte components only.

```ts
import { formatDateTime } from '$shared/utils/dates';
import { serverTimezone } from '$stores/timezone';

const display = formatDateTime(job.createdAt, $serverTimezone);
// "4/19/2026, 10:30:45 PM"  (in Asia/Kuala_Lumpur)
```

Relative-time helpers (`2h ago`, `in 5m`) compare against `Date.now()` in
UTC, so they are timezone-agnostic and do not need the store.

## Lint Enforcement

```
scripts/lint/datetime.ts
```

A standalone lint script with two scopes:

**Query layer** (`src/lib/server/db/queries/*.ts`). Every timestamp column
in the schema follows the `_at` suffix convention (see `schema.sql`). The
linter checks that `_at` fields in row-to-record mappings are wrapped in
`toUTC()`. A bare assignment like `createdAt: row.created_at` is a
violation; `createdAt: toUTC(row.created_at)` passes.

**Svelte files** (`src/routes/**/*.svelte`). Two rules:

1. **No raw locale methods.** `.toLocaleString()`, `.toLocaleDateString()`,
   and `.toLocaleTimeString()` are banned. Use the display functions from
   `$shared/utils/dates` instead.
2. **No raw `new Date(x)` for display.** Constructing a Date from a server
   string and immediately rendering it (e.g. `{new Date(row.timestamp)}`)
   bypasses timezone conversion. Use `formatDateTime()` or `formatDate()`.

All rules can be suppressed with the standard escape hatch:

```svelte
<!-- lint-disable-next-line no-raw-dates -- reason -->
```
