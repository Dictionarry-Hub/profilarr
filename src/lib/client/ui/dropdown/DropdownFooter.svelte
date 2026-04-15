<script lang="ts">
	export let label: string;
	export let compact: boolean = false;

	$: sizeClasses = compact
		? 'px-2 py-1 text-xs last:rounded-b-lg'
		: 'px-3 py-1.5 text-xs last:rounded-b-xl';
</script>

<div
	class="flex w-full items-center border-t border-neutral-200/50 dark:border-neutral-700/40 {sizeClasses}"
>
	<span class="text-neutral-400 dark:text-neutral-500">{label}</span>
</div>
