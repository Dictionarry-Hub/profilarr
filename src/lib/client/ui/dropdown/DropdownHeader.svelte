<script lang="ts">
	export let label: string;
	export let compact: boolean = false;

	$: sizeClasses = compact
		? 'px-2 py-1 text-xs first:rounded-t-control-sm'
		: 'px-3 py-2 text-xs first:rounded-t-control';
</script>

<div class="flex w-full items-center border-b border-border-subtle {sizeClasses}">
	<span class="text-text-muted">{label}</span>
</div>
