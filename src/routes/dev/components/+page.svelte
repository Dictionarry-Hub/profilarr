<script lang="ts">
	import ActionsBar from '$ui/actions/ActionsBar.svelte';
	import ActionButton from '$ui/actions/ActionButton.svelte';
	import SearchAction from '$ui/actions/SearchAction.svelte';
	import ViewToggle from '$ui/actions/ViewToggle.svelte';
	import Dropdown from '$ui/dropdown/Dropdown.svelte';
	import DropdownItem from '$ui/dropdown/DropdownItem.svelte';
	import DropdownSelect from '$ui/dropdown/DropdownSelect.svelte';
	import Badge from '$ui/badge/Badge.svelte';
	import Label from '$ui/label/Label.svelte';
	import Button from '$ui/button/Button.svelte';
	import StickyCard from '$ui/card/StickyCard.svelte';
	import Card from '$ui/card/Card.svelte';
	import CardGrid from '$ui/card/CardGrid.svelte';
	import Score from '$ui/arr/Score.svelte';
	import CustomFormatBadge from '$ui/arr/CustomFormatBadge.svelte';
	import FormInput from '$ui/form/FormInput.svelte';
	import NumberInput from '$ui/form/NumberInput.svelte';
	import IconCheckbox from '$ui/form/IconCheckbox.svelte';
	import TagInput from '$ui/form/TagInput.svelte';
	import SearchDropdown from '$ui/form/SearchDropdown.svelte';
	import MarkdownInput from '$ui/form/MarkdownInput.svelte';
	import RangeScale from '$ui/form/RangeScale.svelte';
	import type { Marker } from '$ui/form/RangeScale.svelte';
	import KeyValueList from '$ui/form/KeyValueList.svelte';
	import CodeBlock from '$ui/code/CodeBlock.svelte';
	import Modal from '$ui/modal/Modal.svelte';
	import InfoModal from '$ui/modal/InfoModal.svelte';
	import Tabs from '$ui/navigation/tabs/Tabs.svelte';
	import Toggle from '$ui/toggle/Toggle.svelte';
	import Table from '$ui/table/Table.svelte';
	import ExpandableTable from '$ui/table/ExpandableTable.svelte';
	import ReorderableList from '$ui/table/ReorderableList.svelte';
	import TableActionButton from '$ui/table/TableActionButton.svelte';
	import { createSearchStore } from '$lib/client/stores/search';
	import ComponentCard from './ComponentCard.svelte';
	import { Plus, Info, Trash2, FileText, Filter, Check, Star, Settings } from 'lucide-svelte';
	import type { ViewMode } from '$lib/client/stores/dataPage';

	const search = createSearchStore();
	const debouncedQuery = search.debouncedQuery;

	// Demo state
	const demoSearch = createSearchStore();
	let demoView: ViewMode = 'table';
	let demoDropdownOpen = false;
	let demoFormText = '';
	let demoFormPassword = '';
	let demoFormTextarea = '';
	let demoNumber: number | undefined = 50;
	let demoNumberCompact: number | undefined = 10;
	let demoTags = ['radarr', 'sonarr', '1080p'];
	const demoAutoOptions = [
		{ value: 'radarr', label: 'Radarr' },
		{ value: 'sonarr', label: 'Sonarr' },
		{ value: 'whisparr', label: 'Whisparr' },
		{ value: 'prowlarr', label: 'Prowlarr' },
		{ value: 'lidarr', label: 'Lidarr' },
		{ value: 'readarr', label: 'Readarr' }
	];
	let demoSearchDropdownValue: string | null = null;
	let demoModalOpen = false;
	let demoModalDanger = false;
	let demoInfoModalOpen = false;
	let demoKV: Record<string, string> = { API_KEY: 'abc123', BASE_URL: 'https://example.com' };
	let demoKVVersion: Record<string, string> = { minimum: '2.0.0', current: '3.1.0' };
	let demoRangeMarkers: Marker[] = [
		{ id: 'min', label: 'Min', color: 'blue', value: 20 },
		{ id: 'preferred', label: 'Preferred', color: 'accent', value: 50 },
		{ id: 'max', label: 'Max', color: 'red', value: 80 }
	];
	let demoRangeSingle: Marker[] = [
		{ id: 'threshold', label: 'Threshold', color: 'green', value: 60 }
	];
	let demoMarkdown = '**Bold** and *italic* text.\n\n- List item\n- Another item\n\n`inline code`';
	let demoMarkdownSingle = 'A single-line **markdown** input';
	let checkedAccent = true;
	let checkedBlue = true;
	let checkedGreen = true;
	let checkedRed = true;
	let checkedNeutral = true;
	let checkedOutline = true;
	let unchecked = false;
	let checkedSquare = true;
	let checkedCircle = true;
	let demoSelectValue = 'radarr';
	const demoSelectOptions = [
		{ value: 'radarr', label: 'Radarr' },
		{ value: 'sonarr', label: 'Sonarr' },
		{ value: 'whisparr', label: 'Whisparr' }
	];
	const demoTableData = [
		{ id: 1, name: 'HD-1080p', score: 150, status: 'Active' },
		{ id: 2, name: 'Ultra-HD', score: 200, status: 'Active' },
		{ id: 3, name: 'SD', score: -50, status: 'Disabled' }
	];
	const demoTableColumns = [
		{ key: 'name', header: 'Name', sortable: true },
		{ key: 'score', header: 'Score', sortable: true, align: 'right' as const },
		{ key: 'status', header: 'Status' }
	];
	let demoReorderItems = [
		{ id: 'a', label: 'First item' },
		{ id: 'b', label: 'Second item' },
		{ id: 'c', label: 'Third item' }
	];
	let demoToggleAccent = true;
	let demoToggleGreen = true;
	let demoToggleRed = false;
	let demoToggleAmber = false;

	interface Section {
		id: string;
		name: string;
		category: string;
	}

	const sections: Section[] = [
		{ id: 'actions', name: 'Actions', category: 'actions' },
		{ id: 'arr', name: 'Arr', category: 'arr' },
		{ id: 'badge', name: 'Badge', category: 'badge' },
		{ id: 'button', name: 'Button', category: 'button' },
		{ id: 'card', name: 'Card', category: 'card' },
		{ id: 'card-grid', name: 'CardGrid', category: 'card' },
		{ id: 'dropdown', name: 'Dropdown', category: 'dropdown' },
		{ id: 'form-input', name: 'FormInput', category: 'form' },
		{ id: 'number-input', name: 'NumberInput', category: 'form' },
		{ id: 'icon-checkbox', name: 'IconCheckbox', category: 'form' },
		{ id: 'tag-input', name: 'TagInput', category: 'form' },
		{ id: 'search-dropdown', name: 'SearchDropdown', category: 'form' },
		{ id: 'markdown-input', name: 'MarkdownInput', category: 'form' },
		{ id: 'range-scale', name: 'RangeScale', category: 'form' },
		{ id: 'key-value-list', name: 'KeyValueList', category: 'form' },
		{ id: 'label', name: 'Label', category: 'label' },
		{ id: 'meta', name: 'Meta', category: 'meta' },
		{ id: 'modal', name: 'Modal', category: 'modal' },
		{ id: 'navigation', name: 'Navigation', category: 'navigation' },
		{ id: 'table', name: 'Table', category: 'table' },
		{ id: 'toggle', name: 'Toggle', category: 'toggle' }
	];

	$: visibleIds = getVisibleIds(sections, $debouncedQuery);

	function getVisibleIds(items: Section[], query: string): Set<string> {
		if (!query) return new Set(items.map((s) => s.id));
		const q = query.toLowerCase();
		return new Set(
			items
				.filter((s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q))
				.map((s) => s.id)
		);
	}
