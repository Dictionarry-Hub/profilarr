<script lang="ts">
	import { enhance } from '$app/forms';
	import { Trash2, Pencil, HardDrive, Tag, Users, Bookmark, Earth, Layers } from 'lucide-svelte';
	import { createEventDispatcher } from 'svelte';
	import ExpandableTable from '$ui/table/ExpandableTable.svelte';
	import Button from '$ui/button/Button.svelte';
	import Label from '$ui/label/Label.svelte';
	import Score from '$ui/arr/Score.svelte';
	import CustomFormatBadge from '$ui/arr/CustomFormatBadge.svelte';
	import { alertStore } from '$lib/client/alerts/store';
	import type { Column } from '$ui/table/types';
	import type { TestRelease, ReleaseEvaluation } from '$shared/pcd/display.ts';

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

	export let entityType: 'movie' | 'series';
	export let entityTmdbId: number;
	export let releases: TestRelease[];
	export let evaluations: Record<number, ReleaseEvaluation>;
	export let selectedProfileId: number | null;
	export let qualityProfiles: Array<{ id: number; name: string }>;
	export let cfScoresData: { customFormats: CustomFormatInfo[]; profiles: ProfileCfScores[] };
	export let calculateScore: (releaseId: number, entityType: 'movie' | 'series') => number | null;
	export let deleteLayer: 'user' | 'base' = 'user';

	// Track expanded rows outside {#key} block so state persists across profile changes
	let expandedRows: Set<string | number> = new Set();

	// Get matching custom formats for a release with their scores
	function getMatchingFormats(releaseId: number): Array<{ name: string; score: number }> {
		const evaluation = evaluations[releaseId];
		if (!evaluation || !evaluation.cfMatches || !selectedProfileId) return [];

		// Convert profile ID to name for lookup
		const profile = qualityProfiles.find((p) => p.id === selectedProfileId);
		if (!profile) return [];

		const profileScores = cfScoresData.profiles.find((p) => p.profileName === profile.name);
		if (!profileScores) return [];

		const arrType = entityType === 'movie' ? 'radarr' : 'sonarr';
		const matches: Array<{ name: string; score: number }> = [];

		// cfMatches keys are now CF names
		for (const [cfName, matched] of Object.entries(evaluation.cfMatches)) {
			if (!matched) continue;

			const cfScore = profileScores.scores[cfName];

			if (cfScore) {
				const score = cfScore[arrType];
				if (score !== null && score !== 0) {
					matches.push({ name: cfName, score });
				}
			}
		}

		// Sort by absolute score (highest impact first)
		return matches.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
	}

	const dispatch = createEventDispatcher<{
		edit: { entityType: 'movie' | 'series'; entityTmdbId: number; release: TestRelease };
		confirmDelete: { release: TestRelease; formRef: HTMLFormElement };
	}>();

	// Reactive columns - recalculates when calculateScore changes (profile switch)
	$: columns = [
		{
			key: 'title',
			header: 'Release Title',
			sortable: true
		},
		{
			key: 'size_bytes',
			header: 'Size',
			width: 'w-24',
			align: 'right',
			sortable: true
		},
		{
			key: 'indexers',
			header: 'Indexers',
			width: 'w-48'
		},
		{
			key: 'languages',
			header: 'Languages',
			width: 'w-32'
		},
		{
			key: 'score',
			header: 'Score',
			width: 'w-20',
			align: 'right',
			sortable: true,
			sortAccessor: (row) => calculateScore(row.id, entityType) ?? -Infinity
		}
	] as Column<TestRelease>[];

	function getRowId(row: TestRelease): number {
		return row.id;
	}

	function formatSize(bytes: number | null): string {
		if (bytes === null) return '—';
		const gb = bytes / (1024 * 1024 * 1024);
		if (gb >= 1) return `${gb.toFixed(1)} GB`;
		const mb = bytes / (1024 * 1024);
		return `${mb.toFixed(0)} MB`;
	}
</script>

