<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';

	export let title: string;
	export let description: string = '';
	export let open: boolean = true;
	export let onboardingId: string | undefined = undefined;

	function toggle(event: MouseEvent) {
		// Clicks on header actions shouldn't collapse the card. This checks the
		// target instead of stopping propagation, which would also stop
		// SvelteKit's link handling at the document root.
		if ((event.target as Element | null)?.closest('[data-card-actions]')) return;
		open = !open;
	}
</script>

<div
	data-onboarding={onboardingId}
	class="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
>
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		class="flex cursor-pointer items-center justify-between bg-neutral-50 px-6 py-4 dark:bg-neutral-800/50"
		on:click={toggle}
	>
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-3">
				<h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{title}</h2>
				<slot name="header-right" />
			</div>
			{#if description || $$slots.description}
				<p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
					<slot name="description">{description}</slot>
				</p>
			{/if}
		</div>
		{#if $$slots['header-actions']}
			<div class="ml-4 flex shrink-0 items-center gap-2" data-card-actions>
				<slot name="header-actions" />
			</div>
		{/if}
		<!-- The header's click handler toggles, so the button needs none of its own.
		     It gives keyboard users a focusable control and names the toggle. -->
		<button
			type="button"
			class="ml-4 flex shrink-0 items-center rounded text-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-2"
			aria-expanded={open}
			aria-label="{open ? 'Collapse' : 'Expand'} {title}"
		>
			<ChevronDown size={18} class="transition-transform duration-200 {open ? '' : '-rotate-90'}" />
		</button>
	</div>
	{#if open}
		<div class="border-t border-neutral-200 dark:border-neutral-800">
			<slot />
		</div>
	{/if}
</div>
