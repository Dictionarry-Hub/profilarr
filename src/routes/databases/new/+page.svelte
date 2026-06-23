<script lang="ts">
	import InstanceForm from '../components/InstanceForm.svelte';
	import PageMeta from '$ui/meta/PageMeta.svelte';
	import type { ActionData, PageData } from './$types';

	export let form: ActionData;
	export let data: PageData;
</script>

<PageMeta title="Database · New" />

<div class="p-4 md:p-8">
	<InstanceForm mode="create" {form} {data} />
</div>
