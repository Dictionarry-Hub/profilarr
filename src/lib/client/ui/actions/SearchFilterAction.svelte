<script lang="ts">
	import { Binoculars, Check } from 'lucide-svelte';
	import { fly } from 'svelte/transition';
	import { createEventDispatcher } from 'svelte';

	export let options: { key: string; label: string; enabled: boolean }[] = [];

	const dispatch = createEventDispatcher<{ change: { key: string; enabled: boolean }[] }>();

	let isHovered = false;
	let leaveTimer: ReturnType<typeof setTimeout> | null = null;

	function handleMouseEnter() {
		if (leaveTimer) {
			clearTimeout(leaveTimer);
			leaveTimer = null;
		}
		isHovered = true;
	}

	function handleMouseLeave() {
		leaveTimer = setTimeout(() => {
			isHovered = false;
		}, 100);
	}

	function toggleOption(key: string) {
		options = options.map((opt) => (opt.key === key ? { ...opt, enabled: !opt.enabled } : opt));
		dispatch('change', options);
	}

	$: enabledCount = options.filter((o) => o.enabled).length;
</script>

<div
	class="relative flex"
	on:mouseenter={handleMouseEnter}
	on:mouseleave={handleMouseLeave}
	role="group"
>
	<button
		class="flex h-10 w-10 items-center justify-center border border-neutral-200 bg-white transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700"
	>
		<div class="relative">
			<Binoculars size={20} class="text-neutral-700 dark:text-neutral-300" />
			{#if enabledCount < options.length}
				<div
					class="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent-600 text-[9px] font-bold text-white"
				>
					{enabledCount}
				</div>
			{/if}
		</div>
	</button>

	{#if isHovered}
		<div class="z-50" transition:fly={{ y: -8, duration: 150 }}>
			<div class="absolute top-full z-40 h-3 w-full"></div>
			<div
				class="absolute top-full right-0 z-50 mt-3 min-w-48 rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
			>
				<div class="px-3 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
					Search in...
				</div>
				{#each options as option}
					<button
						class="flex w-full items-center gap-3 border-t border-neutral-200 px-3 py-2 text-left text-sm transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-700"
						on:click={() => toggleOption(option.key)}
					>
						<div
							class="flex h-4 w-4 items-center justify-center rounded border {option.enabled
								? 'border-accent-600 bg-accent-600 dark:border-accent-500 dark:bg-accent-500'
								: 'border-neutral-300 dark:border-neutral-600'}"
						>
							{#if option.enabled}
								<Check size={12} class="text-white" />
							{/if}
						</div>
						<span class="text-neutral-700 dark:text-neutral-300">{option.label}</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>
