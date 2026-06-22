<script lang="ts">
	import { getFilterFields, filterModes, type FilterField } from '$shared/upgrades/filters';
	import { selectors } from '$shared/upgrades/selectors';
	import { ArrowLeft } from 'lucide-svelte';
	import StickyCard from '$ui/card/StickyCard.svelte';
	import Button from '$ui/button/Button.svelte';
	import ExpandableTable from '$ui/table/ExpandableTable.svelte';
	import Table from '$ui/table/Table.svelte';
	import type { Column } from '$ui/table/types';

	const radarrFields = getFilterFields('radarr');
	const sonarrFields = getFilterFields('sonarr');

	// Filter fields with type labels
	const typeLabels: Record<string, string> = {
		boolean: 'Yes/No',
		select: 'Selection',
		text: 'Text',
		number: 'Number',
		date: 'Date'
	};

	const badgeBase = 'inline-flex items-center rounded font-medium px-1.5 py-0.5 text-[10px]';
	const badgeAccent = 'bg-accent-100 text-accent-800 dark:bg-accent-900 dark:text-accent-200';
	const badgeNeutral = 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300';

	const fieldColumns: Column<FilterField>[] = [
		{ key: 'label', header: 'Field', sortable: false },
		{
			key: 'valueType',
			header: 'Type',
			sortable: false,
			cell: (row) => ({
				// nosemgrep: profilarr.xss.table-cell-html-unescaped — hardcoded labels, not user content
				html: `<span class="${badgeBase} ${badgeAccent}">${typeLabels[row.valueType] || row.valueType}</span>`
			})
		},
		{ key: 'description', header: 'Description', sortable: false },
		{
			key: 'operators',
			header: 'Operators',
			sortable: false,
			cell: (row) => ({
				// nosemgrep: profilarr.xss.table-cell-html-unescaped — hardcoded labels, not user content
				html: row.operators
					.map((op) => `<span class="${badgeBase} ${badgeNeutral}">${op.label}</span>`)
					.join(' ')
			})
		}
	];

	// Selectors table
	const selectorColumns: Column<(typeof selectors)[0]>[] = [
		{ key: 'label', header: 'Selector', sortable: false },
		{ key: 'description', header: 'Description', sortable: false }
	];

	// Filter modes table
	const modeColumns: Column<(typeof filterModes)[0]>[] = [
		{ key: 'label', header: 'Mode', sortable: false },
		{ key: 'description', header: 'Description', sortable: false }
	];

	// Concepts for the main explanation
	const concepts = [
		{
			id: 'filters',
			name: 'Filters',
			summary: 'Rules that define what qualifies for upgrade',
			details:
				'Combine conditions with AND/OR logic. Example: monitored = true AND cutoff met = false AND (popularity > 30 OR year >= 2020). Rules can be nested into groups for complex logic.'
		},
		{
			id: 'selectors',
			name: 'Selectors',
			summary: 'How to prioritize from filtered results',
			details:
				'After filtering narrows the pool, the selector picks which items actually get searched. Random spreads searches evenly over time. Oldest/Newest prioritizes by when items were added. Lowest Score targets items most in need of upgrades. Most/Least Popular lets you prioritize based on TMDb popularity.'
		},
		{
			id: 'count-cooldown',
			name: 'Count & Cooldown',
			summary: 'Batch size and search throttling',
			details:
				"Count limits how many items get searched per run - prevents overwhelming your indexers. Cooldown (in hours) prevents re-searching the same item too soon. Items are tagged with the search date so they're skipped until the cooldown expires."
		},
		{
			id: 'cutoff',
			name: 'Cutoff %',
			summary: 'Quality score threshold for the Cutoff Met field',
			details:
				'The Cutoff Met filter field checks if an item\'s custom format score has reached this percentage of the profile\'s cutoff score. Set to 80% means items below 80% of their cutoff will have "Cutoff Met = false".'
		},
		{
			id: 'multiple-filters',
			name: 'Multiple Filters',
			summary: 'Different strategies for different content',
			details:
				'Create separate filters for different upgrade strategies. A "High Priority" filter for popular recent content, a "Backlog" filter for older items. The filter mode controls which runs each cycle - round robin cycles through in order, random shuffle picks one at random.'
		},
		{
			id: 'dry-run',
			name: 'Dry Run',
			summary: 'Test without downloading',
			details:
				'Click the "Dry Run" button to test your filters. The full filter/select pipeline runs and searches your indexers for releases, but skips downloading. Check the run history to see what would have been upgraded. Note: dry runs are rate-limited to once every 10 minutes since they still search indexers.'
		}
	];

	const conceptColumns: Column<(typeof concepts)[0]>[] = [
		{ key: 'name', header: 'Concept', sortable: false },
		{ key: 'summary', header: 'Summary', sortable: false }
	];

	function handleBack() {
		history.back();
	}
</script>

<svelte:head>
	<title>How Upgrades Work - Profilarr</title>
</svelte:head>

<div class="p-8">
	<StickyCard position="top">
		<div slot="left">
			<h1 class="text-xl font-semibold text-neutral-900 dark:text-neutral-50">How Upgrades Work</h1>
		</div>
		<div slot="right">
			<Button text="Back" icon={ArrowLeft} on:click={handleBack} />
		</div>
	</StickyCard>

	<div class="mt-6 space-y-8 px-4">
		<!-- Intro -->
		<div class="text-neutral-600 dark:text-neutral-400">
			<p>
				Radarr and Sonarr don't search for the best release. They monitor RSS feeds and grab the
				first thing that qualifies as an upgrade. To get optimal releases, you need manual searches.
				This module automates that: <span class="font-medium text-neutral-700 dark:text-neutral-300"
					>Filter</span
				>
				your library,
				<span class="font-medium text-neutral-700 dark:text-neutral-300">Select</span> items to
				search, then
				<span class="font-medium text-neutral-700 dark:text-neutral-300">Search</span> for better releases.
			</p>
		</div>

		<!-- Concepts -->
		<section>
			<h2 class="mb-3 text-lg font-semibold text-neutral-900 dark:text-neutral-100">Concepts</h2>
			<ExpandableTable
				columns={conceptColumns}
				data={concepts}
				getRowId={(row) => row.id}
				emptyMessage="No concepts"
				chevronPosition="right"
				flushExpanded
			>
				<svelte:fragment slot="expanded" let:row>
					<div class="px-6 py-4">
						<p class="text-sm text-neutral-600 dark:text-neutral-400">{row.details}</p>
					</div>
				</svelte:fragment>
			</ExpandableTable>
		</section>

		<!-- Selectors Reference -->
		<section>
			<h2 class="mb-3 text-lg font-semibold text-neutral-900 dark:text-neutral-100">Selectors</h2>
			<Table columns={selectorColumns} data={selectors} emptyMessage="No selectors" />
		</section>

		<!-- Filter Modes Reference -->
		<section>
			<h2 class="mb-3 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
				Filter Modes
			</h2>
			<Table columns={modeColumns} data={filterModes} emptyMessage="No modes" />
		</section>

		<!-- Filter Fields Reference -->
		<section>
			<h2 class="mb-3 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
				Radarr Filter Fields
			</h2>
			<Table columns={fieldColumns} data={radarrFields} emptyMessage="No fields" />
		</section>

		<section>
			<h2 class="mb-3 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
				Sonarr Filter Fields
			</h2>
			<Table columns={fieldColumns} data={sonarrFields} emptyMessage="No fields" />
		</section>
	</div>
</div>
