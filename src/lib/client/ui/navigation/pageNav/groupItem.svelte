<script lang="ts">
	import { page } from '$app/stores';
	import type { ComponentType } from 'svelte';
	import Label from '$ui/label/Label.svelte';

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
		/** Optional data-onboarding attribute for cutscene targeting */
		onboardingId?: string;
		/** When > 0, shows a count pill on the right to flag unread / pending items */
		alert?: number;
	}

	let {
		label,
		href,
		activePattern,
		icon,
		iconSrc,
		onclick,
		onboardingId,
		alert = 0
	}: Props = $props();

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
	data-onboarding={onboardingId}
	class="flex items-center gap-2 rounded-control border py-1.5 pr-2 pl-3 font-sans text-sm font-semibold text-text-muted transition-colors hover:bg-surface-hover hover:text-text {isActive
		? 'border-border bg-surface text-text shadow-control'
		: 'border-transparent'}"
>
	{#if iconSrc}
		<span class="nav-icon-emoji"><img src={iconSrc} alt="" class="h-3.5 w-3.5" /></span>
	{/if}
	{#if icon}
		{@const Icon = icon}
		<span class="nav-icon-lucide"><Icon size={14} /></span>
	{/if}
	<span class="flex-1">{label}</span>
	{#if alert > 0}
		<Label variant="info" size="sm" radius="full">{alert}</Label>
	{/if}
</a>