<div class="space-y-3">
	{#if releases.length > 0}
		{#key selectedProfileId}
			<ExpandableTable
				{columns}
				data={releases}
				{getRowId}
				compact={true}
				flushExpanded={true}
				emptyMessage="No releases"
				chevronPosition="right"
				responsive={true}
				defaultSort={{ key: 'score', direction: 'desc' }}
				bind:expandedRows
			>
				<svelte:fragment slot="cell" let:row={release} let:column>
					{#if column.key === 'title'}
						<span class="font-mono text-[11px]">
							{release.title}
						</span>
					{:else if column.key === 'size_bytes'}
						<span class="font-mono text-[11px] text-text-soft">
							{formatSize(release.size_bytes)}
						</span>
					{:else if column.key === 'indexers'}
						{#if release.indexers.length > 0}
							<div class="flex flex-wrap gap-1">
								{#each release.indexers as indexer}
									<Label variant="secondary" size="sm" radius="xl">{indexer}</Label>
								{/each}
							</div>
						{:else}
							<span class="text-text-subtle">—</span>
						{/if}
					{:else if column.key === 'languages'}
						{#if release.languages.length > 0}
							<div class="flex flex-wrap gap-1">
								{#each release.languages as lang}
									<Label variant="secondary" size="sm" radius="xl">{lang}</Label>
								{/each}
							</div>
						{:else}
							<span class="text-text-subtle">—</span>
						{/if}
					{:else if column.key === 'score'}
						<Score score={calculateScore(release.id, entityType)} />
					{/if}
				</svelte:fragment>

				<svelte:fragment slot="actions" let:row={release}>
					{@const releaseFormId = `delete-release-form-${release.id}`}
					<div class="flex items-center gap-1">
						<Button
							icon={Pencil}
							tooltip="Edit release"
							variant="secondary"
							size="xs"
							on:click={() => dispatch('edit', { entityType, entityTmdbId, release })}
						/>
						<form
							id={releaseFormId}
							method="POST"
							action="?/deleteRelease"
							use:enhance={() => {
								return async ({ result, update }) => {
									if (result.type === 'failure' && result.data) {
										alertStore.add(
											'error',
											(result.data as { error?: string }).error || 'Failed to delete release'
										);
									} else if (result.type === 'success') {
										alertStore.add('success', `Deleted release`);
									}
									await update();
								};
							}}
						>
							<input type="hidden" name="releaseId" value={release.id} />
							<input type="hidden" name="layer" value={deleteLayer} />
							<Button
								icon={Trash2}
								tooltip="Delete release"
								variant="secondary"
								size="xs"
								iconColor="group-hover:text-danger-icon "
								on:click={() => {
									const form = document.getElementById(releaseFormId) as HTMLFormElement;
									dispatch('confirmDelete', { release, formRef: form });
								}}
							/>
						</form>
					</div>
				</svelte:fragment>

				<svelte:fragment slot="expanded" let:row={release}>
					{@const evaluation = evaluations[release.id]}
					{@const matchingFormats = getMatchingFormats(release.id)}
					<div class="px-4 py-4">
						<div class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-xs">
							<!-- Parsed Info Row -->
							{#if evaluation?.parsed}
								<div class="pt-0.5 font-medium text-text-muted">Parsed</div>
								<div class="flex flex-wrap items-center gap-2">
									<span
										class="inline-flex items-center gap-1.5 rounded-card border border-border bg-surface px-2 py-1"
									>
										<HardDrive size={12} class="text-info-icon" />
										<span class="text-text-muted">Source</span>
										<span class="font-medium text-text">{evaluation.parsed.source}</span>
									</span>
									<span
										class="inline-flex items-center gap-1.5 rounded-card border border-border bg-surface px-2 py-1"
									>
										<Layers size={12} class="text-accent-solid" />
										<span class="text-text-muted">Resolution</span>
										<span class="font-medium text-text">{evaluation.parsed.resolution}</span>
									</span>
									{#if evaluation.parsed.modifier !== 'None'}
										<span
											class="inline-flex items-center gap-1.5 rounded-card border border-border bg-surface px-2 py-1"
										>
											<Tag size={12} class="text-warning-icon" />
											<span class="text-text-muted">Modifier</span>
											<span class="font-medium text-text">{evaluation.parsed.modifier}</span>
										</span>
									{/if}
									{#if evaluation.parsed.releaseGroup}
										<span
											class="inline-flex items-center gap-1.5 rounded-card border border-border bg-surface px-2 py-1"
										>
											<Users size={12} class="text-info-icon" />
											<span class="text-text-muted">Group</span>
											<span class="font-medium text-text">{evaluation.parsed.releaseGroup}</span>
										</span>
									{/if}
									{#if evaluation.parsed.edition}
										<span
											class="inline-flex items-center gap-1.5 rounded-card border border-border bg-surface px-2 py-1"
										>
											<Bookmark size={12} class="text-warning-icon" />
											<span class="text-text-muted">Edition</span>
											<span class="font-medium text-text">{evaluation.parsed.edition}</span>
										</span>
									{/if}
									{#if evaluation.parsed.languages.length > 0}
										<span
											class="inline-flex items-center gap-1.5 rounded-card border border-border bg-surface px-2 py-1"
										>
											<Earth size={12} class="text-success-icon" />
											<span class="text-text-muted">Languages</span>
											<span class="font-medium text-text"
												>{evaluation.parsed.languages.join(', ')}</span
											>
											<span class="text-[10px] text-text-subtle"
												>({evaluation.parsed.languageSource})</span
											>
										</span>
									{/if}
								</div>
							{/if}

							<!-- Custom Formats Row -->
							<div class="pt-0.5 font-medium text-text-muted">Formats</div>
							<div>
								{#if !selectedProfileId}
									<span class="text-text-subtle italic"
										>Select a quality profile to see scores.</span
									>
								{:else if matchingFormats.length === 0}
									<span class="text-text-subtle italic"
										>No custom formats matched with non-zero scores.</span
									>
								{:else}
									<div class="flex flex-wrap gap-2">
										{#each matchingFormats as cf}
											<CustomFormatBadge name={cf.name} score={cf.score} />
										{/each}
									</div>
								{/if}
							</div>
						</div>
					</div>
				</svelte:fragment>
			</ExpandableTable>
		{/key}
	{:else}
		<p class="py-4 text-sm text-text-muted">
			No releases yet. Import from an Arr instance to get started.
		</p>
	{/if}
</div>
