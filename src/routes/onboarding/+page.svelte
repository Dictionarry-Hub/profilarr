<script lang="ts">
	import { Play, ChevronDown } from 'lucide-svelte';
	import { cutscene } from '$lib/client/cutscene/store';
	import { STAGES, GROUPS } from '$lib/client/cutscene/definitions/index.ts';
	import ActionsBar from '$ui/actions/ActionsBar.svelte';
	import SearchAction from '$ui/actions/SearchAction.svelte';
	import Button from '$ui/button/Button.svelte';
	import Label from '$ui/label/Label.svelte';
	import { createDataPageStore } from '$lib/client/stores/dataPage';

	interface StageItem {
		id: string;
		name: string;
		description: string;
		steps: number;
	}

	// Build flat list of all stages
	const allStages: StageItem[] = Object.entries(STAGES).map(([id, stage]) => ({
		id,
		name: stage.name,
		description: stage.description,
		steps: stage.steps.length
	}));

	const { search, filtered } = createDataPageStore(allStages, {
		storageKey: 'onboardingView',
		searchKeys: ['name', 'description']
	});

	// Group filtered stages by their group
	$: filteredIds = new Set($filtered.map((s) => s.id));
	$: filteredGroups = GROUPS.map((group) => ({
		...group,
		stages: group.stages.filter((id) => filteredIds.has(id))
	})).filter((group) => group.stages.length > 0);

	let collapsed: Set<string> = new Set();

	function toggleGroup(name: string): void {
		if (collapsed.has(name)) {
			collapsed.delete(name);
		} else {
			collapsed.add(name);
		}
		collapsed = collapsed;
	}

	async function handleStart(id: string): Promise<void> {
		await cutscene.startStage(id);
	}
</script>

<svelte:head>
	<title>Onboarding - Profilarr</title>
</svelte:head>

<div class="space-y-6 px-4 pt-8 pb-8 md:px-8 md:pt-12">
	<!-- Header -->
	<div>
		<h1 class="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Onboarding</h1>
		<p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
			Guided walkthroughs to help you get the most out of Profilarr. Run any stage at your own pace.
		</p>
	</div>

	<!-- Actions Bar -->
	<ActionsBar>
		<SearchAction searchStore={search} placeholder="Search stages..." responsive />
	</ActionsBar>

	<!-- Groups -->
	{#each filteredGroups as group}
		<div
			class="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
		>
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div
				class="flex cursor-pointer items-center justify-between bg-neutral-50 px-6 py-4 dark:bg-neutral-800/50"
				on:click={() => toggleGroup(group.name)}
			>
				<div>
					<h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
						{group.name}
					</h2>
					<p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
						{group.description}
					</p>
				</div>
				<ChevronDown
					size={18}
					class="text-neutral-400 transition-transform duration-200 {collapsed.has(group.name)
						? '-rotate-90'
						: ''}"
				/>
			</div>
			{#if !collapsed.has(group.name)}
				<div
					class="divide-y divide-neutral-200 border-t border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800"
				>
					{#each group.stages as stageId}
						{@const stage = STAGES[stageId]}
						{#if stage}
							<div class="flex items-center gap-4 px-6 py-4">
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2">
										<h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
											{stage.name}
										</h3>
										<Label variant="secondary" size="sm" rounded="md">
											{stage.steps.length}
											{stage.steps.length === 1 ? 'step' : 'steps'}
										</Label>
									</div>
									<p class="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
										{stage.description}
									</p>
								</div>
								<Button
									text="Start"
									icon={Play}
									iconColor="text-accent-600 dark:text-accent-400"
									size="sm"
									on:click={() => handleStart(stageId)}
								/>
							</div>
						{/if}
					{/each}
				</div>
			{/if}
		</div>
	{/each}
</div>
