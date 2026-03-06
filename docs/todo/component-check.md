# Component Check

Audit every UI component and add it to the dev component showcase page
(`/dev/components`). Goal: document each component so we can transition from
hardcoded light/dark classes to CSS variables for custom themes.

## Variable Legend

As we audit, track which semantic variables each component needs.

| Variable                   | Current classes                                  | Purpose                                  |
| -------------------------- | ------------------------------------------------ | ---------------------------------------- |
| `--background`             | `bg-white` / `dark:bg-neutral-900`               | Page background                          |
| `--foreground`             | `text-neutral-900` / `dark:text-neutral-100`     | Primary text                             |
| `--card`                   | `bg-white` / `dark:bg-neutral-900`               | Card/surface background                  |
| `--card-foreground`        | `text-neutral-900` / `dark:text-neutral-100`     | Card text                                |
| `--muted`                  | `bg-neutral-50` / `dark:bg-neutral-800`          | Subdued backgrounds (table headers, etc) |
| `--muted-foreground`       | `text-neutral-500` / `dark:text-neutral-400`     | Secondary/placeholder text               |
| `--accent`                 | `bg-neutral-100` / `dark:bg-neutral-700`         | Hover/active backgrounds                 |
| `--accent-foreground`      | `text-neutral-900` / `dark:text-neutral-100`     | Text on accent bg                        |
| `--primary`                | `bg-accent-*` / `text-accent-*`                  | Brand color (buttons, links, indicators) |
| `--primary-foreground`     | `text-white`                                     | Text on primary bg                       |
| `--destructive`            | `text-red-600` / `dark:text-red-400`             | Danger/delete actions                    |
| `--destructive-foreground` | `text-white`                                     | Text on destructive bg                   |
| `--border`                 | `border-neutral-200` / `dark:border-neutral-800` | All borders                              |
| `--input`                  | `bg-white` / `dark:bg-neutral-800`               | Input/control backgrounds                |
| `--ring`                   | `ring-accent-*`                                  | Focus rings                              |

---

## Notes / Issues

**Consolidation candidates:**

- `Input` → merge into `FormInput` (Input is just FormInput without the
  label/wrapper)
- `Autocomplete` + `Select` → merge into `SearchDropdown` (preferred API)

**Inconsistencies to normalize before variable switch:**

- Opacity variants: FormInput uses `dark:bg-neutral-800/50`,
  `dark:border-neutral-700/60` while others use solid `dark:bg-neutral-800`,
  `dark:border-neutral-700` — pick one
- Label colors: FormInput = `text-neutral-900` (foreground),
  MarkdownInput/KeyValueList = `text-neutral-700` (card-foreground) —
  standardize
- Focus styles: SearchDropdown uses `focus:border-accent-500 + ring`, most
  others use `focus:border-neutral-400` — standardize
- Ghost vs secondary button: nearly identical (one shade of dark border) —
  consider merging

**Hard-to-variable components:**

- RangeScale: 7 marker color pairs — needs palette approach, not single
  variables
- IconCheckbox: 5 named colors + hex — hex means can't fully replace with
  variables

---

## actions/

- [x] ActionsBar
- [x] ActionButton
- [x] SearchAction
- [x] ViewToggle

**Variables used:**

- `--border` — all button/input borders (`border-neutral-200` /
  `dark:border-neutral-700`)
- `--input` — button/search background (`bg-white` / `dark:bg-neutral-800`)
- `--accent` — hover state (`hover:bg-neutral-100` /
  `dark:hover:bg-neutral-700`)
- `--foreground` — input text (`text-neutral-900` / `dark:text-neutral-100`)
- `--muted-foreground` — icons, placeholders (`text-neutral-700` /
  `dark:text-neutral-300`, `text-neutral-500`)
- `--destructive` — danger variant icon (`text-red-600` / `dark:text-red-400`)
- `--primary` — active search indicator dot (`bg-accent-500`)

## arr/

- [x] CustomFormatBadge
- [x] Score

**Variables used:**

