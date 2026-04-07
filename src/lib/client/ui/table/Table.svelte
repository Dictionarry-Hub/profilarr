<script lang="ts" generics="T extends Record<string, any>">
	import { onMount, onDestroy } from 'svelte';
	import type { Column, SortDirection, SortState } from './types';
	import { createProgressiveList } from '$lib/client/utils/progressiveList';

	/**
	 * Props
	 */
	export let columns: Column<T>[];
	export let data: T[];
	export let hoverable: boolean = true;
	export let compact: boolean = false;
	export let emptyMessage: string = 'No data available';
	export let onRowClick: ((row: T) => void) | undefined = undefined;
	export let rowHref: ((row: T) => string) | undefined = undefined;
	export let initialSort: SortState | null = null;
	export let onSortChange: ((sort: SortState | null) => void) | undefined = undefined;
	export let actionsHeader: string = 'Actions';
	export let actionsHeaderAlign: 'left' | 'center' | 'right' = 'right';
	// Mobile responsive mode - switches to card layout on small screens
	export let responsive: boolean = false;
	// Progressive loading - render items in batches as user scrolls
	export let pageSize: number | undefined = undefined;

	let isMobile = false;
	let mediaQuery: MediaQueryList | null = null;

	onMount(() => {
		if (responsive && typeof window !== 'undefined') {
			mediaQuery = window.matchMedia('(max-width: 767px)');
			isMobile = mediaQuery.matches;
			mediaQuery.addEventListener('change', handleMediaChange);
		}
	});

	onDestroy(() => {
		if (mediaQuery) {
			mediaQuery.removeEventListener('change', handleMediaChange);
		}
	});

	function handleMediaChange(e: MediaQueryListEvent) {
		isMobile = e.matches;
	}

	$: useMobileLayout = responsive && isMobile;

	let sortKey: string | null = initialSort?.key ?? null;
	let sortDirection: SortDirection = initialSort?.direction ?? 'asc';
	let sortedData: T[] = data;

	/**
	 * Get cell value by key path (supports nested properties like 'user.name')
	 */
	function getCellValue(row: T, key: string): any {
		return key.split('.').reduce((obj, k) => obj?.[k], row);
	}

	/**
	 * Get alignment class
	 */
	function getAlignClass(align?: 'left' | 'center' | 'right'): string {
		switch (align) {
			case 'center':
				return 'text-center';
			case 'right':
				return 'text-right';
			default:
				return 'text-left';
		}
	}

	function toggleSort(column: Column<T>) {
		if (!column.sortable) {
			return;
		}

		if (sortKey === column.key) {
			if (sortDirection === 'asc') {
				sortDirection = 'desc';
			} else {
				sortKey = null;
				onSortChange?.(null);
				return;
			}
		} else {
			sortKey = column.key;
			sortDirection = column.defaultSortDirection ?? 'asc';
		}

		onSortChange?.(sortKey ? { key: sortKey, direction: sortDirection } : null);
	}

	function handleSortKeydown(event: KeyboardEvent, column: Column<T>) {
		if (event.key !== 'Enter' && event.key !== ' ') {
			return;
		}

		event.preventDefault();
		toggleSort(column);
	}

	function compareValues(a: any, b: any): number {
		if (a == null && b == null) return 0;
		if (a == null) return -1;
		if (b == null) return 1;

		if (typeof a === 'number' && typeof b === 'number') {
			return a - b;
		}

		if (a instanceof Date && b instanceof Date) {
			return a.getTime() - b.getTime();
		}

		return String(a).localeCompare(String(b));
	}

	function getSortValue(row: T, column: Column<T>) {
		if (column.sortAccessor) {
			return column.sortAccessor(row);
		}
		return getCellValue(row, column.key);
	}

	function sortData(rows: T[]): T[] {
		if (!sortKey) {
			return rows;
		}

		const column = columns.find((col) => col.key === sortKey);
		if (!column) {
			return rows;
		}

		const sorted = [...rows].sort((a, b) => {
			if (column.sortComparator) {
				return column.sortComparator(a, b);
			}

			const aValue = getSortValue(a, column);
			const bValue = getSortValue(b, column);
			return compareValues(aValue, bValue);
		});

		return sortDirection === 'desc' ? sorted.reverse() : sorted;
	}

	$: sortedData = sortKey ? sortData(data) : data;
	$: (sortKey, sortDirection, (sortedData = sortData(data)));

	// Progressive loading
	const progressive = pageSize ? createProgressiveList({ pageSize }) : null;
	const progressiveCount = progressive?.visibleCount;
	$: if (progressive) progressive.setTotalCount(sortedData.length);
	$: if (progressive) (sortedData, progressive.reset());
	$: displayData = progressiveCount ? sortedData.slice(0, $progressiveCount) : sortedData;
