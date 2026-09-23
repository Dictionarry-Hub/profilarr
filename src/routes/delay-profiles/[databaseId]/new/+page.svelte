<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import DelayProfileForm from '../components/DelayProfileForm.svelte';
	import DirtyModal from '$ui/modal/DirtyModal.svelte';
	import PageMeta from '$ui/meta/PageMeta.svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	// Default initial data for create mode
	const initialData = {
		name: '',
		preferredProtocol: 'prefer_usenet' as const,
		usenetDelay: 0,
		torrentDelay: 0,
		bypassIfHighestQuality: false,
		bypassIfAboveCfScore: false,
		minimumCfScore: 0
	};

	function handleCancel() {
		goto(resolve(`/delay-profiles/${data.currentDatabase.id}`));
	}
</script>

<PageMeta title={`${data.currentDatabase.name} · Delay Profile · New`} />

<div class="p-4 md:p-8">
	<DelayProfileForm
		mode="create"
		databaseName={data.currentDatabase?.name}
		canWriteToBase={data.canWriteToBase}
		{initialData}
		onCancel={handleCancel}
	/>
</div>

<DirtyModal />
