<script lang="ts">
	import { Database, Plus } from 'lucide-svelte';
	import EmptyState from '$ui/state/EmptyState.svelte';
	import type { PageData } from './$types';

	export let data: PageData;
</script>

<svelte:head>
	<title>Entity Testing - Profilarr</title>
</svelte:head>

{#if data.databases.length === 0}
	<EmptyState
		icon={Database}
		title="No Databases Linked"
		description="Link a Profilarr Compliant Database to test quality profiles."
		buttonText="Link Database"
		buttonHref="/databases/new"
		buttonIcon={Plus}
	/>
{/if}
