<script lang="ts">
	import type { PageData } from './$types';

	export let data: PageData;
</script>

<svelte:head>
	<title>Tweaks - {data.database.name} - Profilarr</title>
</svelte:head>

<div class="mt-6">
	<div class="rounded-card border border-border bg-surface p-8 text-center">
		<p class="text-text-muted">No tweaks available for this database.</p>
	</div>
</div>
