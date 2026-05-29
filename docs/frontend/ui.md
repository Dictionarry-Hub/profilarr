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

#### CodeInput

**`$ui/form/CodeInput.svelte`** is the editable code textarea. It uses the
same tokenizer and theme colors as `CodeBlock`, with a transparent textarea
over a highlighted layer. Use it for JSON or SQL input, not plain text forms.

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

#### DropdownCombobox and DropdownSelect

Two related components:

- **`$ui/dropdown/DropdownCombobox.svelte`** is the searchable dropdown. The
  user types to filter, keyboard arrows navigate, Enter selects. It supports
  fixed positioning, compact modes, item slots, and matching menu width to the
  trigger.
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

`DropdownCombobox` used as a sub-component inside `DateInput` to pick a year:

```svelte
<!-- src/lib/client/ui/form/DateInput.svelte:159 -->
<DropdownCombobox
	value={year}
	options={yearOptions}
	label="Year"
	minWidth="5rem"
	limit={6}
	on:change={(event) => onYearChange(event.detail)}
/>
```

Use `DropdownCombobox` when the option list is long (movies, profiles,
timezones). Use `DropdownSelect` when it's short and enumerable (log levels,
sort order).

#### MarkdownInput

**`$ui/form/MarkdownInput.svelte`** is the `<textarea>` replacement. It adds
a markdown toolbar, a live preview toggle, and auto-grow behavior. Pass
`markdown={false}` for plain multi-line text without the toolbar.

#### DateInput and TimeInput

**`$ui/form/DateInput.svelte`** composes three `DropdownCombobox`s for
month, day, and year. The visible order follows the app date-format setting;
the value format stays `YYYY-MM-DD`. It includes days-in-month validation so
February never accepts day 30.

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
wraps itself in a `Tooltip`; use `tooltipPosition="right"` for controls near
the left edge of the viewport.

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
- **`DropdownHeader.svelte`**, **`DropdownFooter.svelte`**,
  **`DropdownItem.svelte`**: styled section header, footer, and menu item.
  `DropdownFooter` mirrors `DropdownHeader` but uses `border-top` instead
  of `border-bottom` and sits at the end of a menu (e.g. "and 12 more").
