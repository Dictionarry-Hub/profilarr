<script lang="ts">
	import InstanceForm from '#routes/databases/components/InstanceForm.svelte';
	import PageMeta from '#ui/meta/PageMeta.svelte';
	import type { ActionData, PageData } from './$types';

	export let form: ActionData;
	export let data: PageData;
</script>

<PageMeta title="Database · New" />

<div class="px-4 pb-4 md:px-8 md:pb-8">
	<InstanceForm mode="create" {form} {data} />
</div>
