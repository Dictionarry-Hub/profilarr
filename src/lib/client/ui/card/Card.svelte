<script lang="ts">
	import { getContext } from 'svelte';

	export let padding: 'none' | 'sm' | 'md' | 'lg' = 'md';
	export let hoverable: boolean = false;
	export let href: string | undefined = undefined;
	export let onclick: (() => void) | undefined = undefined;
	export let flush: boolean = false;
	export let className: string = '';

	let contextFlush = false;
	try {
		contextFlush = getContext<boolean>('card-flush') ?? false;
	} catch {
		/* no parent CardGrid */
	}
	$: isFlush = flush || contextFlush;

	$: hasHeader = !!$$slots.header;
	$: hasFooter = !!$$slots.footer;
	$: interactive = !!href || !!onclick;

	$: paddingClass = {
		none: '',
		sm: 'px-3 py-2',
		md: 'px-4 py-3',
		lg: 'px-5 py-4'
	}[padding];

	$: dividerClass = {
		none: '',
		sm: 'mx-3',
		md: 'mx-4',
		lg: 'mx-5'
	}[padding];

	$: bgClass = isFlush ? 'bg-[var(--theme-flush-bg)]' : 'bg-surface';

	$: hoverClass =
		hoverable || interactive
			? isFlush
				? 'transition-colors hover:bg-[var(--theme-flush-hover)]'
				: 'transition-colors hover:bg-surface-hover-muted'
			: '';

	$: cursorClass = interactive ? 'cursor-pointer' : '';

	$: cardClass = `flex flex-col overflow-hidden rounded-card border border-border shadow-card ${bgClass} ${hoverClass} ${cursorClass} ${className}`;
</script>

{#if href}
	<a {href} class={cardClass}>
		{#if hasHeader}
			<div class={paddingClass}>
				<slot name="header" />
			</div>
			<div class="border-t border-border-muted {dividerClass}"></div>
		{/if}

		<div class="flex flex-1 flex-col {paddingClass}">
			<slot />
		</div>

		{#if hasFooter}
			<div class="border-t border-border-muted {dividerClass}"></div>
			<div class={paddingClass}>
				<slot name="footer" />
			</div>
		{/if}
	</a>
{:else}
	<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
	<div class={cardClass} on:click={onclick}>
		{#if hasHeader}
			<div class={paddingClass}>
				<slot name="header" />
			</div>
			<div class="border-t border-border-muted {dividerClass}"></div>
		{/if}

		<div class="flex flex-1 flex-col {paddingClass}">
			<slot />
		</div>

		{#if hasFooter}
			<div class="border-t border-border-muted {dividerClass}"></div>
			<div class={paddingClass}>
				<slot name="footer" />
			</div>
		{/if}
	</div>
{/if}
