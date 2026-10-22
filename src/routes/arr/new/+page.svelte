<script lang="ts">
	import { page } from '$stores/page';
	import PageMeta from '$ui/meta/PageMeta.svelte';
	import InstanceForm from '../components/InstanceForm.svelte';
	import type { ActionData } from './$types';

	export let form: ActionData;

	// Get type from URL params if provided
	$: typeFromUrl = $page.url.searchParams.get('type') || '';
</script>

<PageMeta title="Arr Instance · New" />

<div class="px-4 pb-4 md:px-8 md:pb-8">
	<InstanceForm mode="create" {form} initialType={typeFromUrl} />
</div>
