<script lang="ts">
	export let label: string;
	export let href: string;
	export let description: string;
</script>

<a
	{href}
	class="block rounded-card border-2 border-border bg-surface p-5 transition hover:border-border"
>
	<h2 class="mb-2 text-lg font-semibold text-text">
		{label}
	</h2>
	<p class="text-sm text-text-soft">
		{description}
	</p>
</a>