</script>

<svelte:head>
	<title>Components | Dev</title>
</svelte:head>

<div class="space-y-6 px-4 pt-8 pb-8 md:px-8 md:pt-12">
	<h1 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Component Library</h1>

	<ActionsBar>
		<SearchAction searchStore={search} placeholder="Search components..." responsive />
	</ActionsBar>

	{#if visibleIds.size === 0}
		<div
			class="rounded-lg border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900"
		>
			<p class="text-neutral-500 dark:text-neutral-400">No components match your search.</p>
		</div>
	{/if}

	<!-- Actions -->
	{#if visibleIds.has('actions')}
		<ComponentCard
			name="Actions"
			paths={[
				'actions/ActionsBar',
				'actions/ActionButton',
				'actions/SearchAction',
				'actions/ViewToggle'
			]}
			description="ActionsBar groups action items with collapsed borders and auto-rounding. ActionButton provides icon buttons with optional hover dropdowns. SearchAction is a search input with responsive mobile modal. ViewToggle switches between card/table views."
		>
			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					Full bar (search + buttons + view toggle)
				</p>
				<ActionsBar>
					<SearchAction searchStore={demoSearch} placeholder="Search..." responsive />
					<ActionButton icon={Plus} title="Add" />
					<ActionButton icon={Filter} hasDropdown={true} dropdownPosition="right">
						<svelte:fragment slot="dropdown">
							<Dropdown position="right">
								<DropdownItem icon={FileText} label="Option A" />
								<DropdownItem icon={FileText} label="Option B" />
							</Dropdown>
						</svelte:fragment>
					</ActionButton>
					<ActionButton icon={Info} title="Info" />
					<ViewToggle bind:value={demoView} />
				</ActionsBar>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					Search only (single item rounding)
				</p>
				<ActionsBar>
					<SearchAction searchStore={demoSearch} placeholder="Search items..." responsive />
				</ActionsBar>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					Buttons only
				</p>
				<ActionsBar className="md:justify-start">
					<ActionButton icon={Plus} title="Add" />
					<ActionButton icon={Trash2} variant="danger" title="Delete" />
					<ActionButton icon={Info} title="Info" />
				</ActionsBar>
			</div>
		</ComponentCard>
	{/if}

	<!-- Arr -->
	{#if visibleIds.has('arr')}
		<ComponentCard
			name="Arr"
			paths={['arr/Score', 'arr/CustomFormatBadge']}
			description="Score displays a numeric value with sign and color coding (positive green, negative red, zero neutral). CustomFormatBadge shows a CF name with its score as a pill."
		>
			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					Score variants
				</p>
				<div class="flex flex-wrap items-center gap-4">
					<div class="flex items-center gap-2">
						<span class="text-xs text-neutral-500 dark:text-neutral-400">Positive:</span>
						<Score score={150} />
					</div>
					<div class="flex items-center gap-2">
						<span class="text-xs text-neutral-500 dark:text-neutral-400">Negative:</span>
						<Score score={-50} />
					</div>
					<div class="flex items-center gap-2">
						<span class="text-xs text-neutral-500 dark:text-neutral-400">Zero:</span>
						<Score score={0} />
					</div>
					<div class="flex items-center gap-2">
						<span class="text-xs text-neutral-500 dark:text-neutral-400">Null:</span>
						<Score score={null} />
					</div>
					<div class="flex items-center gap-2">
						<span class="text-xs text-neutral-500 dark:text-neutral-400">Uncolored:</span>
						<Score score={75} colored={false} />
					</div>
					<div class="flex items-center gap-2">
						<span class="text-xs text-neutral-500 dark:text-neutral-400">Small:</span>
						<Score score={42} size="sm" />
					</div>
				</div>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					Custom Format Badges
				</p>
				<div class="flex flex-wrap items-center gap-2">
					<CustomFormatBadge name="Remux" score={150} />
					<CustomFormatBadge name="BR-DISK" score={-10000} />
					<CustomFormatBadge name="x264" score={0} />
					<CustomFormatBadge name="DV HDR10+" score={50} />
				</div>
			</div>
		</ComponentCard>
	{/if}

	<!-- Badge -->
	{#if visibleIds.has('badge')}
		<ComponentCard
			name="Badge"
			paths={['badge/Badge']}
			description="Status/label pill with six color variants, two sizes, optional icon, and mono font option."
		>
			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">Variants</p>
				<div class="flex flex-wrap items-center gap-2">
					<Badge variant="accent">Accent</Badge>
					<Badge variant="neutral">Neutral</Badge>
					<Badge variant="success">Success</Badge>
					<Badge variant="warning">Warning</Badge>
					<Badge variant="danger">Danger</Badge>
					<Badge variant="info">Info</Badge>
				</div>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">Sizes</p>
				<div class="flex flex-wrap items-center gap-2">
					<Badge variant="accent" size="sm">Small</Badge>
					<Badge variant="accent" size="md">Medium</Badge>
				</div>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					Mono + icon
				</p>
				<div class="flex flex-wrap items-center gap-2">
					<Badge variant="neutral" mono>v2.0.0</Badge>
					<Badge variant="success" icon={Info}>With icon</Badge>
				</div>
			</div>
		</ComponentCard>
	{/if}

	<!-- Button -->
	{#if visibleIds.has('button')}
		<ComponentCard
			name="Button"
			paths={['button/Button']}
			description="Multi-variant button with primary, secondary, danger, and ghost styles. Supports three sizes, icons (left/right), responsive sizing, full-width, hide-text-on-mobile, and renders as an anchor when href is provided."
		>
			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">Variants</p>
				<div class="flex flex-wrap items-center gap-2">
					<Button text="Primary" variant="primary" />
					<Button text="Secondary" variant="secondary" />
					<Button text="Danger" variant="danger" />
					<Button text="Ghost" variant="ghost" />
				</div>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">Sizes</p>
				<div class="flex flex-wrap items-center gap-2">
					<Button text="Extra Small" variant="primary" size="xs" />
					<Button text="Small" variant="primary" size="sm" />
					<Button text="Medium" variant="primary" size="md" />
				</div>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					With icons
				</p>
				<div class="flex flex-wrap items-center gap-2">
					<Button text="Add" variant="primary" icon={Plus} />
					<Button text="Delete" variant="danger" icon={Trash2} />
					<Button text="Info" variant="ghost" icon={Info} />
					<Button text="Next" variant="secondary" icon={Filter} iconPosition="right" />
				</div>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">Disabled</p>
				<div class="flex flex-wrap items-center gap-2">
					<Button text="Primary" variant="primary" disabled />
					<Button text="Secondary" variant="secondary" disabled />
					<Button text="Danger" variant="danger" disabled />
					<Button text="Ghost" variant="ghost" disabled />
				</div>
			</div>
		</ComponentCard>
	{/if}

	<!-- Card -->
	{#if visibleIds.has('card')}
		<ComponentCard
			name="Card"
			paths={['card/Card', 'card/StickyCard']}
			description="Card is a structural container with optional header/body/footer slots separated by dividers. Supports padding sizes, hoverable state, click handler, and link mode (renders as anchor). StickyCard is a separate sticky header/footer bar with left/right slots."
		>
			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					Header + body + footer
				</p>
				<div class="max-w-sm">
					<Card>
						<svelte:fragment slot="header">
							<h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">HD-1080p</h3>
						</svelte:fragment>
						<p class="text-sm text-neutral-600 dark:text-neutral-400">
							A quality profile for 1080p content with remux preferences and HDR scoring.
						</p>
						<svelte:fragment slot="footer">
							<div class="flex items-center justify-between">
								<Badge variant="success" size="sm">Active</Badge>
								<Button text="Edit" variant="ghost" size="xs" icon={Settings} />
							</div>
						</svelte:fragment>
					</Card>
				</div>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					Body only (minimal)
				</p>
				<div class="max-w-sm">
					<Card>
						<p class="text-sm text-neutral-600 dark:text-neutral-400">
							A simple body-only card with no header or footer.
						</p>
					</Card>
				</div>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					Hoverable + clickable
				</p>
				<div class="max-w-sm">
					<Card hoverable onclick={() => {}}>
						<svelte:fragment slot="header">
							<h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
								Clickable Card
							</h3>
						</svelte:fragment>
						<p class="text-sm text-neutral-600 dark:text-neutral-400">
							Hover and click this card. Shows cursor and bg transition.
						</p>
					</Card>
				</div>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					Padding variants
				</p>
				<div class="grid gap-3 md:grid-cols-4">
					<Card padding="none">
						<div class="p-2 text-xs text-neutral-500 dark:text-neutral-400">none</div>
					</Card>
					<Card padding="sm">
						<p class="text-xs text-neutral-500 dark:text-neutral-400">sm</p>
					</Card>
					<Card padding="md">
						<p class="text-xs text-neutral-500 dark:text-neutral-400">md</p>
					</Card>
					<Card padding="lg">
						<p class="text-xs text-neutral-500 dark:text-neutral-400">lg</p>
					</Card>
				</div>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					StickyCard (scroll to see)
				</p>
				<div
					class="relative h-48 overflow-x-hidden overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-700"
				>
					<StickyCard position="top" variant="default">
						<svelte:fragment slot="left">
							<h1 class="text-neutral-900 dark:text-neutral-100">Page Title</h1>
							<p class="text-neutral-500 dark:text-neutral-400">Subtitle text</p>
						</svelte:fragment>
						<svelte:fragment slot="right">
							<Button text="Save" variant="primary" size="xs" />
							<Button text="Cancel" variant="ghost" size="xs" />
						</svelte:fragment>
					</StickyCard>
					<div class="p-4 pt-20">
						<div class="space-y-2">
							{#each Array(15) as _}<p class="text-sm text-neutral-400">Scroll content...</p>{/each}
						</div>
					</div>
				</div>
			</div>
		</ComponentCard>
	{/if}

	<!-- CardGrid -->
	{#if visibleIds.has('card-grid')}
		<ComponentCard
			name="CardGrid"
			paths={['card/CardGrid']}
			description="Responsive grid container for Card components. Automatically adjusts columns by breakpoint: 1 on mobile, scaling up to the configured max. Supports 1–4 columns and three gap sizes. Uses CSS Grid so cards in the same row share equal height."
		>
			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					3 columns (resize browser to see responsive)
				</p>
				<CardGrid columns={3}>
					<Card>
						<svelte:fragment slot="header">
							<h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Remux</h3>
						</svelte:fragment>
						<p class="text-sm text-neutral-600 dark:text-neutral-400">
							Full disc remux with lossless audio. This card has more text to demonstrate equal row
							heights across the grid.
						</p>
						<svelte:fragment slot="footer">
							<Badge variant="success" size="sm">+150</Badge>
						</svelte:fragment>
					</Card>
					<Card>
						<svelte:fragment slot="header">
							<h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">BR-DISK</h3>
						</svelte:fragment>
						<p class="text-sm text-neutral-600 dark:text-neutral-400">Raw disc image. Blocked.</p>
						<svelte:fragment slot="footer">
							<Badge variant="danger" size="sm">-10000</Badge>
						</svelte:fragment>
					</Card>
					<Card>
						<svelte:fragment slot="header">
							<h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">x264</h3>
						</svelte:fragment>
						<p class="text-sm text-neutral-600 dark:text-neutral-400">H.264 encode.</p>
						<svelte:fragment slot="footer">
							<Badge variant="neutral" size="sm">0</Badge>
						</svelte:fragment>
					</Card>
				</CardGrid>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					2 columns, small gap
				</p>
				<CardGrid columns={2} gap="sm">
					<Card padding="sm">
						<p class="text-sm text-neutral-600 dark:text-neutral-400">Left card</p>
					</Card>
					<Card padding="sm">
						<p class="text-sm text-neutral-600 dark:text-neutral-400">Right card</p>
					</Card>
				</CardGrid>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					4 columns, large gap
				</p>
				<CardGrid columns={4} gap="lg">
					{#each ['A', 'B', 'C', 'D'] as label}
						<Card hoverable onclick={() => {}}>
							<p class="text-center text-sm font-medium text-neutral-700 dark:text-neutral-300">
								{label}
							</p>
						</Card>
					{/each}
				</CardGrid>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					Flush (cards match page background)
				</p>
				<CardGrid columns={3} flush>
					{#each ['Flush A', 'Flush B', 'Flush C'] as label}
						<Card>
							<p class="text-center text-sm font-medium text-neutral-700 dark:text-neutral-300">
								{label}
							</p>
						</Card>
					{/each}
				</CardGrid>
			</div>
		</ComponentCard>
	{/if}

	<!-- Dropdown -->
	{#if visibleIds.has('dropdown')}
		<ComponentCard
			name="Dropdown"
			paths={[
				'dropdown/Dropdown',
				'dropdown/DropdownItem',
				'dropdown/DropdownSelect',
				'dropdown/CustomGroupManager'
			]}
			description="Dropdown is a positioned menu container. DropdownItem is a selectable row with optional icon, danger, and selected states. DropdownSelect composes Button + Dropdown into a select widget. CustomGroupManager is a specialized tag grouping form."
		>
			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					Dropdown + DropdownItem (hover to open)
				</p>
				<ActionsBar className="md:justify-start">
					<ActionButton icon={Filter} hasDropdown={true} dropdownPosition="left">
						<svelte:fragment slot="dropdown">
							<Dropdown position="left">
								<DropdownItem icon={FileText} label="Normal item" />
								<DropdownItem icon={Info} label="Selected item" selected />
								<DropdownItem icon={Trash2} label="Danger item" danger />
								<DropdownItem icon={Plus} label="Disabled item" disabled />
							</Dropdown>
						</svelte:fragment>
					</ActionButton>
				</ActionsBar>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					DropdownSelect
				</p>
				<div class="flex flex-wrap items-center gap-4">
					<DropdownSelect
						label="Arr type"
						bind:value={demoSelectValue}
						options={demoSelectOptions}
						position="left"
					/>
					<DropdownSelect
						bind:value={demoSelectValue}
						options={demoSelectOptions}
						position="left"
						compact
					/>
					<DropdownSelect
						bind:value={demoSelectValue}
						options={demoSelectOptions}
						position="left"
						disabled
					/>
				</div>
			</div>
		</ComponentCard>
	{/if}

	<!-- FormInput -->
	{#if visibleIds.has('form-input')}
		<ComponentCard
			name="FormInput"
			paths={['form/FormInput']}
			description="Labeled field wrapper supporting text, textarea, password (with visibility toggle), readonly, required, mono font, and sizing variants (sm/md/lg)."
		>
			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					Size variants
				</p>
				<div class="grid gap-3 md:grid-cols-3">
					<FormInput label="Small" size="sm" placeholder="Small input" bind:value={demoFormText} />
					<FormInput
						label="Medium"
						size="md"
						placeholder="Medium input"
						bind:value={demoFormText}
					/>
					<FormInput label="Large" size="lg" placeholder="Large input" bind:value={demoFormText} />
				</div>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					Text + textarea
				</p>
				<div class="grid gap-3 md:grid-cols-2">
					<FormInput label="Text" placeholder="Enter text..." bind:value={demoFormText} />
					<FormInput
						label="Textarea"
						textarea
						placeholder="Multi-line input..."
						bind:value={demoFormTextarea}
					/>
				</div>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					Password (toggle visibility)
				</p>
				<div class="max-w-sm">
					<FormInput
						label="Password"
						private_
						placeholder="Enter password..."
						bind:value={demoFormPassword}
					/>
				</div>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					Readonly + required + mono
				</p>
				<div class="grid gap-3 md:grid-cols-3">
					<FormInput label="Readonly" value="Cannot edit" readonly />
					<FormInput label="Required" placeholder="Required field" required />
					<FormInput label="Mono" value="font-mono text" mono />
				</div>
			</div>
		</ComponentCard>
	{/if}

	<!-- NumberInput -->
	{#if visibleIds.has('number-input')}
		<ComponentCard
			name="NumberInput"
			paths={['form/NumberInput']}
			description="Numeric input with custom increment/decrement stepper buttons. Supports min/max/step constraints, compact sizing, responsive auto-compact, mono/sans font, and disabled state. Hides steppers on mobile when responsive."
		>
			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					Default + compact
				</p>
				<div class="flex flex-wrap items-center gap-3">
					<div class="w-32">
						<NumberInput
							name="demo-num"
							bind:value={demoNumber}
							min={0}
							max={100}
							placeholder="0–100"
						/>
					</div>
					<div class="w-24">
						<NumberInput
							name="demo-num-compact"
							bind:value={demoNumberCompact}
							min={0}
							max={99}
							compact
							placeholder="0–99"
						/>
					</div>
				</div>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					Mono font + disabled
				</p>
				<div class="flex flex-wrap items-center gap-3">
					<div class="w-32">
						<NumberInput name="demo-num-mono" value={42} font="mono" />
					</div>
					<div class="w-32">
						<NumberInput name="demo-num-disabled" value={0} disabled />
					</div>
				</div>
			</div>
		</ComponentCard>
	{/if}

	<!-- IconCheckbox -->
	{#if visibleIds.has('icon-checkbox')}
		<ComponentCard
			name="IconCheckbox"
			paths={['form/IconCheckbox']}
			description="Icon-based checkbox toggle with five named colors (accent, blue, green, red, neutral) plus hex color support. Two variants (filled/outline), three shapes (rounded, square, circle). Used for toggling custom formats, conditions, etc."
		>
			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					Colors (filled)
				</p>
				<div class="flex flex-wrap items-center gap-3">
					<div class="flex items-center gap-1.5">
						<IconCheckbox icon={Check} color="accent" bind:checked={checkedAccent} />
						<span class="text-xs text-neutral-500 dark:text-neutral-400">Accent</span>
					</div>
					<div class="flex items-center gap-1.5">
						<IconCheckbox icon={Check} color="blue" bind:checked={checkedBlue} />
						<span class="text-xs text-neutral-500 dark:text-neutral-400">Blue</span>
					</div>
					<div class="flex items-center gap-1.5">
						<IconCheckbox icon={Check} color="green" bind:checked={checkedGreen} />
						<span class="text-xs text-neutral-500 dark:text-neutral-400">Green</span>
					</div>
					<div class="flex items-center gap-1.5">
						<IconCheckbox icon={Check} color="red" bind:checked={checkedRed} />
						<span class="text-xs text-neutral-500 dark:text-neutral-400">Red</span>
					</div>
					<div class="flex items-center gap-1.5">
						<IconCheckbox icon={Check} color="neutral" bind:checked={checkedNeutral} />
						<span class="text-xs text-neutral-500 dark:text-neutral-400">Neutral</span>
					</div>
					<div class="flex items-center gap-1.5">
						<IconCheckbox icon={Star} color="#FFC230" checked />
						<span class="text-xs text-neutral-500 dark:text-neutral-400">Hex</span>
					</div>
				</div>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					Outline variant
				</p>
				<div class="flex flex-wrap items-center gap-3">
					<IconCheckbox
						icon={Check}
						color="accent"
						variant="outline"
						bind:checked={checkedOutline}
					/>
					<IconCheckbox icon={Check} color="green" variant="outline" checked />
					<IconCheckbox icon={Check} color="red" variant="outline" checked />
					<IconCheckbox icon={Check} color="blue" variant="outline" checked />
					<IconCheckbox icon={Check} color="neutral" variant="outline" checked />
				</div>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					Shapes + unchecked + disabled
				</p>
				<div class="flex flex-wrap items-center gap-3">
					<div class="flex items-center gap-1.5">
						<IconCheckbox icon={Check} shape="rounded" bind:checked={checkedSquare} />
						<span class="text-xs text-neutral-500 dark:text-neutral-400">Rounded</span>
					</div>
					<div class="flex items-center gap-1.5">
						<IconCheckbox icon={Check} shape="square" bind:checked={checkedSquare} />
						<span class="text-xs text-neutral-500 dark:text-neutral-400">Square</span>
					</div>
					<div class="flex items-center gap-1.5">
						<IconCheckbox icon={Check} shape="circle" bind:checked={checkedCircle} />
						<span class="text-xs text-neutral-500 dark:text-neutral-400">Circle</span>
					</div>
					<div class="flex items-center gap-1.5">
						<IconCheckbox icon={Check} bind:checked={unchecked} />
						<span class="text-xs text-neutral-500 dark:text-neutral-400">Unchecked</span>
					</div>
					<div class="flex items-center gap-1.5">
						<IconCheckbox icon={Check} checked disabled />
						<span class="text-xs text-neutral-500 dark:text-neutral-400">Disabled</span>
					</div>
				</div>
			</div>
		</ComponentCard>
	{/if}

	<!-- TagInput -->
	{#if visibleIds.has('tag-input')}
		<ComponentCard
			name="TagInput"
			paths={['form/TagInput']}
			description="Tag entry field with accent Badge chips. Type and press Enter to add, click X or Backspace to remove. Duplicate detection with alert toast. Tags render as Badge components inside a styled input container."
		>
			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					Interactive (try adding/removing)
				</p>
				<div class="max-w-lg">
					<TagInput bind:tags={demoTags} placeholder="Add a tag..." />
				</div>
			</div>
		</ComponentCard>
	{/if}

	<!-- SearchDropdown -->
	{#if visibleIds.has('search-dropdown')}
		<ComponentCard
			name="SearchDropdown"
			paths={['form/SearchDropdown']}
			description="Single-select searchable input styled like FormInput. Filters options as you type, shows a clear button when selected, supports label/description, sizes, disabled state, and custom item slot."
		>
			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					Default + disabled
				</p>
				<div class="flex flex-wrap items-start gap-4">
					<div class="w-56">
						<SearchDropdown
							options={demoAutoOptions}
							bind:value={demoSearchDropdownValue}
							placeholder="Search arrs..."
							on:change={(e) => (demoSearchDropdownValue = e.detail)}
						/>
					</div>
					<div class="w-56">
						<SearchDropdown options={demoAutoOptions} placeholder="Disabled" disabled />
					</div>
				</div>
			</div>
		</ComponentCard>
	{/if}

	<!-- MarkdownInput -->
	{#if visibleIds.has('markdown-input')}
		<ComponentCard
			name="MarkdownInput"
			paths={['form/MarkdownInput']}
			description="Markdown-enabled textarea or single-line input with formatting toolbar (bold, italic, code, link, lists) and live preview toggle. Supports Ctrl+B/I shortcuts, label, description, required, and disabled states."
		>
			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					Multiline with toolbar
				</p>
				<MarkdownInput
					label="Description"
					description="Supports **markdown** formatting"
					placeholder="Write something..."
					bind:value={demoMarkdown}
					rows={4}
				/>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					Single-line
				</p>
				<MarkdownInput
					label="Title"
					placeholder="Single-line markdown..."
					bind:value={demoMarkdownSingle}
					multiline={false}
				/>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">Disabled</p>
				<MarkdownInput label="Locked" value="Cannot edit this" disabled rows={2} />
			</div>
		</ComponentCard>
	{/if}

	<!-- RangeScale -->
	{#if visibleIds.has('range-scale')}
		<ComponentCard
			name="RangeScale"
			paths={['form/RangeScale']}
			description="Draggable range slider with multiple color-coded markers and badge labels. Supports 7 marker colors (accent, blue, green, orange, red, purple, neutral), horizontal/vertical orientation, step snapping, min separation between markers, unit suffixes, and unlimited value display."
		>
			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					Multiple markers (drag to adjust)
				</p>
				<div class="px-4 py-8">
					<RangeScale min={0} max={100} step={5} bind:markers={demoRangeMarkers} unit="%" />
				</div>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					Single marker
				</p>
				<div class="px-4 py-8">
					<RangeScale min={0} max={100} step={1} bind:markers={demoRangeSingle} />
				</div>
			</div>
		</ComponentCard>
	{/if}

	<!-- KeyValueList -->
	{#if visibleIds.has('key-value-list')}
		<ComponentCard
			name="KeyValueList"
			paths={['form/KeyValueList']}
			description="Dynamic key-value pair editor with add/remove. Supports text and version value types (version uses NumberInput steppers for major.minor.patch). Responsive layout: stacked cards on mobile, grid on desktop. Supports locked first entry, custom labels, and add-disabled state."
		>
			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					Text mode
				</p>
				<KeyValueList
					bind:value={demoKV}
					label="Environment Variables"
					description="Add key-value pairs"
					keyPlaceholder="Variable name"
					valuePlaceholder="Value"
				/>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					Version mode
				</p>
				<KeyValueList
					bind:value={demoKVVersion}
					label="Version Constraints"
					valueType="version"
					keyPlaceholder="Constraint name"
				/>
			</div>
		</ComponentCard>
	{/if}

	<!-- Label -->
	{#if visibleIds.has('label')}
		<ComponentCard
			name="Label"
			paths={['label/Label']}
			description="Inline label/tag pill with eight color variants (default, secondary, destructive, outline, ghost, success, warning, info), three sizes, three border-radius options, optional mono font, and optional href (renders as anchor)."
		>
			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">Variants</p>
				<div class="flex flex-wrap items-center gap-2">
					<Label variant="default">Default</Label>
					<Label variant="secondary">Secondary</Label>
					<Label variant="destructive">Destructive</Label>
					<Label variant="outline">Outline</Label>
					<Label variant="ghost">Ghost</Label>
					<Label variant="success">Success</Label>
					<Label variant="warning">Warning</Label>
					<Label variant="info">Info</Label>
				</div>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">Sizes</p>
				<div class="flex flex-wrap items-center gap-2">
					<Label size="sm">Small</Label>
					<Label size="md">Medium</Label>
					<Label size="lg">Large</Label>
				</div>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">Rounded</p>
				<div class="flex flex-wrap items-center gap-2">
					<Label rounded="sm">Rounded SM</Label>
					<Label rounded="md">Rounded MD</Label>
					<Label rounded="full">Rounded Full</Label>
				</div>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					Mono + link
				</p>
				<div class="flex flex-wrap items-center gap-2">
					<Label variant="ghost" mono>v2.0.0</Label>
					<Label variant="secondary" mono>1080p</Label>
					<Label variant="info" href="#label">Link label</Label>
				</div>
			</div>
		</ComponentCard>
	{/if}

	<!-- Meta -->
	{#if visibleIds.has('meta')}
		<ComponentCard
			name="Code"
			paths={['code/CodeBlock', 'code/InlineCode']}
			description="CodeBlock renders syntax-highlighted code (SQL, JSON, plaintext) with a themed code area, header slot, and copy button. InlineCode renders inline code snippets with optional icon."
		>
			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					CodeBlock (SQL)
				</p>
				<CodeBlock
					code="SELECT * FROM profiles\nWHERE name = 'HD-1080p'\nORDER BY id;"
					language="sql"
				/>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					CodeBlock (JSON)
				</p>
				<CodeBlock
					code={'{\n  "name": "HD-1080p",\n  "cutoff": 7,\n  "items": [4, 7, 3]\n}'}
					language="json"
				/>
			</div>
		</ComponentCard>
	{/if}

	<!-- Modal -->
	{#if visibleIds.has('modal')}
		<ComponentCard
			name="Modal"
			paths={['modal/Modal', 'modal/InfoModal', 'modal/DirtyModal']}
			description="Modal is the base confirm/cancel dialog with header, body slot, footer buttons, size/height options, loading state, and danger variant. InfoModal is a read-only modal with close button and body slot. DirtyModal is a pre-configured Modal for unsaved changes warnings (no unique styling)."
		>
			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					Modal (confirm/cancel)
				</p>
				<div class="flex flex-wrap items-center gap-2">
					<Button
						text="Open Modal"
						variant="primary"
						size="sm"
						on:click={() => (demoModalOpen = true)}
					/>
					<Button
						text="Open Danger Modal"
						variant="danger"
						size="sm"
						on:click={() => {
							demoModalDanger = true;
							demoModalOpen = true;
						}}
					/>
				</div>
				<Modal
					bind:open={demoModalOpen}
					header={demoModalDanger ? 'Delete Profile' : 'Confirm Action'}
					bodyMessage={demoModalDanger
						? 'This will permanently delete the profile. This cannot be undone.'
						: 'Are you sure you want to proceed with this action?'}
					confirmText={demoModalDanger ? 'Delete' : 'Confirm'}
					confirmDanger={demoModalDanger}
					on:confirm={() => {
						demoModalOpen = false;
						demoModalDanger = false;
					}}
					on:cancel={() => {
						demoModalOpen = false;
						demoModalDanger = false;
					}}
				/>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					InfoModal (read-only)
				</p>
				<Button
					text="Open Info Modal"
					variant="secondary"
					size="sm"
					on:click={() => (demoInfoModalOpen = true)}
				/>
				<InfoModal bind:open={demoInfoModalOpen} header="About Profiles">
					<div class="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
						<p>Profiles define quality preferences for your media library.</p>
						<p>Each profile can have custom formats, quality cutoffs, and upgrade rules.</p>
					</div>
				</InfoModal>
			</div>
		</ComponentCard>
	{/if}

	<!-- Navigation -->
	{#if visibleIds.has('navigation')}
		<ComponentCard
			name="Tabs"
			paths={['navigation/tabs/Tabs']}
			description="Responsive tab bar with active state underline, optional icons, breadcrumb, and back button. On mobile (when responsive), collapses to a dropdown select. Navbar, pageNav, bottomNav, accentPicker, themeToggle are app chrome — visible in the live layout already."
		>
			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					With icons + breadcrumb
				</p>
				<Tabs
					tabs={[
						{ label: 'Overview', href: '#tab-overview', active: true, icon: Info },
						{ label: 'Settings', href: '#tab-settings', active: false, icon: Settings },
						{ label: 'Logs', href: '#tab-logs', active: false, icon: FileText }
					]}
					breadcrumb={{ items: [{ label: 'Dev', href: '/dev' }], current: 'Components' }}
				/>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					Plain tabs
				</p>
				<Tabs
					tabs={[
						{ label: 'General', href: '#tab-general', active: true },
						{ label: 'Advanced', href: '#tab-advanced', active: false },
						{ label: 'Danger Zone', href: '#tab-danger', active: false }
					]}
				/>
			</div>
		</ComponentCard>
	{/if}

	<!-- Table -->
	{#if visibleIds.has('table')}
		<ComponentCard
			name="Table"
			paths={[
				'table/Table',
				'table/ExpandableTable',
				'table/ReorderableList',
				'table/TableActionButton'
			]}
			description="Table is a generic sortable data table with responsive mobile card layout. ExpandableTable adds expandable rows with chevron toggles. ReorderableList provides drag-and-drop ordering. TableActionButton is a compact icon button for table row actions."
		>
			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					Table (sortable, click headers)
				</p>
				<Table columns={demoTableColumns} data={demoTableData} compact>
					<svelte:fragment slot="actions" let:row>
						<TableActionButton icon={Trash2} title="Delete" variant="danger" />
					</svelte:fragment>
				</Table>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					ExpandableTable (click rows to expand)
				</p>
				<ExpandableTable
					columns={demoTableColumns}
					data={demoTableData}
					getRowId={(row) => row.id}
					compact
				>
					<svelte:fragment slot="expanded" let:row>
						<p class="text-sm text-neutral-500 dark:text-neutral-400">
							Details for {row.name} — score: {row.score}, status: {row.status}
						</p>
					</svelte:fragment>
				</ExpandableTable>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					ReorderableList (drag to reorder)
				</p>
				<ReorderableList
					items={demoReorderItems}
					getKey={(item) => item.id}
					onReorder={(items) => (demoReorderItems = items)}
				>
					<svelte:fragment let:item let:index>
						<div class="flex items-center gap-3">
							<span class="font-mono text-xs text-neutral-400">{index + 1}</span>
							<span class="text-sm text-neutral-700 dark:text-neutral-300">{item.label}</span>
						</div>
					</svelte:fragment>
				</ReorderableList>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
					TableActionButton variants
				</p>
				<div class="flex items-center gap-2">
					<TableActionButton icon={Info} title="Info" variant="neutral" />
					<TableActionButton icon={Trash2} title="Delete" variant="danger" />
					<TableActionButton icon={Settings} title="Settings" variant="accent" />
					<TableActionButton icon={Info} title="Small" variant="neutral" size="sm" />
					<TableActionButton icon={Info} title="Disabled" variant="neutral" disabled />
				</div>
			</div>
		</ComponentCard>
	{/if}

	<!-- Toggle -->
	{#if visibleIds.has('toggle')}
		<ComponentCard
			name="Toggle"
			paths={['toggle/Toggle']}
			description="Card-style toggle with optional label text and IconCheckbox on the right. Supports color variants, disabled state, and fires change events."
		>
			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">Colors</p>
				<div class="grid gap-3 md:grid-cols-2">
					<Toggle color="accent" bind:checked={demoToggleAccent} label="Accent" />
					<Toggle color="green" bind:checked={demoToggleGreen} label="Green" />
					<Toggle color="red" bind:checked={demoToggleRed} label="Red" />
					<Toggle color="amber" bind:checked={demoToggleAmber} label="Amber" />
				</div>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">Disabled</p>
				<div class="flex flex-wrap items-center gap-4">
					<Toggle color="accent" checked disabled label="Disabled on" />
					<Toggle color="accent" checked={false} disabled label="Disabled off" />
				</div>
			</div>

			<div class="space-y-3">
				<p class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">No label</p>
				<div class="flex flex-wrap items-center gap-4">
					<Toggle color="accent" bind:checked={demoToggleAccent} ariaLabel="Accent toggle" />
					<Toggle color="green" bind:checked={demoToggleGreen} ariaLabel="Green toggle" />
				</div>
			</div>
		</ComponentCard>
	{/if}
</div>