- `--border` — badge border (`border-neutral-200` / `dark:border-neutral-700`)
- `--input` — badge background (`bg-white` / `dark:bg-neutral-800`)
- `--foreground` — uncolored score text (`text-neutral-900` /
  `dark:text-neutral-100`)
- `--muted-foreground` — zero score, null dash, badge label (`text-neutral-500`
  / `dark:text-neutral-400`)
- `--success` — positive score (`text-emerald-600` / `dark:text-emerald-400`)
  _new variable_
- `--destructive` — negative score (`text-red-600` / `dark:text-red-400`)

## badge/

- [x] Badge

**Variables used:**

- `--primary` / `--primary-foreground` — accent variant (`bg-accent-100` /
  `text-accent-800`)
- `--accent` / `--accent-foreground` — neutral variant (`bg-neutral-100` /
  `text-neutral-700`)
- `--success` / `--success-foreground` — success variant (`bg-emerald-100` /
  `text-emerald-800`) _new variable_
- `--warning` / `--warning-foreground` — warning variant (`bg-amber-100` /
  `text-amber-800`) _new variable_
- `--destructive` / `--destructive-foreground` — danger variant (`bg-red-100` /
  `text-red-800`)
- `--info` / `--info-foreground` — info variant (`bg-blue-100` /
  `text-blue-800`) _new variable_

## button/

- [x] Button

**Variables used:**

- `--primary` / `--primary-foreground` — primary variant (`bg-accent-600` /
  `text-white`, hover `bg-accent-700`)
- `--destructive` / `--destructive-foreground` — danger variant (`bg-red-600` /
  `text-white`, hover `bg-red-700`)
- `--input` — secondary/ghost background (`bg-white` / `dark:bg-neutral-800`)
- `--border` — secondary/ghost border (`border-neutral-300` /
  `dark:border-neutral-700`)
- `--foreground` — secondary/ghost text (`text-neutral-700` /
  `dark:text-neutral-300`)
- `--muted-foreground` — ghost icon color (`text-neutral-500` /
  `dark:text-neutral-400`)
- `--accent` — secondary/ghost hover (`hover:bg-neutral-50` /
  `dark:hover:bg-neutral-700`)

## card/

- [x] StickyCard

**Variables used:**

- `--background` — default/blur bg (`bg-neutral-50` / `dark:bg-neutral-900`)
- `--border` — divider line + mobile separator (`border-neutral-200` /
  `dark:border-neutral-800`)

## dropdown/

- [x] Dropdown
- [x] DropdownItem
- [x] DropdownSelect
- [x] CustomGroupManager

**Variables used:**

- `--popover` — dropdown background (`bg-white` / `dark:bg-neutral-800`)
- `--border` — dropdown border + item dividers (`border-neutral-200` /
  `dark:border-neutral-700`)
- `--foreground` — item text (`text-neutral-700` / `dark:text-neutral-300`)
- `--muted-foreground` — disabled item text, labels (`text-neutral-400` /
  `dark:text-neutral-600`)
- `--accent` — item hover (`hover:bg-neutral-100` / `dark:hover:bg-neutral-700`)
- `--primary` — selected checkmark (`text-accent-600` / `dark:text-accent-400`)
- `--destructive` — danger item text + hover (`text-red-600`, `hover:bg-red-50`)
- `--input` — CustomGroupManager input bg (`bg-white` / `dark:bg-neutral-800`)
- `--ring` — input focus ring (`focus:ring-accent-500`)

## form/

- [x] Autocomplete
- [x] FormInput
- [x] IconCheckbox
- [x] Input
- [x] KeyValueList
- [x] MarkdownInput
- [x] NumberInput
- [x] RangeScale
- [x] SearchDropdown
- [x] Select
- [x] TagInput

**FormInput variables used:**

- `--foreground` — label text (`text-neutral-900` / `dark:text-neutral-100`)
- `--muted-foreground` — description text (`text-neutral-600` /
  `dark:text-neutral-400`), placeholder (`placeholder-neutral-400` /
  `dark:placeholder-neutral-500`)
- `--input` — input/textarea background (`bg-white` / `dark:bg-neutral-800/50`)
- `--border` — input border (`border-neutral-300` /
  `dark:border-neutral-700/60`)
