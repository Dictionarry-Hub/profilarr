<script lang="ts">
	import { ChevronDown } from 'lucide-svelte';

	export let title: string;
	export let description: string = '';
	export let open: boolean = true;
	export let onboardingId: string | undefined = undefined;

	function toggle() {
		open = !open;
	}
</script>

<div
	data-onboarding={onboardingId}
	class="overflow-hidden rounded-control border border-border bg-surface-muted"
>
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		class="flex cursor-pointer items-center justify-between bg-surface px-6 py-4"
		on:click={toggle}
	>
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-3">
				<h2 class="text-lg font-semibold text-text">{title}</h2>
				<slot name="header-right" />
			</div>
			{#if description}
				<p class="mt-1 text-sm text-text-soft">{description}</p>
			{/if}
		</div>
		<ChevronDown
			size={18}
			class="ml-4 shrink-0 text-text-subtle transition-transform duration-200 {open
				? ''
				: '-rotate-90'}"
		/>
	</div>
	{#if open}
		<div class="border-t border-border">
			<slot />
		</div>
	{/if}
</div>
