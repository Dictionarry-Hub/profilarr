<script lang="ts">
	import GeneralForm from '../../components/GeneralForm.svelte';
	import Table from '$ui/table/Table.svelte';
	import Score from '$ui/arr/Score.svelte';
	import InlineLink from '$ui/link/InlineLink.svelte';
	import { page } from '$app/stores';
	import type { PageData } from './$types';

	export let data: PageData;

	$: databaseId = $page.params.databaseId;

	// Build initial data from server
	$: initialData = {
		name: data.format.name,
		tags: data.format.tags.map((t) => t.name),
		description: data.format.description ?? '',
		includeInRename: data.format.include_in_rename
	};

	const columns = [
		{ key: 'name', header: 'Profile' },
		{ key: 'radarrScore', header: 'Radarr', align: 'center' as const },
		{ key: 'sonarrScore', header: 'Sonarr', align: 'center' as const }
	];
</script>

<svelte:head>
	<title>{data.format.name} - General - Profilarr</title>
</svelte:head>

<GeneralForm mode="edit" canWriteToBase={data.canWriteToBase} actionUrl="?/update" {initialData} />

<div class="space-y-3 md:px-4" data-onboarding="cf-general-references">
	<div class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
		References ({data.profileRefs.length})
	</div>
	{#if data.profileRefs.length > 0}
		<Table data={data.profileRefs} {columns} compact responsive>
			<svelte:fragment slot="cell" let:row let:column>
				{#if column.key === 'name'}
					<InlineLink
						href="/quality-profiles/{databaseId}/{row.id}/scoring"
						text={row.name}
						external
					/>
				{:else if column.key === 'radarrScore'}
					<Score score={row.radarrScore} size="sm" />
				{:else if column.key === 'sonarrScore'}
					<Score score={row.sonarrScore} size="sm" />
				{/if}
			</svelte:fragment>
		</Table>
	{:else}
		<p class="text-sm text-neutral-500 dark:text-neutral-400">Not used in any quality profiles.</p>
	{/if}
</div>
