<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Table from '$ui/table/Table.svelte';
	import type { Column } from '$ui/table/types';
	import NumberInput from '$ui/form/NumberInput.svelte';
	import IconCheckbox from '$ui/form/IconCheckbox.svelte';
	import { Check } from 'lucide-svelte';

	export let formats: any[];
	export let arrTypes: string[];
	export let customFormatScores: Record<string, Record<string, number | null>>;
	export let customFormatEnabled: Record<string, Record<string, boolean>>;
	type IconCheckboxColor =
		| 'accent'
		| 'blue'
		| 'green'
		| 'red'
		| 'neutral'
		| `#${string}`
		| `var(--${string})`;
	export let getArrTypeColor: (arrType: string) => IconCheckboxColor;

	const dispatch = createEventDispatcher<{
		scoreChange: { formatName: string; arrType: string; score: number | null };
		enabledChange: { formatName: string; arrType: string; enabled: boolean };
	}>();

	function isRowDisabled(format: any): boolean {
		return arrTypes.every((arrType) => !customFormatEnabled[format.name]?.[arrType]);
	}

	$: columns = [
		{
			key: 'name',
			header: 'Custom Format',
			tdClass: (row: any) => {
				const disabled = isRowDisabled(row);
				return `sticky left-0 z-[1] font-medium ${disabled ? 'bg-neutral-100 dark:bg-neutral-800' : 'bg-white dark:bg-neutral-900'}`;
			}
		},
		...arrTypes.map((arrType) => ({
			key: arrType,
			header: arrType.charAt(0).toUpperCase() + arrType.slice(1),
			align: 'center' as const,
			width: 'w-64'
		}))
	] as Column<any>[];

	function rowClass(row: any): string {
		const disabled = isRowDisabled(row);
		return disabled
			? 'bg-neutral-100 opacity-60 dark:bg-neutral-800'
			: 'transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900';
	}

	function handleScoreChange(formatName: string, arrType: string, score: number | null) {
		dispatch('scoreChange', { formatName, arrType, score });
	}

	function handleToggleEnabled(formatName: string, arrType: string) {
		const isEnabled = customFormatEnabled[formatName]?.[arrType] ?? false;
		if (isEnabled) {
			dispatch('scoreChange', { formatName, arrType, score: null });
		} else {
			if (customFormatScores[formatName]?.[arrType] === null) {
				dispatch('scoreChange', { formatName, arrType, score: 0 });
			}
		}
		dispatch('enabledChange', { formatName, arrType, enabled: !isEnabled });
	}
</script>

<Table
	{columns}
	data={formats}
	emptyMessage="No custom formats found"
	pageSize={50}
	hoverable={false}
	{rowClass}
>
	<svelte:fragment slot="cell" let:row let:column>
		{#if column.key === 'name'}
			{@const disabled = isRowDisabled(row)}
			<span class={disabled ? 'text-neutral-500 dark:text-neutral-500' : ''}>{row.name}</span>
		{:else}
			{@const arrType = column.key}
			<div class="flex items-center justify-center gap-2">
				<IconCheckbox
					checked={customFormatEnabled[row.name]?.[arrType] ?? false}
					icon={Check}
					color={getArrTypeColor(arrType)}
					shape="circle"
					on:click={() => handleToggleEnabled(row.name, arrType)}
				/>
				{#if customFormatScores[row.name]}
					<div class="w-48">
						<NumberInput
							name="score-{row.name}-{arrType}"
							value={customFormatScores[row.name][arrType] ?? 0}
							onchange={(newValue) => handleScoreChange(row.name, arrType, newValue)}
							step={1}
							disabled={!customFormatEnabled[row.name]?.[arrType]}
							font="mono"
						/>
					</div>
				{/if}
			</div>
		{/if}
	</svelte:fragment>
</Table>
