<script lang="ts">
	import GeneralForm from '../../components/GeneralForm.svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	// Build initial data from server
	$: initialData = {
		name: data.format.name,
		tags: data.format.tags.map((t) => t.name),
		description: data.format.description ?? '',
		includeInRename: data.format.include_in_rename
	};
</script>

<svelte:head>
	<title>{data.format.name} - General - Profilarr</title>
</svelte:head>

<GeneralForm mode="edit" canWriteToBase={data.canWriteToBase} actionUrl="?/update" {initialData} />
