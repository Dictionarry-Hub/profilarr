<script lang="ts">
	import { goto } from '$app/navigation';
	import RegularExpressionForm from '../components/RegularExpressionForm.svelte';
	import DirtyModal from '$ui/modal/DirtyModal.svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	// Build initial data from server
	$: initialData = {
		name: data.regularExpression.name,
		tags: data.regularExpression.tags.map((t) => t.name),
		pattern: data.regularExpression.pattern,
		description: data.regularExpression.description ?? '',
		regex101Id: data.regularExpression.regex101_id ?? ''
	};

	function handleCancel() {
		goto(`/regular-expressions/${data.currentDatabase.id}`);
	}
</script>

<svelte:head>
	<title>{data.regularExpression.name} - Regular Expressions - Profilarr</title>
</svelte:head>

<div class="p-4 md:p-8">
	<RegularExpressionForm
		mode="edit"
		databaseName={data.currentDatabase?.name}
		canWriteToBase={data.canWriteToBase}
		actionUrl="?/update"
		{initialData}
		onCancel={handleCancel}
		breadcrumbItems={[
			{ label: data.currentDatabase.name, href: `/regular-expressions/${data.currentDatabase.id}` }
		]}
		breadcrumbCurrent={data.regularExpression.name}
	/>
</div>

<DirtyModal />
