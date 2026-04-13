<script lang="ts">
	import RadarrNamingForm from '../components/RadarrNamingForm.svelte';
	import SonarrNamingForm from '../components/SonarrNamingForm.svelte';
	import DirtyModal from '$ui/modal/DirtyModal.svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	import type { ArrType } from '$shared/pcd/types.ts';

	export let data: PageData;

	let selectedArrType = $page.url.searchParams.get('arrType') as Exclude<ArrType, 'all'> | null;

	onMount(() => {
		if (!selectedArrType) {
			goto(`/media-management/${data.currentDatabase.id}/naming`, { replaceState: true });
		}
	});
</script>

{#if selectedArrType === 'radarr'}
	<RadarrNamingForm
		mode="create"
		databaseName={data.currentDatabase?.name}
		canWriteToBase={data.canWriteToBase}
		initialData={null}
	/>
{:else if selectedArrType === 'sonarr'}
	<SonarrNamingForm
		mode="create"
		databaseName={data.currentDatabase?.name}
		canWriteToBase={data.canWriteToBase}
		initialData={null}
	/>
{/if}

<DirtyModal />
