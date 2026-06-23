<script lang="ts">
	import { goto } from '$app/navigation';
	import GeneralForm from '../components/GeneralForm.svelte';
	import DirtyModal from '$ui/modal/DirtyModal.svelte';
	import PageMeta from '$ui/meta/PageMeta.svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	// Default initial data for new format
	const initialData = {
		name: '',
		tags: [],
		description: '',
		includeInRename: false
	};

	function handleCancel() {
		goto(`/custom-formats/${data.currentDatabase.id}`);
	}
</script>

<PageMeta title={`${data.currentDatabase.name} · Custom Format · New`} />

<div class="p-4 md:p-8">
	<GeneralForm
		mode="create"
		canWriteToBase={data.canWriteToBase}
		{initialData}
		onCancel={handleCancel}
	/>
</div>

<DirtyModal />