</script>

{#if useMobileLayout}
	<!-- Mobile Card Layout -->
	<div class="space-y-3">
		{#if displayData.length === 0}
			<div
				class="rounded-xl border border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500 dark:border-neutral-700/60 dark:bg-neutral-800/50 dark:text-neutral-400"
			>
				{emptyMessage}
			</div>
		{:else}
			{#each displayData as row, rowIndex}
				<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
				<div
					class="group/row relative overflow-hidden rounded-xl border border-neutral-300 bg-white dark:border-neutral-700/60 dark:bg-neutral-800/50 {onRowClick ||
					rowHref
						? 'cursor-pointer'
						: ''}"
					on:click={() => onRowClick && onRowClick(row)}
				>
					{#if rowHref}
						<a
							href={rowHref(row)}
							class="absolute inset-0 z-10"
							aria-label="Open {columns[0]?.header || 'item'}"
						></a>
					{/if}
					<!-- Primary row: first column as title + actions -->
					<div class="flex items-center justify-between gap-3 px-4 py-3">
						<div class="min-w-0 flex-1 font-medium text-neutral-900 dark:text-neutral-100">
							{#if columns[0].cell}
								{@const rendered = columns[0].cell(row)}
								{#if typeof rendered === 'string'}
									{rendered}
								{:else if typeof rendered === 'object' && 'html' in rendered}
									<!-- nosemgrep: profilarr.xss.at-html-usage, profilarr.xss.raw-variable-in-html -->
									{@html rendered.html}
								{:else}
									<svelte:component this={rendered} {row} />
								{/if}
							{:else}
								<slot name="cell" {row} column={columns[0]} {rowIndex}>
									{getCellValue(row, columns[0].key)}
								</slot>
							{/if}
						</div>
						{#if $$slots.actions}
							<div class="shrink-0">
								<slot name="actions" {row} {rowIndex} />
							</div>
						{/if}
					</div>

					<!-- Secondary columns as label-value pairs -->
					{#if columns.length > 1}
						<div class="space-y-2 border-t border-neutral-200 px-4 py-3 dark:border-neutral-700/60">
							{#each columns.slice(1) as column, colIndex}
								<div class="flex items-center justify-between gap-4 text-sm">
									<span class="shrink-0 text-neutral-500 dark:text-neutral-400"
										>{column.header}</span
									>
									<span class="min-w-0 text-right text-neutral-700 dark:text-neutral-300">
										{#if column.cell}
											{@const rendered = column.cell(row)}
											{#if typeof rendered === 'string'}
												{rendered}
											{:else if typeof rendered === 'object' && 'html' in rendered}
												<!-- nosemgrep: profilarr.xss.at-html-usage, profilarr.xss.raw-variable-in-html -->
												{@html rendered.html}
											{:else}
												<svelte:component this={rendered} {row} />
											{/if}
										{:else}
											<slot name="cell" {row} {column} rowIndex={colIndex + 1}>
												{getCellValue(row, column.key)}
											</slot>
										{/if}
									</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
			{#if progressive}
				<div use:progressive.sentinel></div>
			{/if}
		{/if}
	</div>
{:else}
	<!-- Desktop Table Layout -->
	<div class="overflow-x-auto rounded-xl border border-neutral-300 dark:border-neutral-700/60">
		<table class="w-full">
			<!-- Header -->
			<thead
				class="border-b border-neutral-300 bg-neutral-50 dark:border-neutral-700/60 dark:bg-neutral-800/50"
			>
				<tr>
					{#each columns as column}
						<th
							class={`${compact ? 'px-4 py-2.5' : 'px-6 py-3'} text-xs font-semibold text-neutral-500 dark:text-neutral-400 ${getAlignClass(column.align)} ${column.width || ''}`}
						>
							{#if column.sortable}
								<div
									role="button"
									tabindex="0"
									class={`group flex w-full items-center gap-1.5 text-xs font-semibold ${
										column.align === 'center'
											? 'justify-center'
											: column.align === 'right'
												? 'justify-end'
												: 'justify-start'
									}`}
									on:click={() => toggleSort(column)}
									on:keydown={(event) => handleSortKeydown(event, column)}
								>
									{#if column.headerIcon}
										<svelte:component this={column.headerIcon} size={14} />
									{/if}
									<span>{column.header}</span>
									<span
										class="text-[0.6rem] text-neutral-400 transition-opacity group-hover:text-neutral-600 group-hover:dark:text-neutral-200"
									>
										{#if sortKey === column.key}
											{sortDirection === 'asc' ? '▲' : '▼'}
										{:else}
											⇅
										{/if}
									</span>
								</div>
							{:else}
								<div
									class={`flex items-center gap-1.5 ${
										column.align === 'center'
											? 'justify-center'
											: column.align === 'right'
												? 'justify-end'
												: ''
									}`}
								>
									{#if column.headerIcon}
										<svelte:component this={column.headerIcon} size={14} />
									{/if}
									{column.header}
								</div>
							{/if}
						</th>
					{/each}
					<!-- Actions column slot -->
					{#if $$slots.actions}
						<th
							class={`${compact ? 'px-4 py-2.5' : 'px-6 py-3'} ${actionsHeaderAlign === 'left' ? 'text-left' : actionsHeaderAlign === 'center' ? 'text-center' : 'text-right'} text-xs font-semibold text-neutral-500 dark:text-neutral-400`}
						>
							{actionsHeader}
						</th>
					{/if}
				</tr>
			</thead>

			<!-- Body -->
			<tbody
				class="divide-y divide-neutral-200 bg-white dark:divide-neutral-700/40 dark:bg-neutral-900/50"
			>
				{#if displayData.length === 0}
					<tr>
						<td
							colspan={columns.length + ($$slots.actions ? 1 : 0)}
							class="px-6 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400"
						>
							{emptyMessage}
						</td>
					</tr>
				{:else}
					{#each displayData as row, rowIndex}
						<tr
							class="group/row {hoverable
								? 'transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800'
								: ''} {onRowClick || rowHref ? 'cursor-pointer' : ''}"
							on:click={() => onRowClick && onRowClick(row)}
						>
							{#each columns as column, colIndex}
								<td
									class={`${compact ? 'px-4 py-2' : 'px-6 py-4'} text-sm text-neutral-900 dark:text-neutral-100 ${getAlignClass(column.align)} ${column.width || ''} ${rowHref ? 'relative' : ''}`}
								>
									{#if rowHref}
										<a href={rowHref(row)} class="cell-link" aria-label="Open row"></a>
									{/if}
									{#if column.cell}
										{@const rendered = column.cell(row)}
										{#if typeof rendered === 'string'}
											{rendered}
										{:else if typeof rendered === 'object' && 'html' in rendered}
											<!-- nosemgrep: profilarr.xss.at-html-usage, profilarr.xss.raw-variable-in-html -->
											{@html rendered.html}
										{:else}
											<svelte:component this={rendered} {row} />
										{/if}
									{:else}
										<slot name="cell" {row} {column} {rowIndex}>
											{getCellValue(row, column.key)}
										</slot>
									{/if}
								</td>
							{/each}

							<!-- Actions slot -->
							{#if $$slots.actions}
								<td
									class={`${compact ? 'px-4 py-2' : 'px-6 py-4'} ${actionsHeaderAlign === 'left' ? 'text-left' : actionsHeaderAlign === 'center' ? 'text-center' : 'text-right'} text-sm`}
								>
									<slot name="actions" {row} {rowIndex} />
								</td>
							{/if}
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
		{#if progressive}
			<div use:progressive.sentinel></div>
		{/if}
	</div>
{/if}

<style>
	/* Cell link covers the entire cell for click/right-click */
	.cell-link {
		position: absolute;
		inset: 0;
		z-index: 1;
	}

	td :global(ul) {
		list-style-type: disc;
		padding-left: 1.5rem;
		margin: 0.5rem 0;
	}

	td :global(ol) {
		list-style-type: decimal;
		padding-left: 1.5rem;
		margin: 0.5rem 0;
	}

	td :global(li) {
		margin: 0.25rem 0;
	}

	td :global(p) {
		margin: 0.5rem 0;
	}

	td :global(strong) {
		font-weight: 600;
	}
</style>
