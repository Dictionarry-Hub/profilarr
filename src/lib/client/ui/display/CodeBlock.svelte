<script lang="ts">
	export let code: string;
	export let maxLines: number | undefined = undefined;
</script>

<pre class="rounded-control-sm border border-border bg-surface p-2 text-xs shadow-control"><code
		class="block font-mono break-all whitespace-pre-wrap text-text-soft"
		style={maxLines
			? `display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: ${maxLines}; overflow: hidden;`
			: ''}>{code}</code
	></pre>
