<script lang="ts">
	import { Play } from 'lucide-svelte';
	import { cutscene } from '$lib/client/cutscene/store';
	import { STAGES, GROUPS } from '$lib/client/cutscene/definitions/index.ts';
	import ActionsBar from '$ui/actions/ActionsBar.svelte';
	import SearchAction from '$ui/actions/SearchAction.svelte';
	import ExpandableCard from '$ui/card/ExpandableCard.svelte';
	import Button from '$ui/button/Button.svelte';
	import Label from '$ui/label/Label.svelte';
	import { createDataPageStore } from '$lib/client/stores/dataPage';
	import { alertStore } from '$alerts/store';

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

	async function handleStart(id: string): Promise<void> {
		if (window.innerWidth < 768) {
			alertStore.add(
				'warning',
				'Onboarding walkthroughs are only available on desktop. Move to a larger screen to continue.'
			);
			return;
		}
		await cutscene.startStage(id);
	}
</script>

<svelte:head>
	<title>Onboarding - Profilarr</title>
</svelte:head>

<div class="p-4 md:p-8">
	<!-- Header -->
	<div class="mb-8">
		<h1 class="text-2xl font-bold text-neutral-900 md:text-3xl dark:text-neutral-50">Onboarding</h1>
		<p class="mt-2 text-base text-neutral-600 md:mt-3 md:text-lg dark:text-neutral-400">
			Guided walkthroughs to help you get the most out of Profilarr. Run any stage at your own pace.
		</p>
	</div>

	<div class="space-y-6">
		<!-- Actions Bar -->
		<ActionsBar>
			<SearchAction searchStore={search} placeholder="Search stages..." responsive />
		</ActionsBar>

		<!-- Groups -->
		{#each filteredGroups as group}
			<ExpandableCard title={group.name} description={group.description}>
				<div class="divide-y divide-neutral-200 dark:divide-neutral-700/60">
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
			</ExpandableCard>
		{/each}
	</div>
</div>
