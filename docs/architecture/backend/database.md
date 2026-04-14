# App Database

**Source:** `src/lib/server/db/` (db.ts, migrations.ts, migrations/, queries/)

The app database (`profilarr.db`) is a SQLite file that stores all application
state: Arr instances, settings, job queue, notifications, sessions, and PCD ops.
It uses a singleton `DatabaseManager`, migration-based schema management, and
raw SQL query modules with parameter binding. Kysely is not
used here -- it's reserved for the PCD cache (see [pcd.md](./pcd.md)).

## Table of Contents

- [Initialization](#initialization)
- [Schema](#schema)
- [Migrations](#migrations)
  - [Adding a Migration](#adding-a-migration)
- [Query Layer](#query-layer)

## Initialization

The database initializes early in the server startup sequence
(`src/hooks.server.ts`):

1. `config.init()` -- ensure data directories exist
2. `db.initialize()` -- open SQLite connection, set pragmas
3. `runMigrations()` -- apply pending schema changes
4. Load log settings, initialize PCD manager, start job queue

Three pragmas are set on every connection:

| Pragma         | Value    | Purpose                             |
| -------------- | -------- | ----------------------------------- |
| `foreign_keys` | `ON`     | Enforce referential integrity       |
| `journal_mode` | `WAL`    | Write-Ahead Logging for concurrency |
| `synchronous`  | `NORMAL` | Balanced performance/safety         |

The manager includes **HMR recovery** for development: `isHealthy()` runs
`SELECT 1` to verify the connection is alive. If the check fails during
initialization (common after Vite hot reloads), the manager closes and
reinitializes the connection.

**Transaction support** is available via `transaction<T>(fn)`, an async wrapper
that auto-commits on success and auto-rollbacks on error. Raw
`beginTransaction()`, `commit()`, and `rollback()` methods are also exposed.

## Schema

`src/lib/server/db/schema.sql` is a **reference snapshot** of the current
schema after all migrations have been applied. Its header reads:

> DO NOT execute this file directly -- use migrations instead.

The file is useful for understanding the final table structure, reviewing
database design, and onboarding new contributors. It is not used at runtime.
**Migrations are the source of truth** for schema changes.

## Migrations

**Source:** `src/lib/server/db/migrations/` (sequentially numbered `NNN_*.ts`)
**Runner:** `src/lib/server/db/migrations.ts`

Each migration exports an object matching the `Migration` interface:

| Field     | Required | Purpose                                       |
| --------- | -------- | --------------------------------------------- |
| `version` | yes      | Sequential number (001, 002, ...)             |
| `name`    | yes      | Human-readable description                    |
| `up`      | yes      | SQL to apply the migration                    |
| `down`    | no       | SQL to roll back (omit if not rollbackable)   |
| `afterUp` | no       | Callback for data migrations after schema DDL |

The runner applies pending migrations in version order. Each `up` block runs
inside a transaction. The `afterUp` callback runs outside the transaction,
which is useful for data migrations that need the new schema committed first.

A `migrations` table tracks applied versions with timestamps. The runner
supports `up` (apply pending), `down` (roll back to target version), and
`fresh` (reset and reapply all).

### Adding a Migration

1. Review `migrations/_template.ts` as your starting point.
2. Number sequentially after the highest existing migration.
3. Write the `up` SQL. Provide `down` if the migration is rollbackable.
4. Add the import and entry in `migrations.ts` inside `loadMigrations()`.
5. Test both fresh (`db.fresh()`) and incremental application.
6. Update `schema.sql` to reflect the new state.

**Rule:** Never modify an already-applied migration. If a migration has a bug,
create a new migration to fix it.

## Query Layer

**Source:** `src/lib/server/db/queries/`

Each module covers one database table and exports a queries object with typed methods.
All use raw SQL with `?` parameter binding and typed input/output interfaces.

| Module                 | Domain                              |
| ---------------------- | ----------------------------------- |
| `arrInstances`         | Arr instance CRUD                   |
| `arrSync`              | Sync config and status per instance |
| `arrCleanupSettings`   | Stale config cleanup settings       |
| `arrRenameSettings`    | Rename job settings per instance    |
| `authSettings`         | Session duration, API key           |
| `sessions`             | Session CRUD and cleanup            |
| `jobQueue`             | Job queue CRUD, claim, reschedule   |
| `jobRunHistory`        | Job execution history               |
| `pcdOps`               | PCD operation CRUD and filtering    |
| `pcdOpHistory`         | Per-compile op application results  |
| `notificationServices` | Notification service config         |
| `logSettings`          | Log level and output settings       |
| `renameRuns`           | Rename job run history              |
| `upgradeRuns`          | Upgrade job run history             |
| `parsedReleaseCache`   | Parser result cache                 |
| `patternMatchCache`    | Regex match result cache            |
| `githubCache`          | GitHub API response cache           |
| `tmdbSettings`         | TMDB API key storage                |
| `aiSettings`           | AI service settings                 |
| `appInfo`              | App metadata and setup state        |

Query methods follow a consistent pattern: typed input interfaces for
mutations, generic return types for reads, and the singleton `db` instance
for all operations.
