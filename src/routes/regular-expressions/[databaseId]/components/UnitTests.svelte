<script lang="ts">
	import { Check, X, AlertCircle, CircleCheck, CircleX } from 'lucide-svelte';
	import { fly } from 'svelte/transition';
	import type { Regex101UnitTest } from '../../regex101/types';
	import ActionsBar from '$ui/actions/ActionsBar.svelte';
	import ActionButton from '$ui/actions/ActionButton.svelte';
	import SearchAction from '$ui/actions/SearchAction.svelte';
	import ViewToggle from '$ui/actions/ViewToggle.svelte';
	import Dropdown from '$ui/dropdown/Dropdown.svelte';
	import Table from '$ui/table/Table.svelte';
	import Card from '$ui/card/Card.svelte';
	import CardGrid from '$ui/card/CardGrid.svelte';
	import Label from '$ui/label/Label.svelte';
	import type { Column } from '$ui/table/types';
	import { createDataPageStore } from '$lib/client/stores/dataPage';

	export let unitTests: Regex101UnitTest[] = [];
	export let loading: boolean = false;
	export let error: string | null = null;

	// Data page store for search + view
	const { search, view, filtered, setItems } = createDataPageStore(unitTests, {
		storageKey: 'regexUnitTestsView',
		searchKeys: ['testString', 'description'],
		defaultView: 'table'
	});

	// Pass filter state
	let showPassed = true;
	let showFailed = true;

	// Match filter state
	let showShouldMatch = true;
	let showShouldNotMatch = true;

	// Filter counts
	$: passedCount = unitTests.filter((t) => t.passed === true).length;
	$: failedCount = unitTests.filter((t) => t.passed === false).length;
	$: shouldMatchCount = unitTests.filter((t) => t.criteria === 'DOES_MATCH').length;
	$: shouldNotMatchCount = unitTests.filter((t) => t.criteria === 'DOES_NOT_MATCH').length;

	function applyFilters(tests: Regex101UnitTest[]): Regex101UnitTest[] {
		return tests.filter((test) => {
			if (!showPassed && test.passed === true) return false;
			if (!showFailed && test.passed === false) return false;
			if (!showShouldMatch && test.criteria === 'DOES_MATCH') return false;
			if (!showShouldNotMatch && test.criteria === 'DOES_NOT_MATCH') return false;
			return true;
		});
	}

	// Recompute when data or filters change
	$: (showPassed,
		showFailed,
		showShouldMatch,
		showShouldNotMatch,
		setItems(applyFilters(unitTests)));

	// Pass filter hover
	let passHovered = false;
	let passLeaveTimer: ReturnType<typeof setTimeout> | null = null;

	function passEnter() {
		if (passLeaveTimer) {
			clearTimeout(passLeaveTimer);
			passLeaveTimer = null;
		}
		passHovered = true;
	}
	function passLeave() {
		passLeaveTimer = setTimeout(() => {
			passHovered = false;
		}, 100);
	}

	// Match filter hover
	let matchHovered = false;
	let matchLeaveTimer: ReturnType<typeof setTimeout> | null = null;

	function matchEnter() {
		if (matchLeaveTimer) {
			clearTimeout(matchLeaveTimer);
			matchLeaveTimer = null;
		}
		matchHovered = true;
	}
	function matchLeave() {
		matchLeaveTimer = setTimeout(() => {
			matchHovered = false;
		}, 100);
	}

	const columns: Column<Regex101UnitTest>[] = [
		{
			key: 'testString',
			header: 'Test String',
			align: 'left'
		},
		{
			key: 'description',
			header: 'Description',
			align: 'left'
		},
		{
			key: 'criteria',
			header: 'Should Match',
			width: 'w-36',
			align: 'center'
		},
		{
			key: 'passed',
			header: 'Result',
			width: 'w-20',
			align: 'center'
		}
	];

	// Skeleton data for loading state
	const skeletonTests = Array.from({ length: 3 }, (_, i) => ({ id: i }));
</script>

