<script lang="ts">
	export let href: string;
	export let text: string;
	export let external: boolean = false;
</script>

<a
	{href}
	target={external ? '_blank' : undefined}
	rel={external ? 'noopener noreferrer' : undefined}
	class="text-link-text transition-colors hover:underline"
>
	{text}
</a>