- `--muted` — readonly background (`bg-neutral-100` / `dark:bg-neutral-800/40`)
- `--destructive` — required asterisk (`text-red-500`)
- focus border uses neutral tones (`focus:border-neutral-400` /
  `dark:focus:border-neutral-600`)

**Input variables used:**

- `--input` — background (`bg-white` / `dark:bg-neutral-800`)
- `--foreground` — text (`text-neutral-900` / `dark:text-neutral-100`)
- `--muted-foreground` — placeholder (`placeholder:text-neutral-400` /
  `dark:placeholder:text-neutral-500`)
- `--border` — normal border (`border-neutral-300` / `dark:border-neutral-700`)
- `--destructive` — error border + bg (`border-red-400 bg-red-50` /
  `dark:border-red-500 dark:bg-red-900/20`)

**NumberInput variables used:**

- `--input` — input + stepper button background (`bg-white` /
  `dark:bg-neutral-800`, buttons `bg-white` / `dark:bg-neutral-700`)
- `--foreground` — input text (`text-neutral-900` / `dark:text-neutral-50`)
- `--muted-foreground` — placeholder, stepper icon color
  (`placeholder-neutral-400`, `text-neutral-600` / `dark:text-neutral-300`)
- `--border` — input + stepper borders (`border-neutral-300` /
  `dark:border-neutral-700`, buttons `dark:border-neutral-600`)
- `--accent` — stepper hover (`hover:bg-neutral-50` /
  `dark:hover:bg-neutral-600`)
- `--muted` — disabled background (`disabled:bg-neutral-100` /
  `dark:disabled:bg-neutral-900`)

**Select variables used:**

- `--input` — trigger + dropdown background (`bg-white` / `dark:bg-neutral-800`)
- `--foreground` — selected text, option text (`text-neutral-900` /
  `dark:text-neutral-100`)
- `--muted-foreground` — placeholder, chevron icon (`text-neutral-400` /
  `dark:text-neutral-500`)
- `--border` — trigger + dropdown border (`border-neutral-300` /
  `dark:border-neutral-700`, dropdown `border-neutral-200`)
- `--primary` — highlighted option (`bg-accent-100 text-accent-900` /
  `dark:bg-accent-900/30 dark:text-accent-100`)
- `--accent` — non-highlighted hover (`hover:bg-neutral-100` /
  `dark:hover:bg-neutral-700`)

**IconCheckbox variables used:**

- `--primary` — accent checked state (`border-accent-600 bg-accent-600` /
  `dark:border-accent-500 dark:bg-accent-500`)
- `--primary-foreground` — filled icon color (`text-white`)
- `--border` — unchecked border (`border-neutral-300` /
  `dark:border-neutral-700`)
- `--muted` — unchecked background (`bg-neutral-50` / `dark:bg-neutral-800`)
- `--accent` — unchecked hover (`hover:bg-neutral-100` /
  `dark:hover:bg-neutral-700`)
- `--success` — green checked (`border-green-600 bg-green-600` /
  `dark:border-green-500 dark:bg-green-500`)
- `--destructive` — red checked (`border-red-600 bg-red-600` /
  `dark:border-red-500 dark:bg-red-500`)
- `--info` — blue checked (`border-blue-600 bg-blue-600` /
  `dark:border-blue-500 dark:bg-blue-500`)
- Also supports arbitrary hex colors via inline styles

**TagInput variables used:**

- `--input` — container background (`bg-white` / `dark:bg-neutral-800/50`)
- `--border` — container border (`border-neutral-300` /
  `dark:border-neutral-700/60`)
- `--foreground` — input text (`text-neutral-900` / `dark:text-neutral-50`)
- `--muted-foreground` — placeholder, remove button (`text-neutral-400` /
  `dark:text-neutral-500`, `hover:text-neutral-600` /
  `dark:hover:text-neutral-200`)
- `--primary` — tags use Badge variant="accent"
- focus-within border uses neutral tones (`focus-within:border-neutral-400` /
  `dark:focus-within:border-neutral-600`)

