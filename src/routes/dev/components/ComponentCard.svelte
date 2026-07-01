<script lang="ts">
	export let name: string;
	export let paths: string[];
	export let description: string;
</script>

<section class="rounded-card border border-border bg-surface">
	<div class="space-y-2 border-b border-border p-6">
		<h2 class="text-lg font-semibold text-text">{name}</h2>
		<p class="text-xs text-text-muted">{paths.join(', ')}</p>
		<p class="text-sm text-text-soft">{description}</p>
	</div>
	<div class="space-y-4 p-6">
		<slot />
	</div>
</section>
