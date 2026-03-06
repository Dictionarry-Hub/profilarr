<script lang="ts">
	export let format: string = '';
	export let resolver: (format: string) => string;

	$: preview = format ? resolver(format) : '';
</script>

{#if preview}
	<p class="mt-2 font-mono text-xs break-all text-neutral-500 dark:text-neutral-400">
		{preview}
	</p>
{/if}
