<script lang="ts">
	export let label: string;
	export let compact: boolean = false;

	$: sizeClasses = compact
		? 'px-2 py-1 text-xs last:rounded-b-control-sm'
		: 'px-3 py-1.5 text-xs last:rounded-b-control';
</script>

<div class="flex w-full items-center border-t border-border-subtle {sizeClasses}">
	<span class="text-text-subtle">{label}</span>
</div>
