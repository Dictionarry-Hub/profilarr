<script lang="ts">
	import Table from '$ui/table/Table.svelte';
	import Label from '$ui/label/Label.svelte';
	import type { Column } from '$ui/table/types';
	import type { DriftDisplayChange, DriftDisplayTone, DriftDisplayValue } from '$shared/drift.ts';
	import QualityListDiff from './QualityListDiff.svelte';

	export let changes: DriftDisplayChange[];
	export let arrLabel = 'Arr';

	type LabelVariant = 'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';

	const toneToVariant: Record<DriftDisplayTone, LabelVariant> = {
		neutral: 'secondary',
		success: 'success',
		warning: 'warning',
		danger: 'danger',
		info: 'info'
	};

	function valueVariant(value: DriftDisplayValue): LabelVariant {
		return toneToVariant[value.tone ?? 'neutral'];
	}

	$: columns = [
		{ key: 'label', header: 'Field' },
		{ key: 'expected', header: 'Profilarr' },
		{ key: 'actual', header: arrLabel }
	] satisfies Column<DriftDisplayChange>[];
</script>

<Table {columns} data={changes} compact hoverable={false} responsive>
	<svelte:fragment slot="cell" let:row let:column>
		{#if column.key === 'label'}
			<div class="flex flex-col gap-0.5">
				<span class="text-sm font-medium text-neutral-700 dark:text-neutral-200">
					{row.label}
				</span>
				{#if row.detail}
					<span class="text-xs text-neutral-500 dark:text-neutral-400">
						{row.detail}
					</span>
				{/if}
			</div>
		{:else if column.key === 'expected'}
			{#if row.expected}
				{#if row.expected.qualityList}
					<QualityListDiff items={row.expected.qualityList} />
				{:else}
					<Label
						variant={valueVariant(row.expected)}
						size="md"
						rounded="md"
						mono={row.expected.mono}
					>
						{row.expected.text}
					</Label>
				{/if}
			{:else}
				<span class="text-xs text-neutral-400 dark:text-neutral-500">None</span>
			{/if}
		{:else if column.key === 'actual'}
			{#if row.actual}
				{#if row.actual.qualityList}
					<QualityListDiff items={row.actual.qualityList} />
				{:else}
					<Label variant={valueVariant(row.actual)} size="md" rounded="md" mono={row.actual.mono}>
						{row.actual.text}
					</Label>
				{/if}
			{:else}
				<span class="text-xs text-neutral-400 dark:text-neutral-500">None</span>
			{/if}
		{/if}
	</svelte:fragment>
</Table>
