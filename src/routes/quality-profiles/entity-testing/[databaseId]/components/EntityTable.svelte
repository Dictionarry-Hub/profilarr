<script lang="ts">
	import { enhance } from '$app/forms';
	import { Film, Tv, Trash2, Import, Plus } from 'lucide-svelte';
	import { createEventDispatcher } from 'svelte';
	import ExpandableTable from '$ui/table/ExpandableTable.svelte';
	import Button from '$ui/button/Button.svelte';
	import Label from '$ui/label/Label.svelte';
	import ReleaseTable from './ReleaseTable.svelte';
	import { alertStore } from '$lib/client/alerts/store';
	import type { Column } from '$ui/table/types';
	import type { TestEntity, TestRelease } from '$shared/pcd/display.ts';
	import type { components } from '$api/v1.d.ts';

	type ReleaseEvaluation = components['schemas']['ReleaseEvaluation'];

	interface CfScore {
		radarr: number | null;
		sonarr: number | null;
	}

	interface ProfileCfScores {
		profileName: string;
		scores: Record<string, CfScore>;
	}

	interface CustomFormatInfo {
		name: string;
	}

	export let entities: TestEntity[];
	export let evaluations: Record<number, ReleaseEvaluation>;
	export let loadingEntityIds: Set<number> = new Set();
	export let selectedProfileId: number | null;
	export let qualityProfiles: Array<{ id: number; name: string }>;
	export let cfScoresData: { customFormats: CustomFormatInfo[]; profiles: ProfileCfScores[] };
	export let calculateScore: (releaseId: number, entityType: 'movie' | 'series') => number | null;
	export let deleteLayer: 'user' | 'base' = 'user';
	export let deleteReleaseLayer: 'user' | 'base' = 'user';
	export let expandedRows: Set<number> = new Set();

	const dispatch = createEventDispatcher<{
		confirmDelete: { entity: TestEntity; formRef: HTMLFormElement };
		addRelease: { entityType: 'movie' | 'series'; entityTmdbId: number };
		importReleases: { entity: TestEntity };
		editRelease: { entityType: 'movie' | 'series'; entityTmdbId: number; release: TestRelease };
		confirmDeleteRelease: { release: TestRelease; formRef: HTMLFormElement };
		expand: { entity: TestEntity };
	}>();

	// Track previous expanded rows to detect new expansions
	let prevExpandedRows = new Set<number>();
	$: {
		// Find newly expanded rows
		for (const id of expandedRows) {
			if (!prevExpandedRows.has(id)) {
				const entity = entities.find((e) => e.id === id);
				if (entity) {
					dispatch('expand', { entity });
				}
			}
		}
		prevExpandedRows = new Set(expandedRows);
	}

	const columns: Column<TestEntity>[] = [
		{
			key: 'poster_path',
			header: '',
			width: 'w-12'
		},
		{
			key: 'title',
			header: 'Title',
			sortable: true
		},
		{
			key: 'type',
			header: 'Type',
			width: 'w-24',
			sortable: true
		},
		{
			key: 'releases',
			header: 'Releases',
			width: 'w-28',
			align: 'center',
			sortable: true,
			sortAccessor: (row) => row.releases.length
		}
	];

	function getRowId(row: TestEntity): number {
		return row.id;
	}
</script>

<ExpandableTable
	{columns}
	data={entities}
	{getRowId}
	compact={true}
	flushExpanded={true}
	emptyMessage="No entities match your search"
	chevronPosition="right"
	responsive={true}
	bind:expandedRows
>
	<svelte:fragment slot="cell" let:row let:column>
		{#if column.key === 'poster_path'}
			{#if row.poster_path}
				<div class="h-12 w-8">
					<img
						src="https://image.tmdb.org/t/p/w92{row.poster_path}"
						alt={row.title}
						class="h-full w-full rounded object-cover"
					/>
				</div>
			{:else}
				<div
					class="flex h-12 w-8 items-center justify-center rounded bg-neutral-200 dark:bg-neutral-700"
				>
					{#if row.type === 'movie'}
						<Film size={16} class="text-neutral-400" />
					{:else}
						<Tv size={16} class="text-neutral-400" />
					{/if}
				</div>
			{/if}
		{:else if column.key === 'title'}
			<div class="flex flex-col">
				<span class="font-medium">{row.title}</span>
				{#if row.year}
					<span class="text-xs text-neutral-500 dark:text-neutral-400">{row.year}</span>
				{/if}
			</div>
		{:else if column.key === 'type'}
			<Label variant="secondary" size="sm" rounded="xl">
				{#if row.type === 'movie'}
					<Film size={12} class="text-amber-500" />
					Movie
				{:else}
					<Tv size={12} class="text-cyan-500" />
					Series
				{/if}
			</Label>
		{:else if column.key === 'releases'}
			<span class="text-neutral-600 dark:text-neutral-400">
				{row.releases.length}
			</span>
		{/if}
	</svelte:fragment>

	<svelte:fragment slot="actions" let:row>
		{@const formId = `delete-form-${row.id}`}
		<div class="flex items-center gap-1">
			<Button
				icon={Plus}
				tooltip="Add release"
				variant="secondary"
				size="xs"
				on:click={() => dispatch('addRelease', { entityType: row.type, entityTmdbId: row.tmdb_id })}
			/>
			<Button
				icon={Import}
				tooltip="Import releases from Arr"
				variant="secondary"
				size="xs"
				on:click={() => dispatch('importReleases', { entity: row })}
			/>
			<form
				id={formId}
				method="POST"
				action="?/deleteEntity"
				use:enhance={() => {
					return async ({ result, update }) => {
						if (result.type === 'failure' && result.data) {
							alertStore.add(
								'error',
								(result.data as { error?: string }).error || 'Failed to delete entity'
							);
						} else if (result.type === 'success') {
							alertStore.add('success', `Deleted ${row.title}`);
						}
						await update();
					};
				}}
			>
				<input type="hidden" name="entityType" value={row.type} />
				<input type="hidden" name="entityTmdbId" value={row.tmdb_id} />
				<input type="hidden" name="entityTitle" value={row.title} />
				<input type="hidden" name="layer" value={deleteLayer} />
				<Button
					icon={Trash2}
					tooltip="Delete entity"
					variant="secondary"
					size="xs"
					iconColor="group-hover:text-red-500 dark:group-hover:text-red-400"
					on:click={() => {
						const form = document.getElementById(formId) as HTMLFormElement;
						dispatch('confirmDelete', { entity: row, formRef: form });
					}}
				/>
			</form>
		</div>
	</svelte:fragment>

	<svelte:fragment slot="expanded" let:row>
		<div class="px-4 py-3">
			{#if loadingEntityIds.has(row.id)}
				<div class="flex items-center justify-center py-8 text-neutral-500 dark:text-neutral-400">
					<svg
						class="mr-2 h-5 w-5 animate-spin"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
					>
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
					Evaluating releases...
				</div>
			{:else}
				<ReleaseTable
					entityType={row.type}
					entityTmdbId={row.tmdb_id}
					releases={row.releases}
					{evaluations}
					{selectedProfileId}
					{qualityProfiles}
					{cfScoresData}
					{calculateScore}
					deleteLayer={deleteReleaseLayer}
					on:edit={(e) => dispatch('editRelease', e.detail)}
					on:confirmDelete={(e) => dispatch('confirmDeleteRelease', e.detail)}
				/>
			{/if}
		</div>
	</svelte:fragment>
</ExpandableTable>
