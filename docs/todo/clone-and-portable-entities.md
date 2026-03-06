# Serialize / Deserialize Layer + Clone

## Context

We need a portable entity format that can serialize entities from the PCD cache and deserialize them back into new entities via existing PCD ops. **Clone** is the first consumer (serialize → rename → deserialize). **Import/Export** (issue #178) will be the second consumer later — the deserialize function becomes the import primitive, serialize becomes the export primitive.

## Architecture

```
serialize(cache, identifier) → PortableEntity
deserialize(portable, {databaseId, cache, layer}) → creates entity via existing ops
clone = serialize → swap name → deserialize
```

### New files

| File                                         | Purpose                                               |
| -------------------------------------------- | ----------------------------------------------------- |
| `src/lib/shared/pcd/portable.ts`             | Portable type definitions (shared client+server)      |
| `src/lib/server/pcd/entities/serialize.ts`   | All serialize functions (cache → portable)            |
| `src/lib/server/pcd/entities/deserialize.ts` | All deserialize functions (portable → PCD ops)        |
| `src/lib/server/pcd/entities/clone.ts`       | Clone orchestrator (serialize → rename → deserialize) |
| `src/lib/client/ui/modal/CloneModal.svelte`  | Reusable clone name prompt modal                      |

### Modified files (per entity type)

| File                                                      | Change                                                |
| --------------------------------------------------------- | ----------------------------------------------------- |
| `src/routes/[entity]/[databaseId]/+page.server.ts`        | Add `canWriteToBase` to load, add `clone` form action |
| `src/routes/[entity]/[databaseId]/+page.svelte`           | Add clone state + CloneModal                          |
| `src/routes/[entity]/[databaseId]/views/CardView.svelte`  | Add clone button (Copy icon in card footer)           |
| `src/routes/[entity]/[databaseId]/views/TableView.svelte` | Add clone button via Table `actions` slot             |

---

## Progress

- [x] Batch 1: Foundation + Delay Profiles (vertical slice)
- [ ] Batch 2: Simple + Tagged entities (regex, naming, media settings, quality definitions)
- [ ] Batch 3: Compound entities (custom formats, quality profiles)

---

## Phase 1: Portable Types

**File: `src/lib/shared/pcd/portable.ts`** (done)

Define all portable types upfront. These strip `id`, `created_at`, `updated_at` and use camelCase to match existing create input interfaces. Reuse `ConditionData` and `OrderedItem` from `display.ts` directly — they're already JSON-friendly.

Types to define:

- `PortableDelayProfile` — flat fields matching `CreateDelayProfileInput`
- `PortableRegularExpression` — flat fields + `tags: string[]`
- `PortableCustomFormat` — flat fields + `tags: string[]` + `conditions: ConditionData[]` + `tests: PortableCustomFormatTest[]`
- `PortableCustomFormatTest` — `{ title, type, shouldMatch, description }`
- `PortableQualityProfile` — flat fields + `tags: string[]` + `language` + `orderedItems: OrderedItem[]` + scoring fields + `customFormatScores: PortableCustomFormatScore[]`
- `PortableCustomFormatScore` — `{ customFormatName, arrType, score }`
- `PortableRadarrNaming`, `PortableSonarrNaming` — flat fields matching create inputs
- `PortableRadarrMediaSettings`, `PortableSonarrMediaSettings` — flat fields
- `PortableQualityDefinitions` — `{ name, entries: QualityDefinitionEntry[] }`
- `EntityType` union type for the clone orchestrator

---

## Phase 2: Serialize Functions

**File: `src/lib/server/pcd/entities/serialize.ts`**

Each function reads from cache using existing read functions, strips DB fields, maps to portable format.

| Function                            | Reads from                                                                                                                | Lookup                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `serializeDelayProfile`             | `delayProfileQueries.getByName(cache, name)`                                                                              | name                       |
| `serializeRegularExpression`        | `regexQueries.get(cache, id)`                                                                                             | id                         |
| `serializeCustomFormat`             | `cfQueries.general(cache, id)` + `cfQueries.getConditionsForEvaluation(cache, name)` + `cfQueries.listTests(cache, name)` | id → name for sub-entities |
| `serializeQualityProfile`           | `qpQueries.general(cache, id)` + `qpQueries.qualities(cache, dbId, name)` + `qpQueries.scoring(cache, dbId, name)`        | id → name for sub-entities |
| `serializeRadarrNaming`             | `namingQueries.getRadarrByName(cache, name)`                                                                              | name                       |
| `serializeSonarrNaming`             | `namingQueries.getSonarrByName(cache, name)`                                                                              | name                       |
| `serializeRadarrMediaSettings`      | `mediaSettingsQueries.getRadarrByName(cache, name)`                                                                       | name                       |
| `serializeSonarrMediaSettings`      | `mediaSettingsQueries.getSonarrByName(cache, name)`                                                                       | name                       |
| `serializeRadarrQualityDefinitions` | `qualityDefsQueries.getRadarrByName(cache, name)`                                                                         | name                       |
| `serializeSonarrQualityDefinitions` | `qualityDefsQueries.getSonarrByName(cache, name)`                                                                         | name                       |

**Scoring serialization detail**: The `scoring()` read returns `QualityProfileScoring` where `customFormats` is an array of `{ name, tags, scores: Record<arrType, number|null> }`. We flatten this to `PortableCustomFormatScore[]` by only including non-null scores.

---

## Phase 3: Deserialize Functions

**File: `src/lib/server/pcd/entities/deserialize.ts`**

Each function accepts `{ databaseId, cache, layer, portable }` and calls existing create/update functions.

### Simple entities

Call existing `create()` directly — the portable type fields already match create input shapes:

- `deserializeDelayProfile` → `delayProfileQueries.create()`
- `deserializeRegularExpression` → `regexQueries.create()`
- `deserializeRadarrNaming` → `namingQueries.createRadarrNaming()`
- (etc. for all media management entities)

### Compound: Custom Formats

Sequential steps (cache recompiles after each `writeOperation`):

1. `cfQueries.create({ ..., input: { name, description, includeInRename, tags } })`
2. `cfQueries.updateConditions({ ..., formatName, originalConditions: [], conditions })` — empty `originalConditions` means all conditions are "additions"
3. For each test: `cfQueries.createTest({ ..., formatName, input: test })`

Refresh cache between steps via `pcdManager.getCache(databaseId)`.

### Compound: Quality Profiles

Sequential steps:

1. `qpQueries.create({ ..., input: { name, description, tags, language } })` — this seeds default qualities
2. `qpQueries.updateQualities({ ..., profileName, input: { orderedItems } })` — replaces defaults with source qualities
3. `qpQueries.updateScoring({ ..., profileName, input: { minimumScore, upgradeUntilScore, upgradeScoreIncrement, customFormatScores } })`

Refresh cache between steps. The create→updateQualities sequence generates extra ops (create defaults then overwrite), but it reuses existing validated code paths.

---

## Phase 4: Clone Orchestrator

**File: `src/lib/server/pcd/entities/clone.ts`** (done for delay_profile)

```typescript
interface CloneOptions {
	databaseId: number;
	layer: OperationLayer;
	entityType: EntityType;
	sourceName: string;
	newName: string;
}

async function clone(options: CloneOptions): Promise<void>;
```

Switches on `entityType`, calls the matching serialize → sets `portable.name = newName` → deserialize. The existing create functions validate name uniqueness (case-insensitive), so duplicate name errors propagate naturally.

---

## Phase 5: Clone UI

### 5a. CloneModal (`src/lib/client/ui/modal/CloneModal.svelte`) (done)

Built on existing `Modal.svelte`. Contains:

- Hidden `<form method="POST" action="?/clone" use:enhance>` with `sourceName` and `layer`
- `FormInput` for new name (pre-populated with `"{source} (Copy)"`)
- Client-side duplicate name detection via `existingNames` prop
- Layer selector when `canWriteToBase` is true
- Error display for server-side validation failures
- Modal `on:confirm` triggers `form.requestSubmit()`

### 5b. Clone button on CardView

Add a clone button using the Card `footer` slot. Since Card renders as `<a>` when `href` is set, the button uses `on:click|stopPropagation|preventDefault` to prevent navigation. Dispatch `clone` event with entity data.

### 5c. Clone button on TableView

Use the Table's existing `actions` slot (first entity to use it). Render a `TableActionButton` with Copy icon. Dispatch `clone` event.

### 5d. List page wiring

Each `+page.svelte` adds:

- Clone state (`cloneModalOpen`, `cloneSourceName`)
- `handleClone` event handler from CardView/TableView
- `CloneModal` component

Each `+page.server.ts` adds:

- `canWriteToBase` to load return
- `clone` named form action calling `clone()` from `clone.ts`

---

## Implementation Order

### Batch 1: Foundation + Delay Profiles (vertical slice) — DONE

1. `src/lib/shared/pcd/portable.ts` — all portable types
2. `src/lib/server/pcd/entities/serialize.ts` — `serializeDelayProfile`
3. `src/lib/server/pcd/entities/deserialize.ts` — `deserializeDelayProfile`
4. `src/lib/server/pcd/entities/clone.ts` — `clone()` with `delay_profile` case
5. `src/lib/client/ui/modal/CloneModal.svelte`
6. `src/routes/delay-profiles/[databaseId]/+page.server.ts` — add `canWriteToBase` + `clone` action
7. `src/routes/delay-profiles/[databaseId]/+page.svelte` — add clone state + modal
8. `src/routes/delay-profiles/[databaseId]/views/CardView.svelte` — clone button
9. `src/routes/delay-profiles/[databaseId]/views/TableView.svelte` — clone button

### Batch 2: Simple + Tagged entities

- Regular expressions, naming, media settings, quality definitions
- Add serialize/deserialize per entity, add cases to `clone.ts`
- Wire up each entity's list page (server + client + views)

### Batch 3: Compound entities

- Custom formats (create + conditions + tests)
- Quality profiles (create + qualities + scoring)
- Most complex due to sequential multi-step deserialization

---

## Verification

1. **Type check**: `deno task check` passes after adding portable types
2. **Delay profile clone**: Create a delay profile → clone it from list view → verify the clone appears with correct data on its edit page
3. **Layer support**: Test clone with both `user` and `base` layers (if PAT configured)
4. **Name collision**: Try cloning with a name that already exists → verify error message appears in modal
5. **Compound entity clone** (batch 3): Clone a CF with conditions+tests → verify all sub-entities are copied. Clone a QP with custom qualities+scoring → verify qualities and CF scores are copied.
6. **Card + table views**: Verify clone button works in both view modes
