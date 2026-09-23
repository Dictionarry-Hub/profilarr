<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import TestForm from '../components/TestForm.svelte';
	import DirtyModal from '$ui/modal/DirtyModal.svelte';
	import PageMeta from '$ui/meta/PageMeta.svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	function handleCancel() {
		goto(resolve(`/custom-formats/${$page.params.databaseId}/${$page.params.id}/testing`));
	}
</script>

<PageMeta title={`${data.format.name} · Testing · New`} />

<TestForm
	mode="create"
	formatName={data.format.name}
	canWriteToBase={data.canWriteToBase}
	initialData={{
		title: '',
		type: 'movie',
		shouldMatch: true,
		description: ''
	}}
	onCancel={handleCancel}
/>

<DirtyModal />
