# Drift Detection

**Source:** `src/lib/server/jobs/handlers/arrDrift.ts`,
`src/lib/server/jobs/handlers/arrSync.ts`,
`src/lib/server/db/queries/arrDriftSettings.ts`,
`src/lib/server/db/queries/arrDriftStatus.ts`,
`src/lib/server/drift/customFormats.ts`,
`src/lib/server/drift/qualityProfiles.ts`,
`src/lib/server/drift/delayProfiles.ts`,
`src/lib/server/drift/display.ts`,
`src/routes/arr/[id]/drift/+page.svelte`,
`src/routes/arr/[id]/drift/+page.server.ts`,
`src/routes/arr/[id]/drift/components/DriftFieldDiffTable.svelte`,
`src/routes/arr/[id]/sync/+page.server.ts`,
`src/routes/arr/[id]/sync/components/QualityProfiles.svelte`,
`src/routes/arr/[id]/sync/components/DelayProfiles.svelte`

Drift detection checks whether an Arr instance still matches the configuration
Profilarr would sync now. It is observational: it does not write to Arr, repair
config, delete stale items, or replace cleanup.

Drift detection currently covers custom formats, quality profiles, and the
default delay profile. Media management coverage (naming, media settings,
quality definitions) is planned as a follow-up; until it lands, the sync page's
Media Management section does not surface a drift chip.

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
- enabled jobs compare custom formats, quality profiles, and delay profiles,
  store the latest result, and return success
- drift-detected and failed runs notify subscribed services when the current
  drift or error hash has not already been notified
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

## Notifications

Drift emits notification events through the shared notification manager:

| Event                | Trigger                               | Severity  |
| -------------------- | ------------------------------------- | --------- |
| `arr.drift.detected` | Latest drift hash has not been sent   | `warning` |
| `arr.drift.failed`   | Latest failure hash has not been sent | `error`   |

Detected notifications emit one section block per drift category (Custom
Format, Quality Profile, Delay Profile) listing up to 15 displayable drift
entities total. If more entities exist, an additional `More` block summarises
the remainder as `+N more`. Discord renders each section as a code-block field.
Webhook receives the full payload. Summary-tier services such as Ntfy and
Telegram show only the title because section blocks are omitted.

Failed notifications use the first error line as the message and include the
full error text in an `Error` section.

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

## Quality Profiles

Quality profile drift compares selected Profilarr-managed profiles by name.
Expected profiles are built through the same quality profile transformer used
by sync, with actual Arr custom format ids used to resolve scoring rows.

Comparison rules:

- report selected quality profiles missing from Arr
- ignore Arr profile ids
- compare `upgradeAllowed`, `cutoff`, `minFormatScore`,
  `cutoffFormatScore`, and `minUpgradeFormatScore`
- compare Radarr language; ignore language for Sonarr
- compare normalized quality item order, grouping, and allowed flags
- compare custom format scores for custom formats managed by that profile,
  including explicit zero scores
- report an expected managed custom format as missing from scoring if the custom
  format is missing from Arr
- ignore unmanaged custom format scoring rows with score 0
- report unmanaged custom format scoring rows with nonzero scores because they
  affect profile behavior

## Delay Profiles

Delay profile drift compares the selected Profilarr delay profile against Arr's
default delay profile (`id=1`). This mirrors sync, which always overwrites the
default Arr profile instead of creating or matching by name.

Comparison rules:

- build expected delay profile with the same transformer used by sync
- no selected delay profile is clean
- report the selected delay profile as missing if Arr does not return `id=1`
- ignore non-default extra Arr delay profiles
- compare id, derived protocol, delays, bypass fields, minimum custom format
  score, order, and tags

## Display Formatter

`src/lib/server/drift/display.ts` maps the raw `diff_json` stored in
`arr_drift_status` into a typed list of `DriftDisplayEntity` objects consumed
by the page. One entity is one drifted managed item (e.g. one custom format).
Each entity carries:

- `section` and `sectionLabel` (e.g. `custom_formats` / `Custom Format`)
- `state` and `stateLabel` (`missing` / `modified` / `extra`)
- `tone` for badge color signaling
- `summary` (one-line description, e.g. `3 changes detected`)
- `changes[]`: per-field `DriftDisplayChange` rows with `label`, optional
  `detail`, and `expected` / `actual` `DriftDisplayValue`s. Values carry
  `text`, optional `mono`, and optional `tone`.

For custom formats the formatter resolves Arr enum ids back to friendly names
(sources, resolutions, indexer flags, languages, release types, quality
modifiers), formats sizes in human-readable bytes, and turns specification
paths into labeled changes (negate / required / per-field changes / missing
condition / extra condition).

