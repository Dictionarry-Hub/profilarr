<script lang="ts">
	export let label: string;
	export let value: string;
	export let type: 'text' | 'code' | 'link' = 'text';
	export let href: string | undefined = undefined;
</script>

<tr class="bg-surface">
	<td class="w-1/3 px-6 py-4 text-sm font-medium text-text">
		{label}
	</td>
	<td class="px-6 py-4 text-sm">
		{#if type === 'code'}
			<code class="rounded-control-sm bg-surface-hover px-2 py-1 font-mono text-text">
				{value}
			</code>
		{:else if type === 'link' && href}
			<a
				{href}
				target="_blank"
				rel="noopener noreferrer"
				data-sveltekit-reload
				class="rounded-control-sm bg-surface-hover px-2 py-1 font-mono text-link-text hover:underline"
			>
				{value}
			</a>
		{:else}
			{value}
		{/if}
	</td>
</tr>
