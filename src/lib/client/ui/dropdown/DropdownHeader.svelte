<script lang="ts">
	export let label: string;
	export let description: string = '';
	export let compact: boolean = false;

	$: sizeClasses = compact
		? 'px-2 py-1 text-xs first:rounded-t-lg'
		: 'px-3 py-2 text-xs first:rounded-t-xl';
</script>

<div
	class="flex w-full items-center border-b border-neutral-200/50 dark:border-neutral-700/40 {sizeClasses}"
>
	{#if description}
		<!-- Capped width so a long description wraps instead of widening the menu -->
		<div class="max-w-64">
			<span class="block text-neutral-500 dark:text-neutral-400">{label}</span>
			<span class="mt-0.5 block leading-snug text-neutral-400 dark:text-neutral-500">
				{description}
			</span>
		</div>
	{:else}
		<span class="text-neutral-500 dark:text-neutral-400">{label}</span>
	{/if}
</div>
