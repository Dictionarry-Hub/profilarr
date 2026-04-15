# UI Components

**Source:** `src/lib/client/ui/`
**Import alias:** `$ui/*` (maps to `src/lib/client/ui/`)
**Lint rule:** `scripts/lint/ui.ts` (`deno task lint:ui`)

Profilarr ships a small in-house component library that wraps the raw HTML
primitives the app needs: buttons, inputs, selects, textareas, dialogs, and
tables. Every page in `src/routes/` is expected to consume these wrappers
instead of raw elements. Compliance is enforced by a custom Deno lint script
(`no-raw-ui`) that parses every `.svelte` file with the Svelte 5 compiler and
flags banned tags.

## Table of Contents

- [The `no-raw-ui` Lint Rule](#the-no-raw-ui-lint-rule)
- [Component Catalog](#component-catalog)
  - [Inputs](#inputs)
  - [Buttons and Toggles](#buttons-and-toggles)
  - [Layout and Containers](#layout-and-containers)
  - [Modals and Overlays](#modals-and-overlays)
  - [Data Display](#data-display)
  - [Navigation](#navigation)
  - [Feedback and Info](#feedback-and-info)
  - [Filters](#filters)
  - [Actions Bar](#actions-bar)
  - [Arr-Specific](#arr-specific)
- [Semantic Tokens and Theming (Planned)](#semantic-tokens-and-theming-planned)

## The `no-raw-ui` Lint Rule

`scripts/lint/ui.ts` is a script that enforces the "wrappers
only" convention. It walks the Svelte 5 AST produced by
`npm:svelte/compiler`, reports each banned tag with a suggested replacement,
and exits non-zero on any violation.

```bash
deno task lint:ui           # run the no-raw-ui rule alone
```

### Exemptions

**`<input type="hidden">`** is always allowed. Roughly 140 hidden inputs
exist in the codebase as SvelteKit form-action plumbing; they are not visible
UI and wrapping them would add noise. The exemption only applies when `type`
is a static string literal equal to `"hidden"`. Dynamic `type={foo}`
expressions are flagged.

**Escape-hatch comment.** For the rare case where a wrapper is genuinely
wrong (or doesn't exist yet), an HTML comment placed immediately before the
element disables the rule for that line:

```svelte
<!-- lint-disable-next-line no-raw-ui -- svelte-dnd-action needs a real <button> host -->
<button use:dragHandle>...</button>
```

The directive format is strict:

```
<!-- lint-disable-next-line no-raw-ui -- <non-empty reason> -->
```

A **malformed** directive (missing `--`, empty reason, wrong rule name) is
itself reported as a violation, so you cannot accidentally "pass" the linter
by writing a broken directive.

## Component Catalog

Components are organized by functional category. Each major component (the
ones that directly replace banned HTML, plus the most heavily used wrappers)
is documented with three representative call sites. Minor components get a
one-line description.

### Inputs

#### FormInput

**`$ui/form/FormInput.svelte`** wraps `<input>` (and, with `textarea={true}`,
`<textarea>`). It owns the label, description text, password visibility
toggle, monospace mode, and the size scale (`xs` / `sm` / `md` / `lg`).

A typical text field:

```svelte
<!-- src/routes/settings/general/+page.svelte:616 -->
<FormInput
	label="API Read Access Token"
	name="tmdb_api_key"
	value={tmdbApiKey}
	private_
	mono
	placeholder={data.tmdbSettings.hasApiKey ? '••••••••••••••••' : ''}
	description={data.tmdbSettings.hasApiKey
		? 'Leave blank to keep existing key'
		: 'Use the API Read Access Token (not API Key) from themoviedb.org'}
	on:input={(e) => {
		tmdbApiKey = e.detail;
		update('tmdb_api_key', e.detail);
	}}
/>
```

`private_` turns the input into a password field with an eye toggle; `mono`
switches to the monospace font stack (useful for API keys and URLs).

A plain URL input:

```svelte
<!-- src/routes/settings/general/+page.svelte:659 -->
<FormInput
	label="API URL"
	name="ai_api_url"
	value={aiApiUrl}
	type="url"
	mono
	description="OpenAI-compatible endpoint (e.g., Ollama: http://localhost:11434/v1)"
	on:input={(e) => {
		aiApiUrl = e.detail;
		update('ai_api_url', e.detail);
	}}
/>
```

Inside a modal with compact sizing, `FormInput` sheds its label and runs
flush with surrounding content when `label` is omitted.

#### NumberInput

**`$ui/form/NumberInput.svelte`** wraps `<input type="number">` and adds
increment/decrement buttons, min/max validation, and a `compact` mode for
dense form grids. Typical use: retention days, timeouts, thresholds.

```svelte
<!-- src/routes/settings/general/+page.svelte:472 -->
<NumberInput
	name="backup_retention_days"
	id="backup_retention_days"
	value={backupRetentionDays}
	min={1}
	max={365}
	onchange={(v) => {
		backupRetentionDays = v;
		update('backup_retention_days', v);
	}}
/>
```

#### SearchDropdown and DropdownSelect

Two related components:

- **`$ui/form/SearchDropdown.svelte`** is a searchable combobox. The user
  types to filter, keyboard arrows navigate, Enter selects. Supports fixed
  positioning so it renders above modals and other overlay context.
- **`$ui/dropdown/DropdownSelect.svelte`** is the plain `<select>` replacement:
  no search box, just click and pick.

`DropdownSelect` for a small fixed option list:

```svelte
<!-- src/routes/settings/general/+page.svelte:337 -->
<DropdownSelect
    value={uiAlertPosition}
    options={alertPositionOptions}
    fullWidth
    fixed
    on:change={(e) => {
        uiAlertPosition = e.detail as AlertPosition;
        update('ui_alert_position', uiAlertPosition);
    }}
/>
```

`SearchDropdown` used as a sub-component inside `DateInput` to pick a year:

```svelte
<!-- src/lib/client/ui/form/DateInput.svelte:159 -->
<SearchDropdown
	value={year}
	options={yearOptions}
	label="Year"
	hideLabel
	on:change={(event) => onYearChange(event.detail)}
/>
```

Use `SearchDropdown` when the option list is long (movies, profiles,
timezones). Use `DropdownSelect` when it's short and enumerable (log levels,
sort order).

#### MarkdownInput

**`$ui/form/MarkdownInput.svelte`** is the `<textarea>` replacement. It adds
a markdown toolbar, a live preview toggle, and auto-grow behavior. Pass
`markdown={false}` for plain multi-line text without the toolbar.

#### DateInput and TimeInput

**`$ui/form/DateInput.svelte`** composes three `SearchDropdown`s
(month / day / year) with days-in-month validation so February never accepts
day 30. Value format is `YYYY-MM-DD`.

**`$ui/form/TimeInput.svelte`** is two dropdowns (`HH` / `MM`).

Both exist because cross-browser native date/time pickers are a usability
nightmare on mobile.

#### TagInput

**`$ui/form/TagInput.svelte`** is a chips-style input. Enter adds a tag;
Backspace on an empty field removes the last one. Supports a `NOT:` prefix
convention for exclusions (used by custom-format language filters and the
release-title parser).

#### IconCheckbox

**`$ui/form/IconCheckbox.svelte`** is a checkbox with an icon baked in and
configurable colors (hex or CSS variable), plus filled / outline variants.
Used for qualifiers like "exclude", "required", "boost".

#### KeyValueList, RangeScale, CronInput

Minor but worth knowing:

- **`$ui/form/KeyValueList.svelte`**: dynamic list of string key / string
  value pairs. Add / remove rows; used for header maps and env-var style
  config.
- **`$ui/form/RangeScale.svelte`**: slider for bounded numeric values
  (score weights, percentages).
- **`$ui/cron/CronInput.svelte`**: structured cron-expression builder with
  common presets (hourly, daily, weekly) plus a raw-expression escape hatch.

### Buttons and Toggles

#### Button

**`$ui/button/Button.svelte`** is the single replacement for every
`<button>` and action link in the app. Props cover everything raw buttons
need: `text`, `icon` (a Lucide component), `variant`
(`primary` / `secondary` / `danger` / `ghost` / others), `size`
(`xs` / `sm` / `md` / `lg`), `loading`, `disabled`, `href` (renders as `<a>`),
and `type` (for form submits). If a `tooltip` prop is provided, the button
wraps itself in a `Tooltip`.

A form-submit button with a loading spinner:

```svelte
<!-- src/routes/settings/general/+page.svelte:270 -->
<Button
	text={saving ? 'Saving...' : 'Save'}
	icon={saving ? Loader2 : Save}
	iconColor="text-blue-600 dark:text-blue-400"
	loading={saving}
	disabled={saving || !$isDirty}
	type="submit"
/>
```

A compact icon-only action (alert preview in a section header):

```svelte
<!-- src/routes/settings/general/+page.svelte:290 -->
<Button
	icon={CheckCircle}
	iconColor="text-green-600 dark:text-green-400"
	size="xs"
	on:click={() => alertStore.add('success', 'Success alert example.')}
/>
```

A row action inside a table body:

```svelte
<!-- src/routes/settings/logs/+page.svelte:359 -->
<Button icon={Copy} size="xs" variant="secondary" on:click={() => copyToClipboard(row.message)} />
```

#### Toggle

**`$ui/toggle/Toggle.svelte`** is the boolean switch. Emits a `change` event
with `detail` being the new boolean. Supports inline label text, a
`fullWidth` mode for grid cells, and custom colors.

```svelte
<!-- src/routes/settings/general/+page.svelte:322 -->
<Toggle
	label={uiNavIconStyle === 'emoji' ? 'Enabled' : 'Disabled'}
	checked={uiNavIconStyle === 'emoji'}
	fullWidth
	on:change={(e) => {
		uiNavIconStyle = e.detail ? 'emoji' : 'lucide';
		update('ui_nav_icon_style', uiNavIconStyle);
	}}
/>
```

The toggle is almost always paired with a matching `<input type="hidden">`
so the form action receives a value for unchecked state (unchecked
checkboxes submit nothing by default):

```svelte
<Toggle checked={backupEnabled} on:change={...} />
<input type="hidden" name="backup_enabled" value={backupEnabled ? 'on' : ''} />
```

Hidden inputs are exempt from the `no-raw-ui` rule specifically to support
this pattern.

And a standalone toggle that just drives local state:

```svelte
<!-- src/routes/settings/general/+page.svelte:648 -->
<Toggle
	label="Enable AI Features"
	checked={aiEnabled}
	on:change={(e) => {
		aiEnabled = e.detail;
		update('ai_enabled', e.detail);
	}}
/>
```

#### SelectableContainer and SelectableRow

**`$ui/toggle/SelectableContainer.svelte`** + **`SelectableRow.svelte`** are
the bulk-selection pair: a container that manages selection state across a
list of rows, each row showing a checkbox indicator. Used in the import
modal and release-selection flows.

### Layout and Containers

#### Card, CardGrid, ExpandableCard, StickyCard

The card family is the primary content container:

- **`$ui/card/Card.svelte`** is a surface with padding, optional hover,
  optional `href` (renders as a link), and a `flush` mode that removes
  internal padding when the card is used as a grid child.
- **`$ui/card/CardGrid.svelte`** is a responsive grid (1 / 2 / 3 / 4 / 5
  column breakpoints) that lays cards out.
- **`$ui/card/ExpandableCard.svelte`** is a card with a collapsible body
  and a header that supports a right-slot for inline actions.
- **`$ui/card/StickyCard.svelte`** is a card that pins to the bottom of
  the viewport, typically used as a save/discard action bar.

A settings page uses `ExpandableCard` extensively to group related fields
under collapsible sections:

```svelte
<!-- src/routes/settings/general/+page.svelte:282 -->
<ExpandableCard
    title="Interface"
    description="Customize the look and feel of the application"
>
    <svelte:fragment slot="header-right">
        <div class="flex items-center gap-1" on:click|stopPropagation>
            <Button icon={CheckCircle} size="xs" on:click={...} />
            <!-- more header-right actions -->
        </div>
    </svelte:fragment>
    <div class="px-6 py-4">
        <!-- section content -->
    </div>
</ExpandableCard>
```

A `Card` as a filter-group container:

```svelte
<!-- src/routes/arr/[id]/upgrades/components/FilterGroup.svelte:68 -->
<Card padding="md" flush={depth === 0}>
	<div class="mb-3 flex items-center justify-between">
		<div class="flex items-center gap-2">
			<span class="text-xs font-medium">Match</span>
			<DropdownSelect value={group.match} options={matchOptions} />
		</div>
	</div>
</Card>
```

A `CardGrid` of repository-style entity tiles is the standard layout for
list pages (databases, profiles, regex library, custom formats).

#### Dropdown family

Sub-components for building custom menu UIs:

- **`Dropdown.svelte`**: positioning container with fixed-positioning and
  hover-bridge support.
- **`DropdownHeader.svelte`**, **`DropdownItem.svelte`**: styled section
  header and menu item.
- **`DropdownSelect.svelte`**: the `<select>` replacement (covered under
  [Inputs](#searchdropdown-and-dropdownselect)).
- **`CustomGroupManager.svelte`**: specialized dropdown used by the custom
  format group editor.

Most route code consumes `DropdownSelect`; the lower-level pieces are for
building bespoke menus.

#### DraggableCard

**`$ui/list/DraggableCard.svelte`** wraps a card with the drag-and-drop
affordance used for reordering ordered collections (profile qualities,
custom format conditions).

### Modals and Overlays

#### Modal

**`$ui/modal/Modal.svelte`** is the `<dialog>` replacement. It owns
overlay / backdrop handling, Escape-to-close, focus management, and
scroll-lock on `<body>`. Body content is a slot; footer actions can be the
built-in confirm / cancel pair (via `confirmText` / `cancelText` /
`confirmDanger` props) or custom markup via the footer slot.

A confirm-to-delete modal with built-in footer:

```svelte
<!-- src/routes/databases/components/InstanceForm.svelte:506 -->
<Modal
	open={showDeleteModal}
	header="Unlink Database"
	bodyMessage={`Are you sure you want to unlink "${instance?.name}"? This action cannot be undone and all local data will be permanently removed.`}
	confirmText="Unlink"
	cancelText="Cancel"
	confirmDanger={true}
	on:confirm={() => {
		showDeleteModal = false;
		const deleteForm = document.getElementById('delete-form');
		if (deleteForm instanceof HTMLFormElement) {
			deleteForm.requestSubmit();
		}
	}}
/>
```

A multi-step import modal with custom body content (opens in
`ImportReleasesModal` around line 342) uses `<div slot="body">` with
conditional step rendering driven by a local `step` variable.

An add-entity modal that contains a `SearchDropdown` for picking between
existing entities is at
`src/routes/quality-profiles/entity-testing/[databaseId]/components/AddEntityModal.svelte`.

#### DirtyModal, InfoModal, ImportModal, CloneModal, SyncPromptModal

Pre-composed modals for recurring flows:

- **`DirtyModal.svelte`** is the nav-guard prompt wired to the dirty store;
  drop one instance per form and it auto-triggers. See
  [`dirty.md`](./dirty.md) for details.
- **`InfoModal.svelte`** is a single-action alert ("OK") for success and
  info messages.
- **`ImportModal.svelte`**, **`CloneModal.svelte`**,
  **`SyncPromptModal.svelte`** are specialized wrappers for those specific
  flows (DB import, entity clone, sync prompt).

### Data Display

#### Table and ExpandableTable

**`$ui/table/Table.svelte`** is the `<table>` replacement. It owns sortable
headers, hover rows, responsive card fallback on narrow viewports, an empty
state, progressive loading, page size, and a per-row `actions` slot. Columns
are described declaratively.

A log table with sort, hover, compact rows, and row actions:

```svelte
<!-- src/routes/settings/logs/+page.svelte:347 -->
<Table
    data={paginatedLogs}
    {columns}
    emptyMessage="No logs found"
    hoverable={true}
    compact={true}
    responsive
    initialSort={{ key: 'timestamp', direction: defaultSortDirection }}
    onSortChange={handleSortChange}
>
    <svelte:fragment slot="actions" let:row>
        <div class="flex items-center justify-end gap-1">
            <Button icon={Copy} size="xs" variant="secondary" on:click={...} />
        </div>
    </svelte:fragment>
</Table>
```

Additional call sites worth skimming:

- `src/routes/settings/security/+page.svelte`: activity log with dense rows.
- `src/routes/databases/[id]/conflicts/+page.svelte`: conflict table that
  pairs sort with an expand-detail slot.
- `src/routes/arr/[id]/logs/+page.svelte`: arr-specific log table mirroring
  the Profilarr logs layout.

**`$ui/table/ExpandableTable.svelte`** extends `Table` with a per-row
expand region (click a chevron, get a nested detail view). Used in
entity-testing tables where each row has nested per-release detail.

**`$ui/table/TableActionButton.svelte`** is a button styled to match the
dense vertical rhythm of table action cells; prefer it over `Button` when
the button lives in a table column.

#### Badge

**`$ui/badge/Badge.svelte`** is an inline pill label. Variants cover the
usual palette (`accent` / `neutral` / `success` / `warning` / `danger` /
`info`) plus product-specific (`radarr` / `sonarr`). Supports an inline
icon and `mono` text.

#### Label

**`$ui/label/Label.svelte`** is the lighter-weight text label; use it for
inline tags that don't need a badge's visual weight.

#### CodeBlock and InlineCode

- **`$ui/code/CodeBlock.svelte`**: syntax-highlighted multi-line code with
  theme selection and a copy button.
- **`$ui/code/InlineCode.svelte`**: inline monospace span for references in
  prose.

A second `CodeBlock` exists at `$ui/display/CodeBlock.svelte` alongside
`$ui/display/Markdown.svelte`; the `display/` variants are used by the
help / docs surface while `code/` is the general-purpose block. Treat the
`code/` pair as the canonical entry point for now.

### Navigation

The navigation family is consumed mostly by the app shell (root layout),
not by individual routes.

- **`navigation/navbar/navbar.svelte`**: top bar with logo,
  `themeToggle.svelte`, and `accentPicker.svelte`.
- **`navigation/pageNav/pageNav.svelte`**: sidebar navigation composed of
  `group.svelte`, `groupHeader.svelte`, `groupItem.svelte`, plus
  `jobStatus.svelte` and `version.svelte` footer widgets.
- **`navigation/bottomNav/BottomNav.svelte`**: mobile bottom tab bar.

Route-level navigation primitives:

- **`navigation/tabs/Tabs.svelte`**: horizontal tab bar with a breadcrumb
  and an optional back button. Tabs are described as `{ label, href, active,
icon }` objects.

  ```svelte
  <!-- src/routes/regular-expressions/[databaseId]/+page.svelte:148 -->
  <Tabs {tabs} responsive />
  ```

- **`navigation/breadcrumb/Breadcrumb.svelte`**: standalone breadcrumb for
  pages that don't need tabs.
- **`navigation/pagination/Pagination.svelte`**: page-number pagination
  consumed by tables and card grids.

#### InlineLink

**`$ui/link/InlineLink.svelte`** is a lightweight inline `<a>` for text-level
links within content. It renders as accent-colored text with an underline on
hover. Use it to link entity names to their detail pages.

Props: `href` (required), `text` (required), `external` (boolean, defaults to
false; adds `target="_blank" rel="noopener noreferrer"`).

```svelte
<!-- src/routes/quality-profiles/[databaseId]/[id]/scoring/components/ScoringTableDesktop.svelte:87 -->
<InlineLink href="/custom-formats/{databaseId}/{row.id}/general" text={row.name} external />
```

### Feedback and Info

#### Tooltip

**`$ui/tooltip/Tooltip.svelte`** wraps any child in a hover-activated
tooltip. It handles viewport edge detection (flipping position when the
tooltip would overflow) and supports a `fullWidth` mode for stretching to
fit a parent container.

A badge with conditional tooltip text:

```svelte
<!-- src/routes/arr/[id]/library/components/MovieCard.svelte:107 -->
<Tooltip text={movie.isProfilarrProfile ? '' : 'Not managed by Profilarr'} position="top">
	<Badge
		variant={movie.isProfilarrProfile ? 'accent' : 'warning'}
		icon={movie.isProfilarrProfile ? null : CircleAlert}
		mono
	/>
</Tooltip>
```

Empty `text` disables the tooltip without an `{#if}` wrapper. The tooltip
is also baked into `Button` via the `tooltip` prop; prefer that over
manually wrapping a `<Button>`.

#### EmptyState

**`$ui/state/EmptyState.svelte`** is the "no data yet" empty-view surface:
icon, title, description, plus an optional CTA button (with `buttonText`,
`buttonHref`, `buttonIcon`, `onboarding` hook).

```svelte
<!-- src/routes/databases/+page.svelte:49 -->
<EmptyState
	icon={Database}
	title="No Databases Linked"
	description="Link a Profilarr Compliant Database to get started with profile management."
	buttonText="Link Database"
	buttonHref="/databases/new"
	buttonIcon={Plus}
	onboarding="db-add"
/>
```

Used on every list page when the underlying collection is empty. The
`onboarding` prop ties the CTA into the cutscene system (see
[`./cutscene.md`](./cutscene.md)).

#### HelpButton

**`$ui/help/HelpButton.svelte`** is the floating / navbar help button that
opens the help modal. Variants: `fab` (floating) or `navbar` (inline).

### Filters

- **`$ui/filter/FilterTag.svelte`**: active-filter chip with a clear button.
- **`$ui/filter/SmartFilterBar.svelte`**: multi-facet filter toolbar that
  combines search, filter chips, and saved-filter presets. Used on
  list-heavy pages (arr library, custom formats).

### Actions Bar

The `actions/` family builds merged-border toolbar groups, typically at the
top of a list page:

- **`ActionsBar.svelte`**: horizontal container that merges children's
  borders so they look like a single unit.
- **`ActionButton.svelte`**, **`ActionInput.svelte`**: button and input
  styled to fit inside the bar.
- **`SearchAction.svelte`**: search field optimized for the bar (with
  clear / submit handling).
- **`SearchFilterAction.svelte`**: filter button with an indicator for
  active filters.
- **`SearchModeToggle.svelte`**: toggle between search modes (e.g.,
  "fuzzy" vs. "exact").
- **`ViewToggle.svelte`**: list / grid view switcher used on pages that
  support both layouts.

### Arr-Specific

Components scoped to Radarr / Sonarr semantics rather than generic UI:

- **`$ui/arr/Score.svelte`**: custom-format score display with positive /
  negative coloring.
- **`$ui/arr/CustomFormatBadge.svelte`**: badge styled specifically for
  custom formats (tight sizing, color-coded by score).
- **`$ui/arr/ProgressIndicator.svelte`**: progress bar for long-running
  arr operations (sync, bulk upgrade).

## Semantic Tokens and Theming (Planned)

**Status:** not started. Tracked in
[issue #298](https://github.com/Dictionarry-Hub/profilarr/issues/298).

Today, every component in `src/lib/client/ui/` ships with hardcoded
Tailwind palette classes paired with `dark:` variants:

```svelte
<button class="bg-white border-neutral-300 text-neutral-700
               dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-200">
```

This works, but it pins the app to exactly two themes (light and dark) and
duplicates every color decision across two class strings.

The plan is to migrate to **semantic CSS variable tokens** so components
reference intent-level names (`bg-surface`, `text-text`, `border-border`)
instead of palette values. Each theme then lives in its own CSS file and
swaps the token values:

```svelte
<button class="bg-surface border-border text-text">
```