**Autocomplete variables used:**

- `--input` — search input background (`bg-white` / `dark:bg-neutral-900`)
- `--border` — search input + option dividers (`border-neutral-300` /
  `dark:border-neutral-600`, `border-neutral-200` / `dark:border-neutral-700`)
- `--foreground` — search text (`text-neutral-900` / `dark:text-neutral-100`)
- `--muted-foreground` — search icon, placeholder, "no matches" text
  (`text-neutral-400` / `dark:text-neutral-500`)
- `--accent` — highlighted option (`bg-neutral-100` / `dark:bg-neutral-700`)
- `--popover` — dropdown bg (via Dropdown component)
- Trigger uses Button component (inherits button variables)

**SearchDropdown variables used:**

- `--input` — input background (`bg-white` / `dark:bg-neutral-800`)
- `--foreground` — input + option text (`text-neutral-900` /
  `dark:text-neutral-100`)
- `--muted-foreground` — placeholder, clear button (`placeholder-neutral-400` /
  `dark:placeholder-neutral-500`, `text-neutral-400` / `dark:text-neutral-500`)
- `--border` — input + dropdown border (`border-neutral-300` /
  `dark:border-neutral-700`, dropdown `border-neutral-200`)
- `--ring` — focus ring (`focus:ring-accent-500`)
- `--primary` — focus border (`focus:border-accent-500`)
- `--accent` — option hover (`hover:bg-neutral-100` /
  `dark:hover:bg-neutral-700`)
- `--popover` — dropdown background (`bg-white` / `dark:bg-neutral-800`)

**MarkdownInput variables used:**

- `--card-foreground` — label text (`text-neutral-700` /
  `dark:text-neutral-300`)
- `--muted-foreground` — description, placeholder, disabled text
  (`text-neutral-500` / `dark:text-neutral-400`, `placeholder-neutral-400` /
  `dark:placeholder-neutral-500`)
- `--muted` — toolbar background (`bg-neutral-50` / `dark:bg-neutral-800/50`)
- `--input` — textarea/input + preview background (`bg-white` /
  `dark:bg-neutral-800`)
- `--foreground` — input text (`text-neutral-900` / `dark:text-neutral-100`)
- `--border` — all borders (`border-neutral-300` / `dark:border-neutral-700`)
- `--accent` — toolbar button hover (`hover:bg-neutral-200` /
  `dark:hover:bg-neutral-700`)
- `--primary` — active preview toggle (`bg-accent-100 text-accent-700` /
  `dark:bg-accent-900/30 dark:text-accent-400`)
- `--destructive` — required asterisk (`text-red-500`)

**RangeScale variables used:**

- `--border` / `--muted` — track line (`bg-neutral-200` / `dark:bg-neutral-700`)
- 7 dedicated marker color pairs (dot + badge), not directly mappable to single
  variables:
  - accent: `bg-accent-500` / `bg-accent-100 text-accent-700`
  - blue: `bg-blue-500` / `bg-blue-100 text-blue-700`
  - green: `bg-green-500` / `bg-green-100 text-green-700`
  - orange: `bg-orange-500` / `bg-orange-100 text-orange-700`
  - red: `bg-red-500` / `bg-red-100 text-red-700`
  - purple: `bg-purple-500` / `bg-purple-100 text-purple-700`
  - neutral: `bg-neutral-500` / `bg-neutral-100 text-neutral-700`
- Note: this component uses many fixed semantic colors for its markers — may
  need a palette/scale approach rather than single variables

**KeyValueList variables used:**

- `--card-foreground` — label text (`text-neutral-700` /
  `dark:text-neutral-300`)
- `--muted-foreground` — description, column headers, version dots, add button
  text (`text-neutral-500` / `dark:text-neutral-400`, `text-neutral-600` /
  `dark:text-neutral-400`)
- `--input` — text input backgrounds (`bg-white` / `dark:bg-neutral-800`)
- `--border` — input borders, mobile card borders (`border-neutral-300` /
  `dark:border-neutral-700`, `border-neutral-200`)
