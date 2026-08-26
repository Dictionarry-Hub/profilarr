<script lang="ts">
	import { resolve } from '$app/paths';
	import { Database, Plus } from '@lucide/svelte';
	import EmptyState from '$ui/state/EmptyState.svelte';
	import PageMeta from '$ui/meta/PageMeta.svelte';
	import type { PageData } from './$types';

	export let data: PageData;
</script>

<PageMeta title="Delay Profiles" />

{#if data.databases.length === 0}
	<EmptyState
		icon={Database}
		title="No Databases Linked"
		description="Link a Profilarr Compliant Database to manage delay profiles."
		buttonText="Link Database"
		buttonHref={resolve('/databases/new')}
		buttonIcon={Plus}
	/>
{/if}
