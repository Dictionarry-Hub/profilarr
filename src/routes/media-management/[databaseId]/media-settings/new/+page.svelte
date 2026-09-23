<script lang="ts">
	import { resolve } from '$app/paths';
	import MediaSettingsForm from '../components/MediaSettingsForm.svelte';
	import DirtyModal from '$ui/modal/DirtyModal.svelte';
	import PageMeta from '$ui/meta/PageMeta.svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	import type { ArrType } from '$shared/pcd/types.ts';

	export let data: PageData;

	let selectedArrType = $page.url.searchParams.get('arrType') as ArrType | null;

	onMount(() => {
		if (!selectedArrType) {
			goto(resolve(`/media-management/${data.currentDatabase.id}/media-settings`), {
				replaceState: true
			});
		}
	});
</script>

<PageMeta title={`${data.currentDatabase.name} · Media Settings · New`} />

{#if selectedArrType}
	<MediaSettingsForm
		mode="create"
		arrType={selectedArrType}
		databaseName={data.currentDatabase?.name}
		canWriteToBase={data.canWriteToBase}
		initialData={null}
	/>
{/if}

<DirtyModal />