- `--foreground` — input text (`text-neutral-900` / `dark:text-neutral-100`)
- `--destructive` — delete button hover (`hover:bg-red-50 hover:text-red-600` /
  `dark:hover:bg-red-900/20 dark:hover:text-red-400`)
- `--accent` — add button hover (`hover:bg-neutral-100` /
  `dark:hover:bg-neutral-800`)
- Also inherits NumberInput variables when valueType="version"

## meta/

- [x] CodeBlock
- [x] JsonView

**Variables used:**

- `--muted-foreground` — label text (`text-neutral-500` /
  `dark:text-neutral-400`)
- `--muted` — CodeBlock pre background (`bg-neutral-50` / `dark:bg-neutral-950`)
- `--border` — CodeBlock border, JsonView query divider + query block border
  (`border-neutral-200` / `dark:border-neutral-800`, `border-neutral-200` /
  `dark:border-neutral-700`)
- `--foreground` — code text (`text-neutral-800` / `dark:text-neutral-200`)
- `--accent` — query block background (`bg-neutral-100` / `dark:bg-neutral-900`)
- Note: syntax highlighting colors come from highlight.js theme, not component
  classes — will need a separate hljs theme per app theme

## modal/

- [x] DirtyModal
- [x] InfoModal
- [x] Modal

**Variables used:**

- `--background` — modal bg (`bg-white` / `dark:bg-neutral-900`)
- `--foreground` — header text (`text-neutral-900` / `dark:text-neutral-50`)
- `--muted-foreground` — body text, close button (`text-neutral-600` /
  `dark:text-neutral-400`, `text-neutral-500`)
- `--border` — modal border, header/footer dividers (`border-neutral-200` /
  `dark:border-neutral-700`, dividers `dark:border-neutral-800`)
- `--input` — cancel button bg (`bg-white` / `dark:bg-neutral-900`)
- `--primary` / `--primary-foreground` — confirm button
  (`bg-accent-600 text-white` / `dark:bg-accent-500`)
- `--destructive` / `--destructive-foreground` — danger confirm
  (`bg-red-600 text-white` / `dark:bg-red-500`)
- `--accent` — cancel hover, close hover (`hover:bg-neutral-50` /
  `dark:hover:bg-neutral-800`)
- Backdrop: `bg-black/50 backdrop-blur-sm` — may need `--overlay` variable
- Note: DirtyModal has no unique styling, just pre-configured Modal props

## navigation/bottomNav/

- [x] BottomNav

## navigation/navbar/

- [x] accentPicker
- [x] navbar
- [x] themeToggle

## navigation/pageNav/

- [x] group
- [x] groupHeader
- [x] groupItem
- [x] pageNav
- [x] version

## navigation/tabs/

- [x] Tabs

**Navigation variables used (all subfolders):**

_navbar + accentPicker + themeToggle:_

- `--background` — navbar bg (`bg-neutral-50` / `dark:bg-neutral-900`)
- `--border` — bottom/right border (`border-neutral-200` /
  `dark:border-neutral-800`)
- `--foreground` — brand text (`text-neutral-900` / `dark:text-neutral-100`)
- `--muted-foreground` — hamburger, icon colors (`text-neutral-500`,
  `text-neutral-700` / `dark:text-neutral-300`)
- `--accent` — button hover (`hover:bg-neutral-200` /
  `dark:hover:bg-neutral-800`)
- AccentPicker uses inline `style` for color dots + Dropdown component
- ThemeToggle icon color (`text-neutral-700` / `dark:text-neutral-300`)

_pageNav + group + groupHeader + groupItem + version:_

- `--background` — sidebar bg (`bg-neutral-50` / `dark:bg-neutral-900`)
- `--border` — sidebar border, version border, mobile header divider
  (`border-neutral-200` / `dark:border-neutral-800`, version
  `border-neutral-300` / `dark:border-neutral-700`)
- `--foreground` — brand text, version title, active item text
  (`text-neutral-900` / `dark:text-neutral-100`)
- `--muted-foreground` — inactive items, close button, chevron, version detail
  (`text-neutral-600` / `dark:text-neutral-400`)