- **`DropdownSelect.svelte`**: the `<select>` replacement (covered under
  [Inputs](#dropdowncombobox-and-dropdownselect)).
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

An add-entity modal with selectable search results is at
`src/routes/quality-profiles/entity-testing/[databaseId]/components/AddEntityModal.svelte`.

#### DirtyModal, InfoModal, PasteModal, CloneModal, SyncPromptModal

Pre-composed modals for recurring flows:

- **`DirtyModal.svelte`** is the nav-guard prompt wired to the dirty store;
  drop one instance per form and it auto-triggers. See
  [`dirty.md`](./dirty.md) for details.
- **`InfoModal.svelte`** is a single-action alert ("OK") for success and
  info messages.
- **`PasteModal.svelte`** is the manual-paste wrapper for flows that cannot
  use direct Clipboard API reads. See [`clipboard.md`](./clipboard.md).
- **`CloneModal.svelte`**, **`SyncPromptModal.svelte`** are specialized
  wrappers for those specific flows (entity clone, sync prompt).

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
tooltip would overflow), supports `top` / `bottom` / `right` positions, and
supports a `fullWidth` mode for stretching to fit a parent container.

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
  support both layouts. Persist view state with `createViewModeStore` from
  `$lib/client/stores/dataPage`; saved preferences win, mobile falls back to
  cards, and the default no-preference view is cards unless the page opts into
  `defaultView: 'table'`.

### Arr-Specific

Components scoped to Radarr / Sonarr semantics rather than generic UI:

- **`$ui/arr/Score.svelte`**: custom-format score display with positive /
  negative coloring.
- **`$ui/arr/CustomFormatBadge.svelte`**: badge styled specifically for
  custom formats (tight sizing, color-coded by score).
- **`$ui/arr/ProgressIndicator.svelte`**: progress bar for long-running
  arr operations (sync, bulk upgrade).

## Semantic Tokens and Theming

**Status:** in progress. Tracked in
[issue #298](https://github.com/Dictionarry-Hub/profilarr/issues/298).

Components in `src/lib/client/ui/` use **semantic CSS variable tokens**
instead of hardcoded Tailwind palette classes. Each theme lives in its own
CSS file and swaps the token values; components never reference specific
colors or `dark:` prefixes directly:

```svelte
<!-- Before -->
<button class="bg-white border-neutral-300 text-neutral-700
               dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-200">

<!-- After -->
<button class="bg-surface border-border text-text">
```

### How it works

**Theme CSS files** live under `src/styles/themes/`. Each file sets CSS
custom properties (`--theme-*`) scoped to a CSS selector:

| File                | Selector       | Description                          |
| ------------------- | -------------- | ------------------------------------ |
| `default-light.css` | `:root`        | Baseline values; always loaded first |
| `default-dark.css`  | `.dark`        | Dark mode overrides                  |
| `retro.css`         | `.theme-retro` | Win98 / Napster aesthetic            |

`src/app.css` imports all theme files and maps the `--theme-*` variables
into Tailwind's `@theme` block, producing standard utility classes:

```css
@theme {
	--color-surface: var(--theme-surface);
	--color-text: var(--theme-text);
	--radius-card: var(--theme-radius-card);
	/* ... */
}
```

Components then use `bg-surface`, `text-text`, `rounded-card`, etc. as
normal Tailwind classes. No `dark:` prefix is needed because the active
theme's CSS selector controls which values the tokens resolve to.

**FOUC prevention.** `src/app.html` contains an inline `<script>` that
reads the user's theme preference from `localStorage` and applies the
correct class on `<html>` before the first paint, so there is no flash of
the wrong theme.

### Token reference

All tokens are prefixed `--theme-` in the CSS files and exposed as Tailwind
utilities without that prefix.

**Surfaces**

| Token                         | Utility                  | Usage                                |
| ----------------------------- | ------------------------ | ------------------------------------ |
| `--theme-bg`                  | `bg-app`                 | Page background                      |
| `--theme-surface`             | `bg-surface`             | Card, modal, and panel backgrounds   |
| `--theme-surface-muted`       | `bg-surface-muted`       | Recessed or secondary surfaces       |
| `--theme-surface-hover`       | `bg-surface-hover`       | Hover state for interactive surfaces |
| `--theme-surface-hover-muted` | `bg-surface-hover-muted` | Subtle hover for muted surfaces      |

**Text**

| Token                 | Utility            | Usage                         |
| --------------------- | ------------------ | ----------------------------- |
| `--theme-text`        | `text-text`        | Primary body text             |
| `--theme-text-soft`   | `text-text-soft`   | Secondary text, button labels |
| `--theme-text-muted`  | `text-text-muted`  | Placeholders, captions        |
| `--theme-text-subtle` | `text-text-subtle` | Disabled or decorative text   |

**Borders**

| Token                   | Utility                | Usage                     |
| ----------------------- | ---------------------- | ------------------------- |
| `--theme-border`        | `border-border`        | Default component borders |
| `--theme-border-muted`  | `border-border-muted`  | Internal dividers         |
| `--theme-border-subtle` | `border-border-subtle` | Faint separators          |

**Actions**

| Token                        | Utility                 | Usage                |
| ---------------------------- | ----------------------- | -------------------- |
| `--theme-accent-solid`       | `bg-accent-solid`       | Primary action fill  |
| `--theme-accent-solid-hover` | `bg-accent-solid-hover` | Primary action hover |
| `--theme-on-accent`          | `text-on-accent`        | Text on accent fill  |
| `--theme-danger-solid`       | `bg-danger-solid`       | Danger action fill   |
| `--theme-danger-solid-hover` | `bg-danger-solid-hover` | Danger action hover  |
| `--theme-on-danger`          | `text-on-danger`        | Text on danger fill  |

**Status colors** (used by Label, Alert, badges):

Each status has four tokens: `bg`, `text`, `border`, and `icon`. The
`border` and `icon` tokens are used by `Alert.svelte` for the toast border
and leading icon color. The alert `error` type maps to `danger` tokens.

| Token                     | Usage             |
| ------------------------- | ----------------- |
| `--theme-{status}-bg`     | Status background |
| `--theme-{status}-text`   | Status text       |
| `--theme-{status}-border` | Status border     |
| `--theme-{status}-icon`   | Status icon color |
| `--theme-link-text`       | Inline link color |

Where `{status}` is one of `success`, `warning`, `danger`, `info`.

**Ghost and flush variants** (used by Button ghost, Card flush, Label ghost):

| Token                      | Usage                                      |
| -------------------------- | ------------------------------------------ |
| `--theme-flush-bg`         | Card flush background (matches page)       |
| `--theme-flush-hover`      | Card flush hover                           |
| `--theme-ghost-bg`         | Ghost button fill (transparent in default) |
| `--theme-ghost-border`     | Ghost button border                        |
| `--theme-ghost-label-bg`   | Ghost Label fill                           |
| `--theme-ghost-label-text` | Ghost Label text                           |

The retro theme uses these to render ghost buttons as solid raised controls
and flush cards as surfaced panels, matching its Win98 aesthetic.

**Shape and elevation**

| Token                           | Utility                 | Usage                       |
| ------------------------------- | ----------------------- | --------------------------- |
| `--theme-radius-control-sm`     | `rounded-control-sm`    | Small controls (xs buttons) |
| `--theme-radius-control`        | `rounded-control`       | Standard controls           |
| `--theme-radius-card`           | `rounded-card`          | Cards, modals, panels       |
| `--theme-radius-pill`           | `rounded-pill`          | Pill-shaped labels, badges  |
| `--theme-shadow-card`           | `shadow-card`           | Card elevation              |
| `--theme-shadow-control`        | `shadow-control`        | Button/input resting shadow |
| `--theme-shadow-control-active` | `shadow-control-active` | Button/input pressed shadow |

Default themes use `none` for all shadows. The retro theme uses inset
bevels (`inset 1px 1px 0 #ffffff, inset -1px -1px 0 #808080`) to produce
the raised 3D button effect, and swaps to reversed bevels on
`shadow-control-active` for the pressed state.

**Typography**

| Token               | Utility     | Usage                       |
| ------------------- | ----------- | --------------------------- |
| `--theme-font-sans` | `font-sans` | Body text font stack        |
| `--theme-font-mono` | `font-mono` | Monospace / code font stack |

Each theme can declare its own default fonts. Default themes use DM Sans /
Geist Mono; the retro theme uses Tahoma / Courier New. The font store
(`$stores/font.ts`) lets users override both with an explicit choice or
`auto` (defer to the theme). When `auto` is selected, the font picker
hides the option that matches the current theme's default so the user only
sees alternatives.

### Theme registry

`src/lib/client/themes/registry.ts` is the single source of truth for
available themes. Each entry is a `ThemeDefinition`:

```ts
interface ThemeDefinition {
    value: ThemePreference;       // localStorage key, e.g. 'retro'
    label: string;                // Display name
    shortLabel: string;           // Compact label for tight spaces
    description: string;          // One-liner for the picker
    icon: ComponentType;          // Lucide icon
    className: string | null;     // CSS class applied to <html> (null for system)
    mode: ThemeMode | 'system';   // 'light', 'dark', or 'system'
    defaultSans?: string;         // Theme's default sans font key
    defaultMono?: string;         // Theme's default mono font key
    author?: string;              // Attribution (community themes)
    url?: string;                 // Attribution link
}
```

To add a theme: create a CSS file under `src/styles/themes/`, import it in
`app.css`, add an entry to the registry, and optionally add the selector to
the FOUC script in `app.html`.

### Theme store

`$stores/theme.ts` exports two stores:

- **`themeStore`**: writable store of the resolved `ThemeMode`
  (`'light'` | `'dark'`). Exposes `setPreference(p)`, `toggle()`, and
  `getPreference()`. On `system`, it resolves via
  `prefers-color-scheme` and listens for changes. Uses the View Transitions
  API (`document.startViewTransition`) for smooth theme switches when
  available.
- **`themePreference`**: read-only store of the raw `ThemePreference`
  (e.g. `'retro'`, `'system'`). Used by the font store to look up
  theme-specific font defaults.

### Theme picker

The old light/dark toggle (`themeToggle.svelte`) was replaced with a
registry-backed `DropdownSelect` that lists every theme from the registry.
It lives in the navbar and renders icon-only at the default size, expanding
to show labels in the dropdown menu.

### Migrated components

The following components have been migrated from hardcoded palette classes
to semantic tokens. Each uses the pattern described above: `bg-surface`
instead of `bg-white dark:bg-neutral-800`, `text-text` instead of
`text-neutral-700 dark:text-neutral-200`, `rounded-card` / `rounded-control`
instead of hardcoded `rounded-lg`, and `shadow-card` / `shadow-control`
instead of theme-specific shadow values.

| Category    | Components                                                                                                                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Button      | `Button.svelte`                                                                                                                                                                               |
| Card        | `Card.svelte`, `ExpandableCard.svelte`, `StickyCard.svelte` (`CardGrid` is pure layout, no colors)                                                                                            |
| Dropdown    | `Dropdown.svelte`, `DropdownCombobox.svelte`, `DropdownSelect.svelte`, `DropdownHeader.svelte`, `DropdownFooter.svelte`, `DropdownItem.svelte`                                                |
| Form        | `FormInput.svelte`, `NumberInput.svelte`, `IconCheckbox.svelte`, `MarkdownInput.svelte`                                                                                                       |
| Label       | `Label.svelte`                                                                                                                                                                                |
| Table       | `Table.svelte`, `ExpandableTable.svelte`, `TableActionButton.svelte`                                                                                                                          |
| Toggle      | `Toggle.svelte`                                                                                                                                                                               |
| Tooltip     | `Tooltip.svelte`                                                                                                                                                                              |
| Navigation  | `navbar.svelte`, `themeToggle.svelte`, `accentPicker.svelte`, `pageNav.svelte`, `group.svelte`, `groupHeader.svelte`, `groupItem.svelte`, `jobStatus.svelte`, `version.svelte`, `Tabs.svelte` |
| Actions     | `ActionsBar.svelte`, `ActionButton.svelte`, `ActionInput.svelte`, `SearchAction.svelte`, `SearchFilterAction.svelte`, `SearchModeToggle.svelte`                                               |
| Filter      | `SmartFilterBar.svelte`                                                                                                                                                                       |
| Display     | `CodeBlock.svelte` (display), `Markdown.svelte`                                                                                                                                               |
| Modal       | `Modal.svelte`, `InfoModal.svelte`, `CloneModal.svelte`, `SyncPromptModal.svelte` (`DirtyModal` and `PasteModal` are pure wrappers with no styling)                                           |
| Alerts      | `Alert.svelte`                                                                                                                                                                                |
| Help        | `HelpButton.svelte`                                                                                                                                                                           |
| Route views | Login page, table views (arr, custom formats, databases, media settings, naming, quality definitions, quality profiles, regular expressions)                                                  |

### Not yet migrated

These components still use hardcoded palette classes with `dark:` prefixes
and are tracked in issue #298:

- **Form:** `DateInput.svelte`, `TimeInput.svelte`, `TagInput.svelte`,
  `KeyValueList.svelte`, `RangeScale.svelte`, `CodeInput.svelte`,
  `SearchDropdown.svelte`
- **Cron:** `CronInput.svelte`
- **Badge/Arr:** `Badge.svelte`, `CustomFormatBadge.svelte`,
  `Score.svelte`, `ProgressIndicator.svelte`
- **Navigation:** `Breadcrumb.svelte`, `BottomNav.svelte`,
  `Pagination.svelte`
- **Other:** `EmptyState.svelte`, `FilterTag.svelte`, `ViewToggle.svelte`,
  `DraggableCard.svelte`, `SelectableContainer.svelte`,
  `SelectableRow.svelte`
- **Styles:** `prose.css`, `scrollbar.css`

### Available themes

| Theme         | Mode  | Selector           | Description                                                                                                       |
| ------------- | ----- | ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| System        | auto  | (none)             | Follows device `prefers-color-scheme`                                                                             |
| Default Light | light | `.light` / `:root` | Clean neutral palette, DM Sans / Geist Mono                                                                       |
| Default Dark  | dark  | `.dark`            | Semi-transparent surfaces on dark background                                                                      |
| Retro         | light | `.theme-retro`     | Win98 / Napster: silver-grey, navy accent, square corners, inset bevels, Tahoma / Courier New, Clippy help button |

Planned: `classic.css` (dark-only, replicating the v1 Profilarr look) and
user-loadable custom theme files.
