<script lang="ts">
	import { Play } from 'lucide-svelte';
	import { cutscene } from '$lib/client/cutscene/store';
	import { STAGES, GROUPS } from '$lib/client/cutscene/definitions/index.ts';
	import ActionsBar from '$ui/actions/ActionsBar.svelte';
	import SearchAction from '$ui/actions/SearchAction.svelte';
	import ViewToggle from '$ui/actions/ViewToggle.svelte';
	import Table from '$ui/table/Table.svelte';
	import Button from '$ui/button/Button.svelte';
	import Label from '$ui/label/Label.svelte';
	import Card from '$ui/card/Card.svelte';
	import CardGrid from '$ui/card/CardGrid.svelte';
	import type { Column } from '$ui/table/types';
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

	const { search, view, filtered } = createDataPageStore(allStages, {
		storageKey: 'onboardingView',
		searchKeys: ['name', 'description']
	});

	// Group filtered stages by their group
	$: filteredIds = new Set($filtered.map((s) => s.id));
	$: filteredGroups = GROUPS.map((group) => ({
		...group,
		stages: group.stages.filter((id) => filteredIds.has(id))
	})).filter((group) => group.stages.length > 0);

	const columns: Column<StageItem>[] = [
		{ key: 'name', header: 'Name' },
		{ key: 'description', header: 'Description', hideOnMobile: true },
		{ key: 'steps', header: 'Steps', width: 'w-16' }
	];

	function getStageRows(stageIds: string[]): StageItem[] {
		return stageIds
			.map((id) => {
				const stage = STAGES[id];
				if (!stage) return null;
				return { id, name: stage.name, description: stage.description, steps: stage.steps.length };
			})
			.filter(Boolean) as StageItem[];
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
		<ViewToggle bind:value={$view} />
	</ActionsBar>

	<!-- Groups -->
	{#each filteredGroups as group}
		<div>
			<div class="mb-3 border-l-2 border-accent-500 py-1 pl-3">
				<h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
					{group.name}
				</h2>
				<p class="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
					{group.description}
				</p>
			</div>
			{#if $view === 'table'}
				<Table {columns} data={getStageRows(group.stages)} hoverable={false}>
					<svelte:fragment slot="actions" let:row>
						<Button
							text="Start"
							icon={Play}
							iconColor="text-accent-600 dark:text-accent-400"
							size="xs"
							on:click={() => handleStart(row.id)}
						/>
					</svelte:fragment>
				</Table>
			{:else}
				<CardGrid flush>
					{#each group.stages as stageId}
						{@const stage = STAGES[stageId]}
						{#if stage}
							<Card>
								<div class="flex items-center gap-4">
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
							</Card>
						{/if}
					{/each}
				</CardGrid>
			{/if}
		</div>
	{/each}
</div>
