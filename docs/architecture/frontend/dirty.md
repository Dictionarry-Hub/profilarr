# Dirty Store

**Source:** `src/lib/client/stores/dirty.ts` (~146 lines)
**Nav guard:** `src/lib/client/ui/modal/DirtyModal.svelte`

The dirty store is how forms in Profilarr detect unsaved changes and prompt
the user before navigation. It's a **single global store** with a snapshot-based
model: you hand it the server data, mutate a working copy, and it tells you
whether the copy differs from the snapshot. When it's dirty, `DirtyModal`
intercepts navigation and asks the user to confirm or discard.

## Table of Contents

- [Where State Lives](#where-state-lives)
- [Model](#model)
- [Navigation Integration](#navigation-integration)
- [Form Lifecycle](#form-lifecycle)
- [Patterns](#patterns)
  - [Simple Form](#simple-form-component-based)
  - [Ordered Collection](#ordered-collection-all-or-nothing-save)
  - [Nested Score Map](#nested-score-map-diff-based-save)
  - [Draft Workflow](#draft-workflow-staging-before-commit)
  - [Compound Form](#compound-form-explicit-lifecycle)
- [Outstanding Tasks](#outstanding-tasks)

## Where State Lives

Profilarr is **server-first**. `+page.server.ts` and `+layout.server.ts` load
functions own the current data for every page, mutations go through form
actions, and a successful mutation ends in `redirect(303, ...)` so SvelteKit
re-runs the relevant loads. Client stores exist only for things the server
cannot own: unsaved form edits (the dirty store, covered below), user
preferences, realtime job status, alerts, list filters, and onboarding
progress. If you're adding new state, check whether a load function or route
param can express it before reaching for a store.

## Model

The store keeps three writable stores plus a pending-navigation resolver:

- `originalSnapshot` holds a `structuredClone` of the last server-known state.
- `currentData` holds the working copy the form mutates.
- `isNewMode` is a flag intended for create mode, described in the API
  section and tracked in [Outstanding Tasks](#outstanding-tasks).
- `resolveNavigation` is a Promise resolver used by the nav guard.

`isDirty` is a derived store that runs `deepEquals(original, current)` and
inverts the result. The equality check is recursive, ignores key order in
objects, and is **order-sensitive for arrays**. Array order sensitivity is
deliberate: quality profile qualities and custom format conditions are
ordered lists, and reordering them should count as a change. If you need to
track a naturally unordered collection, sort it before snapshotting or model
it as an object keyed by id.

```ts
// src/lib/client/stores/dirty.ts:23-43
function deepEquals(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (typeof a !== typeof b) return false;
	if (a === null || b === null) return a === b;

	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false;
		return a.every((item, i) => deepEquals(item, b[i]));
	}

	if (typeof a === 'object' && typeof b === 'object') {
		const aObj = a as Record<string, unknown>;
		const bObj = b as Record<string, unknown>;
		const aKeys = Object.keys(aObj);
		const bKeys = Object.keys(bObj);
		if (aKeys.length !== bKeys.length) return false;
		return aKeys.every((key) => deepEquals(aObj[key], bObj[key]));
	}

	return false;
}
```

Two consequences of this model:

1. **Change-and-change-back is not dirty.** If a user types into a field and
   then restores the original value, `isDirty` goes back to `false`. The
   snapshot never mutates, so any round-trip matches it.
2. **You do not need to track individual field changes.** Anything reachable
   from the working copy is compared as one unit.

## Navigation Integration

`DirtyModal` is the bridge between the store and SvelteKit routing. It
registers a `beforeNavigate` hook that cancels the navigation if the form is
dirty, waits for the user's decision, and either replays the navigation with
`goto()` or leaves the user on the current page.

```svelte
<!-- src/lib/client/ui/modal/DirtyModal.svelte:14-24 -->
<script lang="ts">
	import { beforeNavigate, goto } from '$app/navigation';

	let pendingNavigationUrl: string | null = null;

	beforeNavigate(async (navigation) => {
		if ($isDirty) {
			navigation.cancel();
			pendingNavigationUrl = navigation.to?.url.pathname || null;
			const shouldNavigate = await confirmNavigation();
			if (shouldNavigate && pendingNavigationUrl) {
				goto(pendingNavigationUrl);
			}
			pendingNavigationUrl = null;
		}
	});
</script>
```

Two things to know about the current placement:

- **`DirtyModal` is currently included per feature layout**, not once at the
  root. For example, `quality-profiles/[databaseId]/[id]/+layout.svelte`
  mounts it for all three profile tabs, and the database config page mounts
  it in the page itself. The plan is to move it to `src/routes/+layout.svelte`
  once so every form is protected automatically; see
  [Outstanding Tasks](#outstanding-tasks).
- **There is no `beforeunload` handler today.** Closing the browser tab,
  refreshing, or following an external link skips the dirty check entirely.
  Adding one is tracked in [Outstanding Tasks](#outstanding-tasks).

## Form Lifecycle

Every dirty-aware form follows the same loop:

1. **Initialize** on mount. Pick `initEdit` or `initCreate` based on whether
   you have server data. Prefer `onMount` over `$: initEdit(data)` so the
   snapshot is taken exactly once at a predictable point, and so edits are
   not silently thrown away if an upstream reactive dependency changes.
2. **Mutate** the working copy via `update()` or a reactive derivation from
   `$current`.
3. **Save** with `use:enhance`. On success, call `initEdit($current)` to
   promote the working copy to the new baseline.
4. **Clean up** on unmount by calling `clear()` from `onDestroy` (or the
   cleanup return from `onMount`).

The save step is the one most easily gotten wrong. After a successful save,
the working copy already holds the right data. Calling `initEdit($current)`
re-snapshots it, which flips `isDirty` back to `false` and re-arms change
detection for the next edit. Forgetting this step leaves the form in a
permanently dirty state.

```svelte
<form
	method="POST"
	use:enhance={() => {
		isSaving = true;
		return async ({ result, update: formUpdate }) => {
			isSaving = false;
			if (result.type === 'success' && result.data?.success) {
				alertStore.add('success', 'Saved');
				initEdit($current); // reset baseline
			}
			await formUpdate();
		};
	}}
>
	<!-- ... -->
</form>
```

Some existing pages use `$: initEdit(initialData)` instead of `onMount`;
that pattern is being phased out as part of the form lifecycle cleanup in
[Outstanding Tasks](#outstanding-tasks).

## Patterns

Roughly five shapes of dirty-aware form live in the codebase. They all use
the same API; the differences are in how they model their working copy.

### Simple form (component-based)

Regex and delay profile forms live in reusable components that accept a
`mode` prop and branch between `initCreate` and `initEdit`.

```svelte
<!-- src/routes/regular-expressions/[databaseId]/components/RegularExpressionForm.svelte -->
onMount(() => {
	if (mode === 'create') {
		initCreate(initialData ?? defaults);
	} else {
		initEdit(initialData);
	}
});
```

The working copy is a flat object, fields bind to derived reads like
`$: name = ($current.name ?? '') as string`, and edits go through
`update('name', newValue)`. After a successful save the component calls
`initEdit($current)` from the enhance handler.

### Ordered collection (all-or-nothing save)

Quality profile qualities are an ordered list of quality items and groups
with position indices. The working copy stores the entire ordered array:

```ts
// src/routes/quality-profiles/[databaseId]/[id]/qualities/+page.svelte
initialData = { orderedItems: [...] };
initEdit(initialData);

// mutation via update()
update('orderedItems', reorderedArray);
```

Because `deepEquals` is order-sensitive, drag-and-drop reordering immediately
flips `isDirty` to true. The save submits the full ordered array; the server
replaces the entire list in one transaction. This shape suits
full-replacement ops where the server cannot reliably diff.

### Nested score map (diff-based save)

Quality profile scoring stores a nested map:
`customFormatScores[cfName][arrType] = score`. The working copy holds the
full map, but the form submits only the diff against the initial snapshot:

```ts
// scoring/+page.svelte
$: customFormatScoresPayload = JSON.stringify(
	buildCustomFormatScoresArray(customFormatScores, initialData.customFormatScores)
);
```

The dirty store still deep-compares the full map to decide whether to enable
the save button, but the wire format is a diff. This keeps payloads small on
a page with hundreds of scores while still getting correct dirty detection
for free.

### Draft workflow (staging before commit)

Custom format conditions let users build a new condition in a "draft" slot
before committing it to the main conditions array. The working copy has two
top-level fields:

```ts
interface ConditionsFormData {
	conditions: KeyedCondition[];
	draftConditions: KeyedCondition[];
}
```

Drafts are part of the store, so adding or editing a draft marks the form
dirty. A "Save" action is blocked while any draft is pending, and
`confirmDraft()` moves the draft from `draftConditions` to `conditions` via
two `update()` calls. Each condition carries a stable `_key` for Svelte's
keyed-each semantics; this matters because re-renders during editing would
otherwise lose focus and cursor position.

### Compound form (explicit lifecycle)

The database config page edits `manifest` and `readme` together, aliases the
store's `update` to avoid shadowing, and uses explicit `onMount` / `onDestroy`
lifecycle hooks:

```ts
// src/routes/databases/[id]/config/+page.svelte
import {
	isDirty,
	initEdit,
	update as dirtyUpdate,
	resetFromServer,
	clear as clearDirty
} from '$lib/client/stores/dirty';

onMount(() => {
	if (manifest) initEdit({ manifest, readme });
});

onDestroy(() => {
	clearDirty();
});
```

It currently holds a local `let manifest = data.manifest` alongside the
store, which is why it needs `resetFromServer` instead of plain
`initEdit($current)` after save. Collapsing that duplication is part of
[Outstanding Tasks](#outstanding-tasks).

## Outstanding Tasks

These are known improvements to the dirty store and its surrounding
conventions. They're listed here so the doc reflects intent as well as
current state.

- **Make `DirtyModal` global.** Move the single `<DirtyModal />` instance to
  `src/routes/+layout.svelte` and remove every per-feature-layout import of
  it. The store is already a singleton; there is no benefit to mounting the
  modal multiple times, and per-layout placement means new features can
  silently ship without nav-guard protection.
- **Fix `initCreate` so `isNewMode` actually flips to `true`.** The file
  header comment says "New mode = always dirty" and the derived store has a
  matching `if ($isNew) return true` branch, but `initCreate` at
  `dirty.ts:70-74` sets `isNewMode` to `false` and is therefore
  indistinguishable from `initEdit`. Setting it to `true` restores the
  intended "create forms start dirty so the save button is enabled from the
  first render" behavior.
- **Add a `beforeunload` handler to `DirtyModal`.** Today, closing the tab
  or refreshing silently drops unsaved edits. A minimal `window.addEventListener('beforeunload', ...)`
  that sets `event.preventDefault()` while `$isDirty` is true gives users
  the browser's native "are you sure" prompt for free.
- **Standardize form init and cleanup.** Some pages use `onMount` +
  `onDestroy(clear)`, others use `$: initEdit(initialData)` and rely on the
  next page's `initEdit` to overwrite state. Pick one (recommended:
  `onMount` + `onDestroy(clear)`) and migrate existing forms. Consistency
  here also makes the `$: initEdit` re-snapshot footgun go away.
- **Refactor the database config page to derive from `$current` instead of
  holding a local `let manifest`.** Once it no longer duplicates state,
  `resetFromServer` has no callers and can be removed from the store's API.
- **Implement sidebar collapse.** `src/lib/client/stores/sidebar.ts`
  exports a `sidebarCollapsed` writable with `toggle`, `collapse`, and
  `expand` methods, but no component imports it. Wire it up to the page
  nav, or delete the file until it's needed.
- **Write `frontend/preferences.md`.** The persisted UI preference stores
  (`theme`, `accent`, `font`, `navIcons`, `mobileNav`) deserve their own
  short doc.
