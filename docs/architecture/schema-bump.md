# Schema Bump

How to safely evolve the PCD schema without breaking existing databases or
Profilarr installations.

## Table of Contents

- [Overview](#overview)
- [Golden Rules](#golden-rules)
- [Compatibility Matrix](#compatibility-matrix)
- [Walkthrough](#walkthrough)
  - [1. Write the schema op](#1-write-the-schema-op)
  - [2. Bump the schema version](#2-bump-the-schema-version)
  - [3. Update Profilarr](#3-update-profilarr)
  - [4. Update the reference snapshot](#4-update-the-reference-snapshot)
  - [5. Update database PCDs](#5-update-database-pcds)
- [Safe vs Unsafe Changes](#safe-vs-unsafe-changes)
- [What About minimum_version?](#what-about-minimum_version)
- [Example: Adding position to quality_group_members](#example-adding-position-to-quality_group_members)

## Overview

The PCD schema lives in a separate repo (`Dictionarry-Hub/schema`). It's applied
as the **first layer** during compile - before base ops, tweaks, or user ops.
Changing it affects every PCD that depends on it.

```
schema repo (Dictionarry-Hub/schema)
├── pcd.json          ← version lives here
└── ops/
    ├── 0.schema.sql  ← original DDL (never edited)
    ├── 1.languages.sql
    ├── 2.qualities.sql
    └── 3.xxx.sql     ← new changes go here (additive only)
```

Schema changes are **always new files** in `ops/`. Old files are never edited.
Ops are applied in filename order during compile, so the numbering matters.

## Golden Rules

1. **Never edit existing ops files.** Published ops are immutable. Add a new
   numbered file.
2. **Always use defaults for new columns.** This is what makes the change
   backwards compatible. Old ops that insert without the new column still
   compile.
3. **Profilarr code must handle the column not existing.** Users may update
   Profilarr before their database pulls the new schema, or they may be on an
   older schema version. Reads should fall back gracefully.
4. **Test the compile with old ops first.** Before publishing, verify that
   existing published database ops still compile cleanly against the new schema.

## Compatibility Matrix

For any additive change with a default value:

| Scenario                   | Result                                                                     |
| -------------------------- | -------------------------------------------------------------------------- |
| New schema + old Profilarr | Column exists with default, old code ignores it, compiles fine             |
| New schema + new Profilarr | Profilarr reads and writes the new column, everything works                |
| Old schema + new Profilarr | Column doesn't exist, new code must fall back gracefully (e.g. sort alpha) |
| Old schema + old Profilarr | Nothing changed, nothing broke                                             |

## Walkthrough

### 1. Write the schema op

Create a new numbered `.sql` file in the schema repo's `ops/` folder. The
number must be higher than the last existing op.

```
ops/
├── 0.schema.sql
├── 1.languages.sql
├── 2.qualities.sql
└── 3.your-change.sql   ← new file
```

Use `ALTER TABLE` for column additions. Use `CREATE TABLE` for new tables. The
SQL must be valid as a standalone operation - it runs after all previous ops in
order.

### 2. Bump the schema version

Update `version` in the schema repo's `pcd.json`. Follow semver:

| Change type                                         | Bump  | Example           |
| --------------------------------------------------- | ----- | ----------------- |
| Additive column/table with default (compatible)     | Minor | `1.0.0` → `1.1.0` |
| Breaking change (rename, drop, NOT NULL no default) | Major | `1.0.0` → `2.0.0` |

Breaking changes should be avoided. If one is truly necessary, coordinate with
all known PCD maintainers and bump `profilarr.minimum_version`.

### 3. Update Profilarr

In the Profilarr codebase:

- **Writer:** Update the relevant writer to include the new column in generated
  ops (e.g. include `position` in `quality_group_members` inserts).
- **Reader:** Update read queries to use the new column, with a fallback for
  when it doesn't exist (old schema).
- **UI:** Surface the new data. Handle the fallback state gracefully (e.g. show
  items in alphabetical order if no position data exists).
- **Reference snapshot:** Update `docs/pcdReference/0.schema.sql` to reflect
  the new schema state. This file is documentation only - it's not used at
  runtime.

### 4. Update the reference snapshot

Keep `docs/pcdReference/0.schema.sql` in the Profilarr repo in sync with the
current schema state. This is the file developers read to understand the PCD
schema without cloning the schema repo. It's a reference snapshot, not a runtime
dependency.

### 5. Update database PCDs

Each database PCD that uses the affected table:

- Bump `dependencies.schema` in `pcd.json` to require the new schema version
  (e.g. `"schema": "^1.1.0"`).
- Update published ops to include the new column values where appropriate.
- Old ops that don't include the column still work because of the default.

## Safe vs Unsafe Changes

### Safe (backwards compatible)

These can be deployed without coordination:

- `ALTER TABLE ... ADD COLUMN ... DEFAULT value` - existing inserts still work
- `CREATE TABLE ...` - old code ignores tables it doesn't know about
- `CREATE INDEX ...` - no impact on inserts or reads by old code
- `INSERT INTO` (new seed data) - additive, old code unaffected

### Unsafe (breaking)

These require a major version bump and `profilarr.minimum_version` update:

- `ALTER TABLE ... ADD COLUMN ... NOT NULL` (no default) - old inserts fail
- `ALTER TABLE ... DROP COLUMN` - old reads/writes fail
- `ALTER TABLE ... RENAME COLUMN` - old queries reference wrong name
- `DROP TABLE` - old queries fail
- Changing column types or constraints that reject existing data

**Avoid breaking changes.** The cost is high: every PCD must update, every
Profilarr install must update, and the ordering has to be coordinated. If you
think you need a breaking change, consider whether an additive approach
(new column + deprecate old) achieves the same goal.

## What About minimum_version?

The `profilarr.minimum_version` field in a PCD's `pcd.json` tells Profilarr
"you must be at least this version to use this database." It's the escape hatch
for when a schema change requires Profilarr logic that old versions don't have.

For additive changes with graceful fallbacks in Profilarr, you usually don't
need to bump this. The fallback (e.g. alphabetical sort) is good enough for
older Profilarr versions.

For changes where the fallback would be broken or misleading, bump it. Profilarr
checks this at link/sync time and tells the user to update.

## Example: Adding position to quality_group_members

**Goal:** Let users order qualities within groups instead of showing insertion
order.

**Schema op** (`ops/3.quality-group-member-position.sql`):

```sql
ALTER TABLE quality_group_members
ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
```

**Schema `pcd.json`:** bump `version` from `1.0.0` to `1.1.0`.

**Profilarr changes:**

- Writer (`qualityProfiles/qualities/update.ts`): include `position` in
  `quality_group_members` inserts, based on UI ordering.
- Reader: sort group members by `position`, fall back to alphabetical when all
  positions are 0 (old schema or unordered data).
- UI: allow drag-to-reorder within groups, persist position values.
- Update `docs/pcdReference/0.schema.sql` with the new column.

**Database PCD:** bump `dependencies.schema` to `"^1.1.0"`. New ops include
`position` values. Old ops without `position` still compile (default 0).

**Deployment order:**

```
1. Schema repo: publish v1.1.0 (new op + version bump)
2. Profilarr: update writer/reader/UI + reference snapshot
3. Database PCD: bump schema dep, publish ops with position values
```

No `minimum_version` bump needed - old Profilarr ignores the column, new
Profilarr falls back to alphabetical when the column is missing or all zeros.