{#if loading}
	<!-- Skeleton Loading -->
	<div class="space-y-2">
		{#each skeletonTests as skeleton (skeleton.id)}
			<Card padding="sm" flush>
				<div class="flex items-center gap-3">
					<div class="h-5 w-5 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700"></div>
					<div class="flex-1 space-y-1.5">
						<div class="h-3 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700"></div>
						<div class="h-4 w-48 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800"></div>
					</div>
					<div class="h-5 w-16 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-700"></div>
				</div>
			</Card>
		{/each}
	</div>
{:else if error}
	<!-- Error State -->
	<div
		class="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
	>
		<AlertCircle size={16} />
		<span>{error}</span>
	</div>
{:else if unitTests.length === 0}
	<!-- No Tests -->
	<p class="text-sm text-neutral-500 dark:text-neutral-400">No unit tests found for this regex.</p>
{:else}
	<!-- Actions Bar -->
	<ActionsBar>
		<SearchAction searchStore={search} placeholder="Search tests..." responsive />

		<!-- Pass/Fail Filter -->
		<div
			class="group relative flex"
			on:mouseenter={passEnter}
			on:mouseleave={passLeave}
			role="group"
		>
			<ActionButton icon={CircleCheck} title="Filter by result" />
			{#if passHovered}
				<div class="z-50" transition:fly={{ y: -8, duration: 150 }}>
					<Dropdown position="right">
						<div class="px-3 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
							Filter by result
						</div>
						<button
							type="button"
							class="flex w-full items-center gap-3 border-t border-neutral-200 px-3 py-2 text-left text-sm transition-colors hover:bg-neutral-50 dark:border-neutral-700/60 dark:hover:bg-neutral-700"
							on:click={() => (showPassed = !showPassed)}
						>
							<div
								class="flex h-4 w-4 items-center justify-center rounded border {showPassed
									? 'border-accent-600 bg-accent-600 dark:border-accent-500 dark:bg-accent-500'
									: 'border-neutral-300 dark:border-neutral-600'}"
							>
								{#if showPassed}
									<Check size={12} class="text-white" />
								{/if}
							</div>
							<span class="text-neutral-700 dark:text-neutral-300">Passed</span>
							<span class="ml-auto text-xs text-neutral-400">{passedCount}</span>
						</button>
						<button
							type="button"
							class="flex w-full items-center gap-3 border-t border-neutral-200 px-3 py-2 text-left text-sm transition-colors hover:bg-neutral-50 dark:border-neutral-700/60 dark:hover:bg-neutral-700"
							on:click={() => (showFailed = !showFailed)}
						>
							<div
								class="flex h-4 w-4 items-center justify-center rounded border {showFailed
									? 'border-accent-600 bg-accent-600 dark:border-accent-500 dark:bg-accent-500'
									: 'border-neutral-300 dark:border-neutral-600'}"
							>
								{#if showFailed}
									<Check size={12} class="text-white" />
								{/if}
							</div>
							<span class="text-neutral-700 dark:text-neutral-300">Failed</span>
							<span class="ml-auto text-xs text-neutral-400">{failedCount}</span>
						</button>
					</Dropdown>
				</div>
			{/if}
		</div>

		<!-- Should Match Filter -->
		<div
			class="group relative flex"
			on:mouseenter={matchEnter}
			on:mouseleave={matchLeave}
			role="group"
		>
			<ActionButton icon={CircleX} title="Filter by expected" />
			{#if matchHovered}
				<div class="z-50" transition:fly={{ y: -8, duration: 150 }}>
					<Dropdown position="right">
						<div class="px-3 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
							Filter by expected
						</div>
						<button
							type="button"
							class="flex w-full items-center gap-3 border-t border-neutral-200 px-3 py-2 text-left text-sm transition-colors hover:bg-neutral-50 dark:border-neutral-700/60 dark:hover:bg-neutral-700"
							on:click={() => (showShouldMatch = !showShouldMatch)}
						>
							<div
								class="flex h-4 w-4 items-center justify-center rounded border {showShouldMatch
									? 'border-accent-600 bg-accent-600 dark:border-accent-500 dark:bg-accent-500'
									: 'border-neutral-300 dark:border-neutral-600'}"
							>
								{#if showShouldMatch}
									<Check size={12} class="text-white" />
								{/if}
							</div>
							<span class="text-neutral-700 dark:text-neutral-300">Should Match</span>
							<span class="ml-auto text-xs text-neutral-400">{shouldMatchCount}</span>
						</button>
						<button
							type="button"
							class="flex w-full items-center gap-3 border-t border-neutral-200 px-3 py-2 text-left text-sm transition-colors hover:bg-neutral-50 dark:border-neutral-700/60 dark:hover:bg-neutral-700"
							on:click={() => (showShouldNotMatch = !showShouldNotMatch)}
						>
							<div
								class="flex h-4 w-4 items-center justify-center rounded border {showShouldNotMatch
									? 'border-accent-600 bg-accent-600 dark:border-accent-500 dark:bg-accent-500'
									: 'border-neutral-300 dark:border-neutral-600'}"
							>
								{#if showShouldNotMatch}
									<Check size={12} class="text-white" />
								{/if}
							</div>
							<span class="text-neutral-700 dark:text-neutral-300">Shouldn't Match</span>
							<span class="ml-auto text-xs text-neutral-400">{shouldNotMatchCount}</span>
						</button>
					</Dropdown>
				</div>
			{/if}
		</div>

		<ViewToggle bind:value={$view} />
	</ActionsBar>

	<!-- Content -->
	{#if $filtered.length === 0}
		<div
			class="mt-4 rounded-lg border border-neutral-200 bg-white p-6 text-center dark:border-neutral-800 dark:bg-neutral-900"
		>
			<p class="text-sm text-neutral-500 dark:text-neutral-400">
				No tests match the current filters.
			</p>
		</div>
	{:else if $view === 'table'}
		<!-- Table View -->
		<div class="mt-4">
			<Table
				data={$filtered}
				{columns}
				emptyMessage="No tests found"
				hoverable={false}
				compact={true}
			>
				<svelte:fragment slot="cell" let:row let:column>
					{#if column.key === 'testString'}
						<Label variant="secondary" size="md" rounded="md" mono>{row.testString}</Label>
					{:else if column.key === 'description'}
						{#if row.description}
							<span class="text-sm text-neutral-600 dark:text-neutral-400">{row.description}</span>
						{:else}
							<span class="text-neutral-400 dark:text-neutral-500">—</span>
						{/if}
					{:else if column.key === 'criteria'}
						<Label
							variant={row.criteria === 'DOES_MATCH' ? 'success' : 'danger'}
							size="sm"
							rounded="md"
						>
							{row.criteria === 'DOES_MATCH' ? 'Should Match' : "Shouldn't Match"}
						</Label>
					{:else if column.key === 'passed'}
						{#if row.passed === undefined}
							<div class="flex items-center justify-center">
								<div
									class="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800"
								>
									<span class="text-xs font-medium text-neutral-400 dark:text-neutral-500">?</span>
								</div>
							</div>
						{:else if row.passed}
							<div class="flex items-center justify-center">
								<div
									class="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900"
								>
									<Check size={14} class="text-emerald-600 dark:text-emerald-400" />
								</div>
							</div>
						{:else}
							<div class="flex items-center justify-center">
								<div
									class="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 dark:bg-red-900"
								>
									<X size={14} class="text-red-600 dark:text-red-400" />
								</div>
							</div>
						{/if}
					{/if}
				</svelte:fragment>
			</Table>
		</div>
	{:else}
		<!-- Card View -->
		<div class="mt-4">
			<CardGrid columns={1} gap="sm">
				{#each $filtered as test, idx (idx)}
					<Card padding="sm" flush>
						<!-- Desktop: 2 rows -->
						<div class="hidden space-y-2 md:block">
							<div class="flex items-start gap-2">
								<div class="min-w-0 flex-1">
									<span
										class="inline-flex flex-wrap items-center gap-1 rounded-md bg-neutral-100 px-2.5 py-1 font-mono text-xs font-medium break-all text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
										>{test.testString}</span
									>
								</div>
								<div class="shrink-0">
									<Label
										variant={test.criteria === 'DOES_MATCH' ? 'success' : 'danger'}
										size="sm"
										rounded="md"
									>
										{test.criteria === 'DOES_MATCH' ? 'Should Match' : "Shouldn't Match"}
									</Label>
								</div>
							</div>
							<div class="flex items-start gap-2">
								<div class="min-w-0 flex-1">
									{#if test.description}
										<p class="text-xs text-neutral-500 dark:text-neutral-400">{test.description}</p>
									{/if}
								</div>
								<div class="shrink-0">
									{#if test.passed === undefined}
										<Label variant="warning" size="sm" rounded="md">Unknown</Label>
									{:else if test.passed}
										<Label variant="success" size="sm" rounded="md">
											<Check size={10} />
											Passed
										</Label>
									{:else}
										<Label variant="danger" size="sm" rounded="md">
											<X size={10} />
											Failed
										</Label>
									{/if}
								</div>
							</div>
						</div>

						<!-- Mobile: stacked -->
						<div class="space-y-2 md:hidden">
							<span
								class="inline-flex flex-wrap items-center gap-1 rounded-md bg-neutral-100 px-2.5 py-1 font-mono text-xs font-medium break-all text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
								>{test.testString}</span
							>
							{#if test.description}
								<p class="text-xs text-neutral-500 dark:text-neutral-400">{test.description}</p>
							{/if}
							<div class="flex items-center gap-2">
								<Label
									variant={test.criteria === 'DOES_MATCH' ? 'success' : 'danger'}
									size="sm"
									rounded="md"
								>
									{test.criteria === 'DOES_MATCH' ? 'Should Match' : "Shouldn't Match"}
								</Label>
								{#if test.passed === undefined}
									<Label variant="warning" size="sm" rounded="md">Unknown</Label>
								{:else if test.passed}
									<Label variant="success" size="sm" rounded="md">
										<Check size={10} />
										Passed
									</Label>
								{:else}
									<Label variant="danger" size="sm" rounded="md">
										<X size={10} />
										Failed
									</Label>
								{/if}
							</div>
						</div>
					</Card>
				{/each}
			</CardGrid>
		</div>
	{/if}
{/if}
