<script lang="ts">
	import type { DraftEntitySection, DraftEntitySectionRow, FieldRow, OperationType } from './types';
	import FieldDiffTable from './FieldDiffTable.svelte';
	import TagsDiffTable from './TagsDiffTable.svelte';
	import CustomFormatScoresTable from './CustomFormatScoresTable.svelte';
	import OrderedItemsDiff from './OrderedItemsDiff.svelte';
	import ConditionsDiffTable from './ConditionsDiffTable.svelte';
	import TestsDiffTable from './TestsDiffTable.svelte';
	import QualityDefinitionEntriesTable from './QualityDefinitionEntriesTable.svelte';

	export let sections: DraftEntitySection[] = [];
	export let operation: OperationType = 'update';

	function hasRows(rows: DraftEntitySectionRow[], kind: DraftEntitySectionRow['kind']): boolean {
		return rows.some((row) => row.kind === kind);
	}

	function getRows<T extends DraftEntitySectionRow['kind']>(
		rows: DraftEntitySectionRow[],
		kind: T
	): Extract<DraftEntitySectionRow, { kind: T }>[] {
		return rows.filter((row) => row.kind === kind) as Extract<DraftEntitySectionRow, { kind: T }>[];
	}

	function getNonTagFieldRows(rows: DraftEntitySectionRow[]): FieldRow[] {
		return getRows(rows, 'field').filter((row) => row.field !== 'tags');
	}

	function getTagsRow(rows: DraftEntitySectionRow[]): FieldRow | null {
		return getRows(rows, 'field').find((row) => row.field === 'tags') ?? null;
	}
</script>

<div class="space-y-5">
	{#each sections as section}
		<div class="space-y-3">
			<div class="text-sm font-semibold text-neutral-500 dark:text-neutral-400">
				{section.title}
			</div>

			{#if hasRows(section.rows, 'field')}
				{@const fieldRows = getNonTagFieldRows(section.rows)}
				{@const tagsRow = getTagsRow(section.rows)}
				{#if fieldRows.length > 0}
					<FieldDiffTable rows={fieldRows} {operation} />
				{/if}
				{#if tagsRow}
					<div class="space-y-2">
						<div class="text-sm font-medium text-neutral-600 dark:text-neutral-300">Tags</div>
						<TagsDiffTable
							removed={(tagsRow.remove ?? []).map((tag) => String(tag))}
							added={(tagsRow.add ?? []).map((tag) => String(tag))}
							{operation}
						/>
					</div>
				{/if}
			{/if}

			{#if hasRows(section.rows, 'custom_format_scores')}
				{#each getRows(section.rows, 'custom_format_scores') as scoreRow}
					<div class="space-y-2">
						<div class="text-sm font-medium text-neutral-600 dark:text-neutral-300">
							{scoreRow.label}
						</div>
						<CustomFormatScoresTable rows={scoreRow.rows} {operation} />
					</div>
				{/each}
			{/if}

			{#if hasRows(section.rows, 'conditions')}
				{#each getRows(section.rows, 'conditions') as conditionsRow}
					<div class="space-y-2">
						<ConditionsDiffTable rows={conditionsRow.rows} />
					</div>
				{/each}
			{/if}

			{#if hasRows(section.rows, 'tests')}
				{#each getRows(section.rows, 'tests') as testsRow}
					<div class="space-y-2">
						<TestsDiffTable rows={testsRow.rows} />
					</div>
				{/each}
			{/if}

			{#if hasRows(section.rows, 'ordered_items')}
				{#each getRows(section.rows, 'ordered_items') as itemsRow}
					<OrderedItemsDiff
						beforeItems={itemsRow.beforeItems ?? []}
						afterItems={itemsRow.afterItems ?? []}
						{operation}
					/>
				{/each}
			{/if}

			{#if hasRows(section.rows, 'quality_definition_entries')}
				{#each getRows(section.rows, 'quality_definition_entries') as entriesRow}
					<QualityDefinitionEntriesTable
						beforeEntries={entriesRow.beforeEntries ?? []}
						afterEntries={entriesRow.afterEntries ?? []}
						{operation}
					/>
				{/each}
			{/if}
		</div>
	{/each}
</div>
