<script lang="ts">
	export let href: string;
	export let text: string;
	export let external: boolean = false;
</script>

<a
	{href}
	target={external ? '_blank' : undefined}
	rel={external ? 'noopener noreferrer' : undefined}
	class="text-neutral-900 transition-colors hover:text-accent-600 hover:underline dark:text-neutral-100 dark:hover:text-accent-400"
>
	{text}
</a>