For quality profiles the formatter turns settings, language, qualities, and
custom format score paths into labeled changes. Quality profile score rows show
expected and actual score values, missing custom formats, missing score rows,
and unmanaged nonzero score rows.

For delay profiles the formatter turns the derived protocol, delays, bypass
flags, minimum score, order, and tags into friendly field rows.

Display types live in `src/lib/shared/drift.ts`.

## Arr Drift Page

Route: `/arr/[id]/drift`. Source: `src/routes/arr/[id]/drift/+page.svelte`
and `+page.server.ts`.

Layout:

- Sticky header with `Run Now` (queues a manual `arr.drift` job) and `Save`
  (persists the schedule and enabled state).
- Settings bar (borderless, full-width, with a bottom rule): `Detection`
  toggle, `Schedule` `CronInput`, and timing pills aligned right
  (`Paused` / `Ready` / `Next ...` / `Last ...`).
- Entities section: an `ExpandableTable` with `Name` / `Entity` / `State`
  columns, mirroring the dev changes-page diff idiom. Each drifted entity is
  one row; expanding shows a `DriftFieldDiffTable` with `Field` / `Expected`
  / `Actual` columns rendering the entity's `changes[]`.

State rendering inside the entities section:

| Latest status                          | Rendered as                                                             |
| -------------------------------------- | ----------------------------------------------------------------------- |
| Detection disabled                     | Empty `ExpandableTable` chrome with a disabled message in the empty row |
| `never_checked`                        | Neutral message box                                                     |
| `clean`                                | Success message box                                                     |
| `failed`                               | Error message box with `last_error`                                     |
| `drift_detected`, displayable items    | Populated `ExpandableTable`                                             |
| `drift_detected`, no displayable items | Amber message box (formatter produced nothing for the stored diff)      |

The page is read-only for drift results. It never writes to Arr, repairs
configuration, or triggers sync.

## Sync Page Progress

Route: `/arr/[id]/sync`. Source: `src/routes/arr/[id]/sync/+page.server.ts`,
`src/routes/arr/[id]/sync/components/QualityProfiles.svelte`,
`src/routes/arr/[id]/sync/components/DelayProfiles.svelte`.

Per-section drift progress is rendered as `ProgressIndicator` chips in each
sync section header (right-aligned on tablet+, stacked below the title on
mobile). The Quality Profiles header carries two chips: one for QPs themselves
and one for the custom formats referenced by those QPs. The Delay Profiles
header carries one chip. The Media Management header has no chip yet.

Each chip shows `current / total` where:

- `total`: managed items Profilarr would sync. Selected QP count for the QP
  chip, expected CF count from `buildExpectedCustomFormats` for the CF chip,
  `0` or `1` for the delay profile chip.
- `current`: `total - drifted`. For the QP chip, `drifted` counts only QPs
  the drift comparison flagged directly. QPs that are only "transitively"
  affected (their scoring rows reference a CF that has been deleted from
  Arr) are not subtracted from the QP chip; the user-visible impact is
  surfaced via the CF chip's tooltip instead.

Chips render with `colorMode="completion"`: green check when `met`, yellow
bar otherwise. Anything below 100% is yellow regardless of how close to
completion, because for drift "almost in sync" is still actionable.

Each chip has a tooltip listing up to three affected entity names with a
`+N more` suffix when the list overflows. Examples:

- `"HD Movies, 4K Movies drifted."`
- `"HD Movies affected by drifted custom formats."`
- `"Streaming Tier drifted, used in HD Movies, TV."`
- `"Standard Delay drifted."`

Chips are hidden entirely when any of these conditions hold:

- `FEATURES.drift` is off
- per-instance `arr_drift_settings.enabled` is false
- drift status is `never_checked` or `failed` (or no row exists)
- the section's denominator is zero (e.g. no selected QPs)

Failures (`status === 'failed'`) surface only on the dedicated drift page.

### Post-sync drift refresh

The arr sync handler (`src/lib/server/jobs/handlers/arrSync.ts`) enqueues an
`arr.drift` job after a successful sync that touched Arr (any section ran).
This keeps the sync page chips fresh after the user fixes drift by syncing,
instead of waiting for the next scheduled drift run. The chain is gated on
`FEATURES.drift` and per-instance `arr_drift_settings.enabled`.

The sync page subscribes to job-finished events via
`jobStatus.onJobFinished` and calls `invalidateAll()` whenever an `arr.drift`
job completes. The raw hook is used (not the store's state machine) because
the state machine drops finished events for jobs it is not actively tracking,
including a drift job chained right after a sync's completion holdoff window.
SSE is opened on demand when the user triggers a sync and auto-closes after
the post-completion idle window, so this does not hold a persistent connection.

## TODO

- Media management drift comparison (naming, media settings, quality
  definitions) plus display formatter and sync page chip.
