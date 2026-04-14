# PCD Entities

**Source:** `src/lib/server/pcd/entities/`

This doc covers the five PCD entity types, their fields, and their CRUD
patterns. For the underlying infrastructure -- layers, writer pipeline,
value guards, and conflict resolution -- see [pcd.md](./pcd.md).

## Table of Contents

- [Common Patterns](#common-patterns)
- [Custom Formats](#custom-formats)
  - [Conditions](#conditions)
  - [Tests](#tests)
- [Quality Profiles](#quality-profiles)
  - [Qualities](#qualities)
  - [Scoring](#scoring)
  - [Entity Testing](#entity-testing)
- [Regular Expressions](#regular-expressions)
- [Delay Profiles](#delay-profiles)
- [Media Management](#media-management)
  - [Naming](#naming)
  - [Media Settings](#media-settings)
  - [Quality Definitions](#quality-definitions)
- [Summary](#summary)

## Common Patterns

Every entity mutation flows through `writeOperation()` (see
[pcd.md: Writer](./pcd.md#writer)). A few patterns repeat across all
entities:

- **Value guards** -- UPDATE/DELETE ops include WHERE clauses checking old
  field values. If the upstream PCD changed a field, the guard fails
  (`rowcount = 0`) and the op is flagged as conflicted.
- **Stable keys** -- each op carries a `stableKey` (`{ key, value }`) that
  identifies the target entity by its primary lookup column (usually name).
- **Group IDs** -- when a single user action produces multiple ops (rename
  - cascade, delete + dependents), they share a `groupId` UUID.
- **Cascading** -- some mutations produce "generated" ops that update
  dependent entities (e.g. renaming a CF updates QP scoring refs).
- **Case-insensitive names** -- all entity names are unique
  case-insensitively. Create/rename checks enforce this.

## Custom Formats

**Source:** `entities/customFormats/`
**Tables:** custom_formats, custom_format_tags, custom_format_conditions,
9 condition type tables, custom_format_tests

Custom formats define match logic via conditions and optional test cases.
They're the building blocks of quality profile scoring.

**Fields:** name, description, include_in_rename, tags

**Create** inserts the base row with name and empty description, then
separate ops for description, include_in_rename, and tags if non-default.

**Update** splits into per-field ops (see
[pcd.md: Op Splitting](./pcd.md#op-splitting)):

| Field             | Guard                 | Notes                           |
| ----------------- | --------------------- | ------------------------------- |
| description       | old description value | NULL normalized to empty string |
| include_in_rename | old flag value        |                                 |
| tags              | none (idempotent)     | delete + re-insert pattern      |
| name (rename)     | none                  | cascades to QP scoring refs     |

When a CF is renamed, the writer generates dependent ops that update every
`quality_profile_custom_formats` row referencing the old name. These
dependent ops are grouped with the rename op and marked `generated: true`.

**Delete** first writes explicit ops to remove the CF from all QP scoring
(one per profile), then deletes the CF itself. Foreign key cascades clean
up conditions, tests, and tags.

### Conditions

**Source:** `entities/customFormats/conditions/`
**Tables:** custom_format_conditions + one type table per condition type

Each condition has a `type` field and stores its data in exactly one
type-specific table, joined by `(custom_format_name, condition_name)`:

| Type             | Type table                  | Key data               |
| ---------------- | --------------------------- | ---------------------- |
| release_title    | condition_patterns          | regex reference        |
| release_group    | condition_patterns          | regex reference        |
| edition          | condition_patterns          | regex reference        |
| language         | condition_languages         | language + except flag |
| source           | condition_sources           | source enum            |
| resolution       | condition_resolutions       | resolution enum        |
| quality_modifier | condition_quality_modifiers | modifier enum          |
| release_type     | condition_release_types     | type enum              |
| indexer_flag     | condition_indexer_flags     | flag string            |
| size             | condition_sizes             | min/max bytes          |
| year             | condition_years             | min/max year           |

Condition updates produce per-condition ops: deletes for removed
conditions, inserts for new ones, and delete+insert pairs for changed ones
(the type-specific table row is replaced). All ops use
`skipRecompile: true` except the last, which triggers a single recompile.

Pattern-type conditions track their regex dependency via `dependsOn` in
metadata.

### Tests

**Source:** `entities/customFormats/tests/`
**Tables:** custom_format_tests

Test cases have a composite key of `(custom_format_name, title, type)`.
Fields: title, type (movie/series), should_match, description. Updates use
value guards on all fields. No op splitting.

The CF testing page evaluates test cases against the format's conditions
using the [parser service](./parser.md). Each test title is parsed for
metadata (source, resolution, languages, etc.), then pattern-based
conditions are matched against the .NET regex engine. The evaluator
(`customFormats/evaluator.ts`) combines parsed metadata with pattern match
results to produce per-condition match outcomes. See
[parser.md: Custom Format Testing](./parser.md#custom-format-testing) for
the full flow.

## Quality Profiles

**Source:** `entities/qualityProfiles/`
**Tables:** quality_profiles, quality_profile_tags,
quality_profile_languages, quality_profile_qualities, quality_groups,
quality_group_members, quality_profile_custom_formats

Quality profiles tie everything together: an ordered list of acceptable
qualities, custom format scores that influence selection, language
preferences, and upgrade thresholds.

**Fields:** name, description, tags, language

**Create** inserts the profile with defaults (`upgrades_allowed = 1`,
scores at 0, increment at 1), then seeds all available qualities as
enabled entries, inserts tags, groups, and a language if selected.

**General update** splits per-field: description, language (delete +
re-insert), tags (delete + re-insert), name (rename).

### Qualities

**Source:** `entities/qualityProfiles/qualities/`
**Tables:** quality_profile_qualities, quality_groups, quality_group_members

The quality list is an ordered set of individual qualities and/or quality
groups. Each entry has a position, enabled flag, and an optional
`upgrade_until` marker (at most one per profile, enforced by a partial
unique index).

Updates use a **batched** strategy: all row-level changes (removes, adds,
updates to position/enabled/upgrade_until) are collected into a single
`writeOperation` call. Group membership changes (adding/removing members)
are included in the same batch. The op carries an `ordered_items`
desired state with `from`/`to` arrays for full-list conflict detection.

Groups are profile-specific -- two profiles can have groups with the same
name without conflict.

### Scoring

**Source:** `entities/qualityProfiles/scoring/`
**Tables:** quality_profile_custom_formats

Each profile assigns scores to custom formats, optionally per `arr_type`
(`all`, `radarr`, `sonarr`). When a score set to `all` is modified for a
specific arr_type, the `all` row is expanded into per-type rows so the
change only affects the targeted type.

Score operations are per-CF: insert (new score), update (changed score,
guarded on old value), or delete (score removed). Profile-level settings
(`minimum_custom_format_score`, `upgrade_until_score`,
`upgrade_score_increment`) are updated in separate ops with their own
guards.

### Entity Testing

**Source:** `entities/qualityProfiles/entityTests/`
**Tables:** test_entities, test_releases

Entity testing validates quality profile scoring against real examples. A
test entity is a movie or series identified by `(type, tmdb_id)`. Each
entity has test releases with fields: title, type, size_bytes, languages
(JSON array), indexers (JSON array), and flags (JSON array).

**Create entities** uses bulk insert, skipping duplicates by composite key.
**Delete entity** removes releases first (value-guarded), then the entity.
**Create releases** supports single or bulk insert; bulk skips duplicate
titles per entity. **Update/delete releases** guard on all fields (title,
size, languages, indexers, flags).

Ops can target base or user layers depending on whether the database has
base write access.

Test entities are created from three sources: TMDB search (adds entities),
manual release entry (title + metadata), and import from Arr (pulls recent
releases from configured instances).

The evaluation API (`/api/v1/entity-testing/evaluate`) uses the
[parser service](./parser.md) to batch-parse all release titles, extract
patterns from every custom format's conditions, batch-match patterns
against parsed metadata, and evaluate each CF per release. The UI then
computes profile scores using `allCfScores()` from `scoring/read.ts`. See
[parser.md: Entity Testing](./parser.md#entity-testing) for the evaluation
pipeline.

## Regular Expressions

**Source:** `entities/regularExpressions/`
**Tables:** regular_expressions, regular_expression_tags

Regex patterns are first-class entities referenced by custom format
conditions (via `condition_patterns`). They're shared -- one regex can be
used by many conditions across many CFs.

**Fields:** name, pattern, description, regex101_id, tags

**Update** writes a single op for the regex fields (all changed fields in
one query, each guarded). Tags use the standard delete + re-insert pattern.

**Rename** triggers generated ops that update every `condition_patterns`
row referencing the old name, grouped with the rename op.

**Delete** first writes generated ops to remove all dependent condition
references, then deletes tag links, then deletes the regex with guards on
name and pattern. All grouped under a single `groupId`.

## Delay Profiles

**Source:** `entities/delayProfiles/`
**Tables:** delay_profiles

Delay profiles control release delay rules and minimum CF score gates.

**Fields:** name, preferred_protocol, usenet_delay, torrent_delay,
bypass_if_highest_quality, bypass_if_above_custom_format_score,
minimum_custom_format_score

The schema enforces protocol constraints via CHECK clauses:

- `only_torrent` -- `usenet_delay` must be NULL
- `only_usenet` -- `torrent_delay` must be NULL
- bypass disabled -- `minimum_custom_format_score` must be NULL

All CRUD uses single atomic ops (no per-field splitting). Value guards
cover all fields, with careful NULL handling (`IS NULL` vs `=`).
Base-origin locking is planned
([#421](https://github.com/Dictionarry-Hub/profilarr/issues/421)).

## Media Management

**Source:** `entities/mediaManagement/`

Media management covers three sub-entity types, each with Radarr and Sonarr
variants. All use single atomic ops (no per-field splitting) and
base-origin locking is planned
([#421](https://github.com/Dictionarry-Hub/profilarr/issues/421)).

### Naming

**Tables:** radarr_naming, sonarr_naming

Format strings for file and folder naming. Radarr has movie format +
folder format. Sonarr adds standard/daily/anime episode formats, series
folder format, season folder format, and multi-episode style. Both share
rename toggle, illegal character replacement, and colon replacement
settings.

### Media Settings

**Tables:** radarr_media_settings, sonarr_media_settings

Global settings for propers/repacks handling and media info. Both variants
have the same fields. Updates guard on all changed fields.

### Quality Definitions

**Tables:** radarr_quality_definitions, sonarr_quality_definitions

Size limits (min, max, preferred) per quality tier. Uses a **full-replace**
strategy: delete all existing entries (each guarded on its field values),
then insert the complete new set. This ensures ordering and size
consistency.

## Summary

| Entity             | Op splitting             | Cascading on rename     | Cascading on delete              |
| ------------------ | ------------------------ | ----------------------- | -------------------------------- |
| Custom format      | per-field, per-condition | QP scoring refs         | explicit QP score removal + FK   |
| Quality profile    | per-field, per-score     | --                      | explicit sub-entity removal + FK |
| Regular expression | main + dependents        | condition_patterns refs | dependent conditions + FK        |
| Delay profile      | none (atomic)            | --                      | FK cascade                       |
| Media management   | none (atomic)            | --                      | FK cascade                       |
