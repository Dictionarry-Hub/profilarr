<script lang="ts">
	import { page } from '$app/stores';
	import PageMeta from '$ui/meta/PageMeta.svelte';
	import InstanceForm from '../components/InstanceForm.svelte';
	import type { ActionData } from './$types';

	export let form: ActionData;

	// Get type from URL params if provided
	$: typeFromUrl = $page.url.searchParams.get('type') || '';
</script>

<PageMeta title="Arr Instance · New" />

<div class="p-8">
	<InstanceForm mode="create" {form} initialType={typeFromUrl} />
</div>
