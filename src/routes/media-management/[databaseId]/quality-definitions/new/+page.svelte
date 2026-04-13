<script lang="ts">
	import QualityDefinitionsForm from '../components/QualityDefinitionsForm.svelte';
	import DirtyModal from '$ui/modal/DirtyModal.svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	import type { ArrType } from '$shared/pcd/types.ts';

	export let data: PageData;

	let selectedArrType = $page.url.searchParams.get('arrType') as ArrType | null;

	$: availableQualities =
		selectedArrType === 'radarr' ? data.radarrQualities : data.sonarrQualities;

	onMount(() => {
		if (!selectedArrType) {
			goto(`/media-management/${data.currentDatabase.id}/quality-definitions`, {
				replaceState: true
			});
		}
	});
</script>

{#if selectedArrType}
	<QualityDefinitionsForm
		mode="create"
		arrType={selectedArrType}
		databaseName={data.currentDatabase?.name}
		canWriteToBase={data.canWriteToBase}
		{availableQualities}
		initialData={null}
	/>
{/if}

<DirtyModal />