- `--accent` — hover + active bg (`bg-neutral-200` / `dark:bg-neutral-800`,
  hover variants)
- Group vertical line: `bg-neutral-300` / `dark:bg-neutral-700`
- Note: groupItem uses Svelte 5 runes (`$props`, `$derived`) — inconsistent with
  project convention

_bottomNav:_

- `--background` — bar bg (`bg-neutral-50` / `dark:bg-neutral-900`)
- `--border` — top border (`border-neutral-200` / `dark:border-neutral-800`)
- `--primary` — active item (`text-accent-600` / `dark:text-accent-400`)
- `--muted-foreground` — inactive items (`text-neutral-500` /
  `dark:text-neutral-400`)

_tabs:_

- `--border` — bottom border, mobile trigger border (`border-neutral-200` /
  `dark:border-neutral-800`, trigger `border-neutral-700`)
- `--primary` — active tab underline + text (`border-accent-600 text-accent-600`
  / `dark:border-accent-500 dark:text-accent-500`)
- `--muted-foreground` — inactive tab, breadcrumb, back button
  (`text-neutral-600` / `dark:text-neutral-400`)
- `--input` — mobile trigger bg (`bg-white` / `dark:bg-neutral-800`)
- `--foreground` — mobile trigger text, breadcrumb current (`text-neutral-900` /
  `dark:text-neutral-100`)

## state/

- [x] EmptyState — _skipped, full-page layout not suited for showcase_

## table/

- [x] ExpandableTable
- [x] ReorderableList
- [x] Table
- [x] TableActionButton

**Table variables used:**

- `--muted` — table header bg (`bg-neutral-50` / `dark:bg-neutral-800`)
- `--card-foreground` — header text (`text-neutral-700` / `dark:text-neutral-300`)
- `--card` — body bg (`bg-white` / `dark:bg-neutral-900`)
- `--foreground` — cell text (`text-neutral-900` / `dark:text-neutral-100`)
- `--border` — outer border, row dividers, header border (`border-neutral-200` /
  `dark:border-neutral-800`)
- `--accent` — hoverable row hover (`hover:bg-neutral-50` /
  `dark:hover:bg-neutral-900`/`dark:hover:bg-neutral-800/50`)
- `--muted-foreground` — empty message, sort icons, mobile label text
  (`text-neutral-500` / `dark:text-neutral-400`)

**ExpandableTable variables used:**

- Same as Table, plus:
- `--muted` — expanded row bg (`bg-neutral-50` / `dark:bg-neutral-800/30`)
- `--primary` — sort arrow active (`text-accent-500`)
- Chevron icons use `text-neutral-400` / `dark:text-neutral-600`

**ReorderableList variables used:**

- `--muted` — item background (`bg-neutral-50` / `dark:bg-neutral-800`)
- `--border` — item border (`border-neutral-200` / `dark:border-neutral-700`)
- `--accent` — item hover (`hover:bg-neutral-100` / `dark:hover:bg-neutral-700`)

**TableActionButton variables used:**

- `--input` — button bg (`bg-white` / `dark:bg-neutral-900`)
- `--border` — button border (`border-neutral-300` / `dark:border-neutral-700`)
- `--foreground` — neutral icon (`text-neutral-700` / `dark:text-neutral-300`)
- `--destructive` — danger hover (`hover:border-red-300 hover:bg-red-50
hover:text-red-600` / dark equivalents)
- `--primary` — accent hover (`hover:border-accent-300 hover:bg-accent-50
hover:text-accent-600` / dark equivalents)

## toggle/

- [x] Toggle

**Variables used:**

- `--muted` — track background (`bg-neutral-200` / `dark:bg-neutral-700`)
- `--primary` — accent active (`bg-accent-500`)
- `--success` — green active (`bg-green-500`)
- `--destructive` — red active (`bg-red-500`)
- `--warning` — amber active (`bg-amber-500`)
- Inactive side: `bg-neutral-500 text-white` / `dark:bg-neutral-400
dark:text-neutral-900`
- Inactive icon: `text-neutral-400` / `dark:text-neutral-500`
