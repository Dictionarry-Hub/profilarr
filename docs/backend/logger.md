# Logger

**Source:** `src/lib/server/utils/logger/` (`$logger/*`)

## Table of Contents

- [Log Levels](#log-levels)
- [Configuration](#configuration)
- [Output Formats](#output-formats)
- [Usage](#usage)
- [Source Names](#source-names)
- [Open Work](#open-work)

The logger is a singleton class that writes to two outputs simultaneously:
colored console lines for development and JSON files for persistence. Settings
are stored in SQLite and can be changed at runtime without a restart. Log files
rotate daily (`YYYY-MM-DD.log`) and are cleaned up by the `logsCleanup` job
based on a configurable retention window.

## Log Levels

Four levels, ordered from least to most severe:

| Level   | Color  | Purpose                                   |
| ------- | ------ | ----------------------------------------- |
| `DEBUG` | Cyan   | Internal diagnostics, step-by-step detail |
| `INFO`  | Green  | Normal operational events worth recording |
| `WARN`  | Yellow | Unexpected but handled situations         |
| `ERROR` | Red    | Failures that need attention              |

The `min_level` setting acts as a threshold filter. Setting it to `WARN` drops
all `DEBUG` and `INFO` entries. The default is `DEBUG` (log everything).

## Configuration

Settings live in the `log_settings` table (singleton row, `id = 1`):

| Column            | Type    | Default | Purpose                       |
| ----------------- | ------- | ------- | ----------------------------- |
| `retention_days`  | integer | 30      | Days before cleanup deletes   |
| `min_level`       | text    | DEBUG   | Minimum severity to record    |
| `enabled`         | integer | 1       | Master toggle for all logging |
| `file_logging`    | integer | 1       | Write to daily JSON files     |
| `console_logging` | integer | 1       | Write to stdout with colors   |

`LogSettingsManager` (`settings.ts`) caches these values in memory and exposes a
`reload()` method that the settings UI calls after saving. If the database is
unavailable (e.g. during early startup), the manager falls back to hardcoded
defaults: INFO level, both outputs enabled, 30-day retention.

## Output Formats

**Console** -- human-readable, ANSI-colored:

```
2026-04-14T12:00:00.000Z | INFO  | Sync processing complete | [SyncProcessor] | {"totalSynced":4}
```

Each segment is pipe-delimited. Timestamps and metadata are grey; the level
token is colored per the table above.

**File** -- one JSON object per line, appended to `{logsDir}/YYYY-MM-DD.log`:

```json
{
	"timestamp": "2026-04-14T12:00:00.000Z",
	"level": "INFO",
	"message": "Sync processing complete",
	"source": "SyncProcessor",
	"meta": { "totalSynced": 4 }
}
```

File writes are async and non-blocking. If a write fails the entry is lost but
the application continues normally.

## Usage

Import the singleton and call a level method:

```ts
import { logger } from '$logger/logger.ts';

await logger.info('Sync processing complete', {
	source: 'SyncProcessor',
	meta: { totalSynced: 4, instanceCount: 2 }
});
```

All four level methods (`debug`, `info`, `warn`, `error`) share the same
signature: `(message: string, options?: { source?: string; meta?: unknown })`.
They are async -- use `await` so file writes complete before the caller
continues.

`errorWithTrace` is a variant that also prints the stack trace to console (in
grey) and writes it to the file log's `meta.stack` field:

```ts
await logger.errorWithTrace('Failed to compile cache', error, {
	source: 'PCDManager',
	meta: { databaseId: id }
});
```

**Conventions:**

- `source` identifies where the log was emitted. See
  [Source Names](#source-names) for the naming rule.
- `meta` carries structured context: IDs, counts, timing, error messages.
  Keep it serializable -- no class instances or circular references.
- For testing, instantiate the `Logger` class directly with a custom config
  instead of importing the singleton:

```ts
import { Logger } from '$logger/logger.ts';
const testLogger = new Logger({ logsDir: '/tmp/test-logs', minLevel: 'DEBUG' });
```

## Source Names

Source = **where** the log was emitted, not **what** is happening. Format:
file path under `src/lib/server/` with `/` → `.` and `.ts` dropped, camelCase
segments. Drop the file segment when it duplicates the parent directory.

```
Good: source: 'sync.qualityProfiles'     // action goes in the message
Bad:  source: 'transform.qualityProfile' // breaks grep "sync\."
```

## Open Work

- Migrate legacy sources to dot-notation, subsystem by subsystem.
- Add a source linter (regex `/^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)*$/`);
  gate in CI once migration is done.
