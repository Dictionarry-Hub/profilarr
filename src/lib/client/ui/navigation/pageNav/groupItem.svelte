<script lang="ts">
	import { page } from '$app/stores';
	import type { ComponentType } from 'svelte';

	interface Props {
		label: string;
		href: string;
		/** Optional pattern to match against pathname for active state (supports string includes or regex) */
		activePattern?: string | RegExp;
		/** Optional Lucide icon component */
		icon?: ComponentType;
		/** Optional SVG image source URL */
		iconSrc?: string;
		/** Optional click handler (use e.preventDefault() to override navigation) */
		onclick?: (e: MouseEvent) => void;
	}

	let { label, href, activePattern, icon, iconSrc, onclick }: Props = $props();

	const isActive = $derived.by(() => {
		const pathname = $page.url.pathname;

		// Use custom pattern if provided
		if (activePattern) {
			if (typeof activePattern === 'string') {
				return pathname.includes(activePattern);
			}
			return activePattern.test(pathname);
		}

		// Default behavior
		return pathname === href || pathname.startsWith(href + '/');
	});
</script>

<a
	{href}
	{onclick}
	class="flex items-center gap-2 rounded-lg py-1.5 pr-2 pl-3 font-sans text-sm font-semibold text-neutral-600 transition-colors hover:bg-neutral-200 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100 {isActive
		? 'bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
		: ''}"
>
	{#if iconSrc}
		<span class="nav-icon-emoji"><img src={iconSrc} alt="" class="h-3.5 w-3.5" /></span>
	{/if}
	{#if icon}
		{@const Icon = icon}
		<span class="nav-icon-lucide"><Icon size={14} /></span>
	{/if}
	{label}
</a>
