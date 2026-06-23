<script lang="ts">
	import PageMeta from '$ui/meta/PageMeta.svelte';
	import type { PageData } from './$types';

	export let data: PageData;
</script>

<PageMeta title={`${data.database.name} · Tweaks`} />

<div class="mt-6">
	<div
		class="rounded-lg border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900"
	>
		<p class="text-neutral-500 dark:text-neutral-400">No tweaks available for this database.</p>
	</div>
</div>
