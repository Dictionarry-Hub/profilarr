<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import NumberInput from '$ui/form/NumberInput.svelte';
	import IconCheckbox from '$ui/form/IconCheckbox.svelte';
	import { Check } from 'lucide-svelte';
	import { createProgressiveList } from '$lib/client/utils/progressiveList';

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

	const { visibleCount, sentinel, reset, setTotalCount } = createProgressiveList({ pageSize: 50 });

	$: setTotalCount(formats.length);
	$: (formats, reset());
	$: displayFormats = formats.slice(0, $visibleCount);

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

<div class="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
	<table class="w-full">
		<thead
			class="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-800"
		>
			<tr>
				<th
					class="sticky left-0 z-[1] bg-neutral-50 px-6 py-3 text-left text-xs font-medium tracking-wider text-neutral-700 uppercase dark:bg-neutral-800 dark:text-neutral-300"
				>
					Custom Format
				</th>
				{#each arrTypes as arrType}
					<th
						class="w-64 px-6 py-3 text-center text-xs font-medium tracking-wider text-neutral-700 uppercase dark:text-neutral-300"
					>
						{arrType}
					</th>
				{/each}
			</tr>
		</thead>

		<tbody class="divide-y divide-neutral-200 bg-white dark:divide-neutral-800 dark:bg-neutral-900">
			{#if formats.length === 0}
				<tr>
					<td
						colspan={arrTypes.length + 1}
						class="px-6 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400"
					>
						No custom formats found
					</td>
				</tr>
			{:else}
				{#each displayFormats as format (format.name)}
					{@const rowDisabled = arrTypes.every(
						(arrType) => !customFormatEnabled[format.name]?.[arrType]
					)}
					<tr
						class="transition-colors {rowDisabled
							? 'bg-neutral-100 opacity-60 dark:bg-neutral-800'
							: 'hover:bg-neutral-50 dark:hover:bg-neutral-900'}"
					>
						<td
							class="sticky left-0 z-[1] px-6 py-4 text-sm font-medium {rowDisabled
								? 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-500'
								: 'bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100'}"
						>
							{format.name}
						</td>
						{#each arrTypes as arrType}
							<td class="px-6 py-4">
								<div class="flex items-center justify-center gap-2">
									<IconCheckbox
										checked={customFormatEnabled[format.name]?.[arrType] ?? false}
										icon={Check}
										color={getArrTypeColor(arrType)}
										shape="circle"
										on:click={() => handleToggleEnabled(format.name, arrType)}
									/>
									{#if customFormatScores[format.name]}
										<div class="w-48">
											<NumberInput
												name="score-{format.name}-{arrType}"
												value={customFormatScores[format.name][arrType] ?? 0}
												onchange={(newValue) => handleScoreChange(format.name, arrType, newValue)}
												step={1}
												disabled={!customFormatEnabled[format.name]?.[arrType]}
												font="mono"
											/>
										</div>
									{/if}
								</div>
							</td>
						{/each}
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>
<div use:sentinel class="h-1"></div>
