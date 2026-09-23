<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import GeneralForm from '../components/GeneralForm.svelte';
	import DirtyModal from '$ui/modal/DirtyModal.svelte';
	import PageMeta from '$ui/meta/PageMeta.svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	// Default initial data for new profile
	const initialData = {
		name: '',
		tags: [],
		description: '',
		language: null
	};

	function handleCancel() {
		goto(resolve(`/quality-profiles/${data.currentDatabase.id}`));
	}
</script>

<PageMeta title={`${data.currentDatabase.name} · Quality Profile · New`} />

<div class="p-8">
	<GeneralForm
		mode="create"
		canWriteToBase={data.canWriteToBase}
		{initialData}
		availableLanguages={data.availableLanguages}
		onCancel={handleCancel}
	/>
</div>

<DirtyModal />
