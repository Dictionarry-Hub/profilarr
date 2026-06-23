<script lang="ts">
	import { goto } from '$app/navigation';
	import RegularExpressionForm from '../components/RegularExpressionForm.svelte';
	import DirtyModal from '$ui/modal/DirtyModal.svelte';
	import PageMeta from '$ui/meta/PageMeta.svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	// Initial data from preset or defaults
	const initialData = {
		name: data.preset.name,
		tags: data.preset.tags,
		pattern: data.preset.pattern,
		description: data.preset.description,
		regex101Id: data.preset.regex101Id
	};

	function handleCancel() {
		goto(`/regular-expressions/${data.currentDatabase.id}`);
	}
</script>

<PageMeta title={`${data.currentDatabase.name} · Regular Expression · New`} />

<div class="p-4 md:p-8">
	<RegularExpressionForm
		mode="create"
		databaseName={data.currentDatabase?.name}
		canWriteToBase={data.canWriteToBase}
		{initialData}
		onCancel={handleCancel}
	/>
</div>

<DirtyModal />
