<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import NumberInput from '$ui/form/NumberInput.svelte';
	import IconCheckbox from '$ui/form/IconCheckbox.svelte';
	import { Check } from 'lucide-svelte';
	import { createVirtualList } from '$lib/client/utils/virtualList';
	import InlineLink from '$ui/link/InlineLink.svelte';

	export let databaseId: number;
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

	const { state, action, setItemCount } = createVirtualList({
		itemHeight: 110,
		buffer: 2
	});

	$: setItemCount(formats.length);
	$: ({ start, end, topHeight, bottomHeight } = $state);
	$: visibleFormats = formats.slice(start, end);

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

<div use:action class="space-y-2">
	{#if formats.length === 0}
		<div
			class="rounded-lg border border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400"
		>
			No custom formats found
		</div>
	{:else}
		{#if topHeight > 0}
			<div style="height: {topHeight}px;"></div>
		{/if}
		{#each visibleFormats as format (format.name)}
			{@const rowDisabled = arrTypes.every(
				(arrType) => !customFormatEnabled[format.name]?.[arrType]
			)}
			<div
				class="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 {rowDisabled
					? 'opacity-60'
					: ''}"
			>
				<!-- Format name -->
				<div
					class="border-b border-neutral-200 px-4 py-2.5 text-sm font-medium dark:border-neutral-800 {rowDisabled
						? 'text-neutral-500 dark:text-neutral-500'
						: 'text-neutral-900 dark:text-neutral-100'}"
				>
					<InlineLink
						href="/custom-formats/{databaseId}/{format.id}/general"
						text={format.name}
						external
					/>
				</div>

				<!-- Arr type scores -->
				<div class="divide-y divide-neutral-100 px-4 dark:divide-neutral-800">
					{#each arrTypes as arrType}
						<div class="flex items-center justify-between gap-3 py-2.5">
							<div class="flex items-center gap-2">
								<IconCheckbox
									checked={customFormatEnabled[format.name]?.[arrType] ?? false}
									icon={Check}
									color={getArrTypeColor(arrType)}
									shape="circle"
									on:click={() => handleToggleEnabled(format.name, arrType)}
								/>
								<span class="text-xs font-medium text-neutral-600 capitalize dark:text-neutral-400">
									{arrType}
								</span>
							</div>
							{#if customFormatScores[format.name]}
								<div class="w-28">
									<NumberInput
										name="score-{format.name}-{arrType}"
										value={customFormatScores[format.name][arrType] ?? 0}
										onchange={(newValue) => handleScoreChange(format.name, arrType, newValue)}
										step={1}
										disabled={!customFormatEnabled[format.name]?.[arrType]}
										responsive={true}
										font="mono"
									/>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/each}
		{#if bottomHeight > 0}
			<div style="height: {bottomHeight}px;"></div>
		{/if}
	{/if}
</div>
