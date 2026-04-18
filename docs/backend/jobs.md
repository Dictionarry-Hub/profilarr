# Job System

## Table of Contents

- [Overview](#overview)
- [Job Types](#job-types)
- [Lifecycle](#lifecycle)
  - [Initialization](#initialization)
  - [Scheduling](#scheduling)
  - [Dispatch](#dispatch)
  - [Execution](#execution)
  - [Completion](#completion)
- [Scheduling Mechanisms](#scheduling-mechanisms)
  - [Cron](#cron)
  - [Fixed Interval](#fixed-interval)
  - [Named Schedules](#named-schedules)
  - [Manual Triggers](#manual-triggers)
- [Deduplication & Locking](#deduplication--locking)
- [Error Handling & Recovery](#error-handling--recovery)
- [Database Schema](#database-schema)
- [Real-Time Updates (SSE)](#real-time-updates-sse)
  - [Server Side](#server-side)
  - [Client Side](#client-side)
- [Handlers](#handlers)
  - [Arr Sync](#arr-sync)
  - [Arr Upgrade](#arr-upgrade)
  - [Arr Rename](#arr-rename)
  - [Arr Cleanup](#arr-cleanup)
  - [Arr Library Refresh](#arr-library-refresh)
  - [PCD Sync](#pcd-sync)
  - [Backup Create](#backup-create)
  - [Backup Cleanup](#backup-cleanup)
  - [Logs Cleanup](#logs-cleanup)
- [Settings UI](#settings-ui)

## Overview

Profilarr uses an event-driven job queue for background tasks: syncing
configuration to Arr instances, creating backups, running upgrades, renaming
files, and cleaning up old data. The system is built around a SQLite-backed
queue with a single-threaded dispatcher that processes jobs sequentially.

The dispatcher does not poll. It calculates the delay until the next job is due
and sets a timeout. When a new job is enqueued, the dispatcher is notified and
recalculates if needed. This means zero CPU usage when idle and immediate
execution when jobs are due.

Jobs are strictly serial: one job runs at a time. The dispatcher claims and
executes jobs in a loop, only sleeping when no jobs are due. This simplifies
concurrency and makes the system deterministic.

## Job Types

| Job Type                   | Purpose                             | Payload          | Scheduled |
| -------------------------- | ----------------------------------- | ---------------- | --------- |
| `arr.sync`                 | Combined sync (legacy)              | `{ instanceId }` | Yes       |
| `arr.sync.qualityProfiles` | Sync quality profiles to Arr        | `{ instanceId }` | Yes       |
| `arr.sync.delayProfiles`   | Sync delay profiles to Arr          | `{ instanceId }` | Yes       |
| `arr.sync.mediaManagement` | Sync media management to Arr        | `{ instanceId }` | Yes       |
| `arr.upgrade`              | Automated quality upgrades          | `{ instanceId }` | Yes       |
| `arr.rename`               | Bulk file/folder rename             | `{ instanceId }` | Yes       |
| `arr.cleanup`              | Remove stale configs from Arr       | `{ instanceId }` | Yes       |
| `arr.library.refresh`      | Refresh cached library data         | `{ instanceId }` | Yes       |
| `pcd.sync`                 | Check/pull PCD database updates     | `{ databaseId }` | Yes       |
| `backup.create`            | Create backup archive               | `{}`             | Yes       |
| `backup.cleanup`           | Delete old backups past retention   | `{}`             | Yes       |
| `logs.cleanup`             | Delete old log files past retention | `{}`             | Yes       |

## Lifecycle

### Initialization

On server startup (`hooks.server.ts`), `initializeJobs()` runs:

1. **Recovery** - any jobs stuck in `running` (from a crash) are reset to
   `queued` so they can retry.
2. **Schedule rebuild** - all scheduled jobs are created or updated from current
   config (instances, databases, settings).
3. **Dispatcher start** - the dispatcher begins watching for due jobs.

### Scheduling

Schedule functions read config from the database (sync triggers, cron
expressions, intervals) and create or update queue entries using
`upsertScheduled()`. Each scheduled job has a `dedupeKey` that prevents
duplicates. When config changes (user saves settings), the relevant schedule
function runs again to update the job's `run_at`.

### Dispatch

The dispatcher uses timeout-based scheduling:

1. Query the next queued job (earliest `run_at`).
2. Calculate delay: `max(0, run_at - now)`.
3. Set a `setTimeout` for that delay.
4. When the timeout fires, enter the execution loop.

If a new job is enqueued with an earlier `run_at` than the current timeout, the
dispatcher is notified via `notifyJobEnqueued()` and recalculates.

### Execution

The execution loop (`runDueJobs`) runs until no more due jobs remain:

1. **Claim** - `claimNextDue()` atomically finds the next due job and sets its
   status to `running`. This is a conditional UPDATE (WHERE status = 'queued')
   to prevent double-claiming.
2. **Lookup** - find the handler function in the registry by job type.
3. **Run** - call the handler with the full job record. The handler is async and
   returns a `JobHandlerResult`.
4. **Emit** - push SSE events to connected browsers (sync jobs only).
5. **Record** - write a `job_run_history` row with status, duration, output, and
   error.
6. **Finish** - either reschedule (if handler returned `rescheduleAt`) or mark
   the job as success/failed/cancelled.

### Completion

Handlers return one of four statuses:

| Status      | Meaning                                               | Queue Status |
| ----------- | ----------------------------------------------------- | ------------ |
| `success`   | Job completed normally                                | `success`    |
| `skipped`   | Job had nothing to do (e.g. no old backups)           | `success`    |
| `failure`   | Job encountered an error                              | `failed`     |
| `cancelled` | Job was skipped due to config (e.g. backups disabled) | `cancelled`  |

If the handler returns a `rescheduleAt` timestamp and the job source is
`schedule`, the job is reset to `queued` with the new `run_at` instead of being
marked finished. This creates the recurring loop for scheduled jobs.

## Scheduling Mechanisms

### Cron

Used by sync, upgrade, rename, and cleanup jobs. The cron expression is stored
in the config table for each instance. `calculateNextRun()` uses the `croner`
library to compute the next occurrence.

Cron expressions are validated with a minimum interval check to prevent
accidental sub-minute schedules. For simple `*/N * * * *` patterns, the interval
is checked directly. For complex expressions, the validator runs the cron 3
times and measures the gaps.

### Fixed Interval

Used by library refresh and PCD sync. The interval is stored in minutes. Next
run is calculated as `lastRunAt + intervalMinutes`. If there's no previous run,
the job runs immediately.

Handlers for interval-based jobs include a "not due yet" guard: if the
scheduler fires early (e.g. after a restart), the handler checks whether the
actual due time has passed and reschedules if not.

### Named Schedules

Used by backup and log cleanup jobs. The schedule is a keyword (`daily`,
`hourly`, `weekly`, `monthly`) or a cron expression. Named schedules map to
fixed times:

| Schedule  | Next Run                      |
| --------- | ----------------------------- |
| `daily`   | Midnight tomorrow             |
| `hourly`  | Next hour at :00              |
| `weekly`  | 7 days from now at midnight   |
| `monthly` | 1st of next month at midnight |

### Manual Triggers

Any job can be triggered manually via "Run now" in the settings UI or via API.
Manual jobs use `source: 'manual'` and `run_at: now`. They execute immediately
(the dispatcher is notified) and do not reschedule after completion.

## Deduplication & Locking

### Queue Deduplication

Every scheduled job has a unique `dedupeKey` (e.g.
`arr.sync.qualityProfiles:123`). A unique partial index ensures only one job
per key can exist. When `upsertScheduled()` is called:

- If no job exists with that key, create one.
- If a queued job exists, update its `run_at` and payload.
- If a running job exists, leave it alone (never overwrite a running job).

This prevents duplicate jobs from accumulating when config is saved multiple
times or when `scheduleAllJobs()` runs on startup.

### Sync Locking

Arr sync jobs use a separate locking mechanism via the `sync_status` column on
sync config tables (`arr_sync_quality_profiles_config`, etc.):

- `idle` - no sync running
- `pending` - job enqueued, waiting to start
- `in_progress` - handler claimed the lock, sync executing
- `failed` - sync encountered an error

The handler calls `claimSync()` which atomically moves `pending` to
`in_progress`. If already `in_progress`, the claim fails and the job is
skipped. This prevents concurrent syncs to the same instance for the same
section.

## Error Handling & Recovery

### Handler Errors

If a handler throws an exception, the dispatcher catches it and converts it to
a failure result. The error message is recorded in job run history. The job is
marked as `failed` in the queue.

If no handler is registered for a job type, the job is immediately marked as
`failed` with "Handler not found" recorded in history.

### Startup Recovery

On init, `recoverRunning()` resets any jobs stuck in `running` to `queued`.
This handles the case where the process was killed while a job was executing.
The job will retry on next dispatch.

### No Auto-Retry

Failed jobs do not automatically retry. They remain in the queue with status
`failed`. Users can manually re-trigger via the settings UI. Scheduled jobs
that fail still reschedule their next occurrence.

## Database Schema

### job_queue

The source of truth for all jobs, both active and completed.

| Column           | Type       | Description                                           |
| ---------------- | ---------- | ----------------------------------------------------- |
| `id`             | INTEGER PK | Auto-increment ID                                     |
| `job_type`       | TEXT       | Job type identifier                                   |
| `status`         | TEXT       | `queued`, `running`, `success`, `failed`, `cancelled` |
| `run_at`         | TEXT       | ISO timestamp when the job should execute             |
| `payload`        | TEXT       | JSON object with job-specific data                    |
| `source`         | TEXT       | `schedule`, `manual`, or `system`                     |
| `dedupe_key`     | TEXT       | Unique key for scheduled jobs (nullable)              |
| `cooldown_until` | TEXT       | Reserved for future cooldown mechanism                |
| `attempts`       | INTEGER    | Incremented each time the job is claimed              |
| `started_at`     | TEXT       | Set when claimed by dispatcher                        |
| `finished_at`    | TEXT       | Set when execution completes                          |

Key indexes:

- `idx_job_queue_dedupe_key` - unique partial index on `dedupe_key` WHERE NOT
  NULL
- `idx_job_queue_status_run_at` - composite for efficient claim queries

### job_run_history

Immutable log of every job execution.

| Column        | Type       | Description                                  |
| ------------- | ---------- | -------------------------------------------- |
| `id`          | INTEGER PK | Auto-increment ID                            |
| `queue_id`    | INTEGER    | FK to job_queue (SET NULL on delete)         |
| `job_type`    | TEXT       | Job type (denormalized for orphan safety)    |
| `status`      | TEXT       | `success`, `failure`, `skipped`, `cancelled` |
| `started_at`  | TEXT       | When execution began                         |
| `finished_at` | TEXT       | When execution ended                         |
| `duration_ms` | INTEGER    | Wall-clock execution time                    |
| `error`       | TEXT       | Error message if failed                      |
| `output`      | TEXT       | Handler's human-readable summary             |

## Real-Time Updates (SSE)

The job system pushes real-time status updates to connected browsers via
Server-Sent Events. Enabled for sync job types (`arr.sync.*`) and backup job
types (`backup.create`, `backup.cleanup`).

### Server Side

**Event emitter** (`src/lib/server/jobs/jobEvents.ts`): A callback-based
pub/sub singleton. The dispatcher calls `emit()` on job start and finish. The
emitter filters by job type internally via the `JOB_RUNNING_LABELS` allow-list,
so job types without a display label are silently ignored.

Two event types:

- `job.started` - emitted after the handler is resolved, before execution. Includes
  `jobId`, `jobType`, and a short `displayLabel` (e.g. "Syncing Quality
  Profiles...").
- `job.finished` - emitted after history is recorded, before reschedule. Includes
  `jobId`, `jobType`, `displayLabel` (e.g. "Quality Profiles sync"), `status`,
  and `durationMs`.

**SSE endpoint** (`src/routes/jobs/events/+server.ts`): A GET handler that
returns a `Response` with a `ReadableStream` body. On stream start, it
subscribes to the event emitter. Each event is written as SSE-formatted text.
A keepalive comment (`: keepalive`) is sent every 30 seconds to prevent proxy
timeouts. On client disconnect, the subscription is cleaned up.

The endpoint is a web app route (not under `/api/`), so it uses session-only
auth. API keys cannot access it.

### Client Side

**On-demand connections**: The SSE connection is not always open. Browsers
limit HTTP/1.1 connections to ~6 per origin, and a persistent EventSource
would consume one of those slots permanently. Instead, the store connects
just-in-time when a job is triggered and auto-disconnects after completion.
This means zero baseline connection usage.

The flow:

1. The triggering component calls `jobStatus.connect()` before firing the
   action that enqueues the job.
2. The store opens an `EventSource` to `/jobs/events` (no-op if already open).
3. SSE delivers `job.started` and `job.finished` events as the job runs.
4. After `job.finished`, the completion message displays for 6 seconds, then
   the store transitions to `idle` and closes the EventSource.

If multiple jobs are triggered in quick succession, the second `connect()` is
a no-op since the connection is already open. Jobs run serially, so the SSE
sees all started/finished events in order. The connection stays open until the
final job's 6-second display expires.

**Store** (`src/lib/client/stores/jobStatus.ts`): A Svelte writable store with
a three-state machine:

- `idle` - no job activity, EventSource closed
- `running` - job in progress, shows spinner and label
- `completed` - job finished, shows result for 6 seconds then returns to idle

The store includes holdoff logic: if a new `job.started` arrives within 5
seconds of entering `completed`, the completion message is held for the
remaining time before transitioning. This prevents flickering during
back-to-back jobs.

**Desktop UI** (`src/lib/client/ui/navigation/pageNav/jobStatus.svelte`): A
card component that appears above the version block in the sidebar when a job
is active. Uses Svelte's `fade` transition.

**Mobile UI** (`src/lib/client/ui/navigation/bottomNav/BottomNav.svelte`): A
compact status strip that slides in above the bottom navigation tabs. Uses
Svelte's `slide` transition.

## Handlers

All handlers live in `src/lib/server/jobs/handlers/` and are registered in
`index.ts` on import.

### Arr Sync

**Handler:** `arrSync.ts`

Syncs configuration from the PCD cache into Arr instances. Handles both the
combined `arr.sync` type (legacy, runs all sections) and individual section
types (`arr.sync.qualityProfiles`, etc.).

Per section:

1. Check if the section has config for this instance.
2. Claim the sync lock (`pending` to `in_progress`).
3. Create a syncer and execute.
4. On success, mark `idle` and record `last_synced_at`.
5. On failure, mark `failed` and record `last_error`.
6. Calculate next cron run and reschedule if scheduled.

### Arr Upgrade

**Handler:** `arrUpgrade.ts`

Runs the upgrade engine for Radarr instances: evaluates filter rules against
the library, selects items for search, and triggers interactive or live
searches. Supports round-robin and random filter modes. Rotates the filter
index after each run.

### Arr Rename

**Handler:** `arrRename.ts`

Scans Arr libraries for files/folders that don't match the current naming
config and triggers rename commands. Supports dry-run mode and folder renaming.

### Arr Cleanup

**Handler:** `arrCleanup.ts`

Scans Arr instances for stale custom formats and quality profiles that exist in
the Arr but are no longer in the PCD config, then deletes them. Also scans for
removed entities (TMDB/TVDB items no longer in the database).

### Arr Library Refresh

**Handler:** `arrLibraryRefresh.ts`

Fetches the library from an Arr instance and caches it. Includes a "not due
yet" guard to avoid unnecessary fetches when the scheduler fires early after a
restart.

### PCD Sync

**Handler:** `pcdSync.ts`

Checks a PCD database repository for upstream changes. If `auto_pull` is
enabled and updates are found, pulls them automatically. Includes the same
"not due yet" guard as library refresh.

### Backup Create

**Handler:** `backupCreate.ts`

Creates a compressed backup archive of the data directory. The database copy
inside the archive is sanitized: API keys, tokens, webhook URLs, user
credentials, and sessions are all stripped. See the security doc for details on
secret stripping.

### Backup Cleanup

**Handler:** `backupCleanup.ts`

Scans the backups directory and deletes files older than the configured
retention period. Reschedules daily.

### Logs Cleanup

**Handler:** `logsCleanup.ts`

Scans the logs directory for dated log files (`YYYY-MM-DD.log`) and deletes
those older than the configured retention period. Reschedules daily.

## Settings UI

The jobs settings page (`src/routes/settings/jobs/`) shows two views:

**Scheduled Jobs** - a table of all jobs with a `dedupeKey` (one row per
scheduled task). Shows status, last run time and result, and next run time.
Users can trigger "Run now" which sets `run_at` to now and wakes the
dispatcher.

**Job History** - a table of recent `job_run_history` entries showing job name,
status, start time, duration, and output/error. Skipped runs are hidden by
default.
