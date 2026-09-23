<script lang="ts">
	import { resolve } from '$app/paths';
	import { createEventDispatcher } from 'svelte';
	import Table from '$ui/table/Table.svelte';
	import type { Column } from '$ui/table/types';
	import NumberInput from '$ui/form/NumberInput.svelte';
	import IconCheckbox from '$ui/form/IconCheckbox.svelte';
	import { Check } from '@lucide/svelte';
	import InlineLink from '$ui/link/InlineLink.svelte';

	export let databaseId: number;
	export let formats: any[];
	export let arrTypes: string[];
	export let customFormatScores: Record<string, Record<string, number | null>>;
	export let customFormatEnabled: Record<string, Record<string, boolean>>;
	export let disabled: boolean = false;
	type IconCheckboxColor =
		'accent' | 'blue' | 'green' | 'red' | 'neutral' | `#${string}` | `var(--${string})`;
	export let getArrTypeColor: (arrType: string) => IconCheckboxColor;
	export let firstRowOnboarding: string | undefined = undefined;

	const dispatch = createEventDispatcher<{
		scoreChange: { formatName: string; arrType: string; score: number | null };
		enabledChange: { formatName: string; arrType: string; enabled: boolean };
	}>();

	$: columns = ((activeArrTypes) =>
		[
			{
				key: 'name',
				header: 'Custom Format',
				tdClass: 'sticky left-0 z-[1] bg-white font-medium dark:bg-neutral-900'
			},
			...activeArrTypes.map((arrType) => ({
				key: arrType,
				header: arrType.charAt(0).toUpperCase() + arrType.slice(1),
				align: 'center' as const,
				width: 'w-64'
			}))
		] as Column<any>[])(arrTypes);

	const rowClass = () => 'transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900';

	function rowAttributes(_: any, i: number): Record<string, string> {
		return i === 0 && firstRowOnboarding ? { 'data-onboarding': firstRowOnboarding } : {};
	}

	function handleScoreChange(formatName: string, arrType: string, score: number | null) {
		if (disabled) return;
		dispatch('scoreChange', { formatName, arrType, score });
	}

	function handleToggleEnabled(formatName: string, arrType: string) {
		if (disabled) return;
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
	{rowAttributes}
>
	<svelte:fragment slot="cell" let:row let:column>
		{#if column.key === 'name'}
			<InlineLink
				href={resolve(`/custom-formats/${databaseId}/${row.id}/general`)}
				text={row.name}
				external
			/>
		{:else}
			{@const arrType = column.key}
			<div class="flex items-center justify-center gap-2">
				<IconCheckbox
					checked={customFormatEnabled[row.name]?.[arrType] ?? false}
					icon={Check}
					color={getArrTypeColor(arrType)}
					shape="circle"
					{disabled}
					on:click={() => handleToggleEnabled(row.name, arrType)}
				/>
				{#if customFormatScores[row.name]}
					<div class="w-48">
						<NumberInput
							name="score-{row.name}-{arrType}"
							value={customFormatScores[row.name][arrType] ?? 0}
							onchange={(newValue) => handleScoreChange(row.name, arrType, newValue)}
							step={1}
							disabled={disabled || !customFormatEnabled[row.name]?.[arrType]}
							font="mono"
						/>
					</div>
				{/if}
			</div>
		{/if}
	</svelte:fragment>
</Table>
