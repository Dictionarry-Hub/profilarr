<script lang="ts">
	export let name: string;
	export let paths: string[];
	export let description: string;
</script>

<section
	class="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
>
	<div class="space-y-2 border-b border-neutral-200 p-6 dark:border-neutral-800">
		<h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{name}</h2>
		<p class="text-xs text-neutral-500 dark:text-neutral-400">{paths.join(', ')}</p>
		<p class="text-sm text-neutral-600 dark:text-neutral-300">{description}</p>
	</div>
	<div class="space-y-4 p-6">
		<slot />
	</div>
</section>
