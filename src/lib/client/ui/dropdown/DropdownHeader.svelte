<script lang="ts">
	export let label: string;
	export let compact: boolean = false;

	$: sizeClasses = compact
		? 'px-2 py-1 text-xs first:rounded-t-lg'
		: 'px-3 py-2 text-xs first:rounded-t-xl';
</script>

<div
	class="flex w-full items-center border-b border-neutral-200/50 dark:border-neutral-700/40 {sizeClasses}"
>
	<span class="text-neutral-500 dark:text-neutral-400">{label}</span>
</div>
