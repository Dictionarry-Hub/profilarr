# Drift Detection

**Source:** `src/lib/server/jobs/handlers/arrDrift.ts`,
`src/lib/server/db/queries/arrDriftSettings.ts`,
`src/lib/server/db/queries/arrDriftStatus.ts`

Drift detection checks whether an Arr instance still matches the configuration
Profilarr would sync now. It is observational: it does not write to Arr, repair
config, delete stale items, or replace cleanup.

## Job

The scheduled job type is `arr.drift` with payload `{ instanceId }`.

Scheduling is per Arr instance and uses `arr_drift_settings`:

| Field         | Purpose                               |
| ------------- | ------------------------------------- |
| `enabled`     | Master switch for drift detection     |
| `cron`        | Cron expression for scheduled checks  |
| `next_run_at` | Next scheduled run stored as UTC text |

The job queue uses dedupe key `arr.drift:{instanceId}` so each instance has at
most one scheduled drift job.

Current handler behavior:

- invalid instance ids fail
- missing instances fail
- missing or disabled settings cancel the job
- unsupported Arr types are skipped
- enabled jobs compare custom formats, store the latest result, and return success
- scheduled jobs calculate and store the next run before returning

## Latest Status

Drift stores only the latest result per Arr instance in `arr_drift_status`.
Job run history remains the operational history.

| Field                      | Purpose                                              |
| -------------------------- | ---------------------------------------------------- |
| `status`                   | `never_checked`, `clean`, `drift_detected`, `failed` |
| `last_checked_at`          | Last completed check time                            |
| `counts_json`              | Count summary by drift section                       |
| `diff_json`                | Structured latest drift result                       |
| `diff_hash`                | Stable hash of the structured drift result           |
| `last_notified_hash`       | Last drift hash sent as a notification               |
| `last_notified_at`         | Last drift notification time                         |
| `last_error`               | Latest failure detail                                |
| `error_hash`               | Stable hash of the latest failure detail             |
| `last_notified_error_hash` | Last failure hash sent as a notification             |

## Custom Formats

Custom format drift compares Profilarr-managed custom formats referenced by
synced quality profile selections.

Comparison rules:

- build expected custom formats with the same transformer used by sync
- fetch actual custom formats from Arr
- match by custom format name
- ignore Arr ids
- compare `includeCustomFormatWhenRenaming`
- compare normalized specifications and fields
- ignore unmanaged extra Arr custom formats

## Arr Page UI

The Arr Drift page shows Drift Detection for each Arr instance.

Current UI behavior:

- disabled drift shows configuration only
- enabled drift shows schedule controls, run now, and saved timing metadata
- run now queues an immediate manual drift check
- drifted items are shown as expandable cards, one managed entity per card
- custom format cards show parsed fields such as missing formats, missing
  conditions, condition value changes, and include-in-rename changes
- result cards do not show raw drift paths, raw JSON, hashes, or scheduler
  metadata
- the UI is read-only for drift results and does not repair or resync

## TODO

Implement quality profile, delay profile, and media management comparison,
and notifications.
