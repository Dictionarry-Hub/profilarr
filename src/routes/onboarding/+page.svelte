<script lang="ts">
	import { goto } from '$app/navigation';
	import { Play } from 'lucide-svelte';
	import { cutscene } from '$lib/client/cutscene/store';
	import { STAGES, PIPELINES } from '$lib/client/cutscene/definitions/index.ts';
	import ActionsBar from '$ui/actions/ActionsBar.svelte';
	import SearchAction from '$ui/actions/SearchAction.svelte';
	import ViewToggle from '$ui/actions/ViewToggle.svelte';
	import Card from '$ui/card/Card.svelte';
	import CardGrid from '$ui/card/CardGrid.svelte';
	import Button from '$ui/button/Button.svelte';
	import Label from '$ui/label/Label.svelte';
	import { createDataPageStore } from '$lib/client/stores/dataPage';

	function handleStartPipeline(id: string): void {
		cutscene.startPipeline(id);
	}

	function handleStartStage(id: string): void {
		cutscene.startStage(id);
	}

	const pipelines = Object.values(PIPELINES).map((p) => ({
		type: 'pipeline' as const,
		id: p.id,
		name: p.name,
		description: p.description,
		count: p.stages.length,
		countLabel: p.stages.length === 1 ? 'stage' : 'stages'
	}));

	const stages = Object.values(STAGES).map((s) => ({
		type: 'stage' as const,
		id: s.id,
		name: s.name,
		description: s.description,
		count: s.steps.length,
		countLabel: s.steps.length === 1 ? 'step' : 'steps'
	}));

	const allItems = [...pipelines, ...stages];

	const { search, view, filtered } = createDataPageStore(allItems, {
		storageKey: 'onboardingView',
		searchKeys: ['name', 'description'],
		searchKey: 'onboardingSearch'
	});

	$: pipelineResults = $filtered.filter((i) => i.type === 'pipeline');
	$: stageResults = $filtered.filter((i) => i.type === 'stage');
</script>

<svelte:head>
	<title>Onboarding - Profilarr</title>
</svelte:head>

<div class="space-y-6 px-4 pt-8 pb-8 md:px-8 md:pt-12">
	<!-- Header -->
	<div>
		<h1 class="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Onboarding</h1>
		<p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
			Guided walkthroughs to help you get the most out of Profilarr. Run a full pipeline or replay
			individual stages.
		</p>
	</div>

	<!-- Actions Bar -->
	<ActionsBar>
		<SearchAction searchStore={search} placeholder="Search..." responsive />
		<ViewToggle bind:value={$view} />
	</ActionsBar>

	<!-- Pipelines -->
	{#if pipelineResults.length > 0}
		<div>
			<h2
				class="mb-3 text-xs font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400"
			>
				Pipelines
			</h2>
			{#if $view === 'table'}
				<div
					class="overflow-hidden rounded-xl border border-neutral-300 dark:border-neutral-700/60"
				>
					<table class="w-full text-left text-sm">
						<thead
							class="border-b border-neutral-200 bg-neutral-100 text-xs text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400"
						>
							<tr>
								<th class="px-4 py-2 font-medium">Name</th>
								<th class="px-4 py-2 font-medium">Description</th>
								<th class="px-4 py-2 font-medium">Stages</th>
								<th class="px-4 py-2"></th>
							</tr>
						</thead>
						<tbody class="divide-y divide-neutral-200 dark:divide-neutral-700/60">
							{#each pipelineResults as item}
								<tr class="bg-white dark:bg-neutral-900">
									<td class="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-100">
										{item.name}
									</td>
									<td class="px-4 py-3 text-neutral-500 dark:text-neutral-400">
										{item.description}
									</td>
									<td class="px-4 py-3 text-neutral-500 dark:text-neutral-400">
										{item.count}
									</td>
									<td class="px-4 py-3 text-right">
										<Button
											text="Start"
											icon={Play}
											iconColor="text-accent-600 dark:text-accent-400"
											size="xs"
											on:click={() => handleStartPipeline(item.id)}
										/>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<CardGrid flush>
					{#each pipelineResults as item}
						<Card>
							<div class="flex items-center gap-4">
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2">
										<h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
											{item.name}
										</h3>
										<Label variant="secondary" size="sm" rounded="md">
											{item.count}
											{item.countLabel}
										</Label>
									</div>
									<p class="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
										{item.description}
									</p>
								</div>
								<Button
									text="Start"
									icon={Play}
									iconColor="text-accent-600 dark:text-accent-400"
									size="sm"
									on:click={() => handleStartPipeline(item.id)}
								/>
							</div>
						</Card>
					{/each}
				</CardGrid>
			{/if}
		</div>
	{/if}

	<!-- Individual Stages -->
	{#if stageResults.length > 0}
		<div>
			<h2
				class="mb-3 text-xs font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400"
			>
				Stages
			</h2>
			{#if $view === 'table'}
				<div
					class="overflow-hidden rounded-xl border border-neutral-300 dark:border-neutral-700/60"
				>
					<table class="w-full text-left text-sm">
						<thead
							class="border-b border-neutral-200 bg-neutral-100 text-xs text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400"
						>
							<tr>
								<th class="px-4 py-2 font-medium">Name</th>
								<th class="px-4 py-2 font-medium">Description</th>
								<th class="px-4 py-2 font-medium">Steps</th>
								<th class="px-4 py-2"></th>
							</tr>
						</thead>
						<tbody class="divide-y divide-neutral-200 dark:divide-neutral-700/60">
							{#each stageResults as item}
								<tr class="bg-white dark:bg-neutral-900">
									<td class="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-100">
										{item.name}
									</td>
									<td class="px-4 py-3 text-neutral-500 dark:text-neutral-400">
										{item.description}
									</td>
									<td class="px-4 py-3 text-neutral-500 dark:text-neutral-400">
										{item.count}
									</td>
									<td class="px-4 py-3 text-right">
										<Button
											text="Start"
											icon={Play}
											iconColor="text-accent-600 dark:text-accent-400"
											size="xs"
											on:click={() => handleStartStage(item.id)}
										/>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<CardGrid flush>
					{#each stageResults as item}
						<Card>
							<div class="flex items-center gap-4">
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2">
										<h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
											{item.name}
										</h3>
										<Label variant="secondary" size="sm" rounded="md">
											{item.count}
											{item.countLabel}
										</Label>
									</div>
									<p class="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
										{item.description}
									</p>
								</div>
								<Button
									text="Start"
									icon={Play}
									iconColor="text-accent-600 dark:text-accent-400"
									size="sm"
									on:click={() => handleStartStage(item.id)}
								/>
							</div>
						</Card>
					{/each}
				</CardGrid>
			{/if}
		</div>
	{/if}
</div>
