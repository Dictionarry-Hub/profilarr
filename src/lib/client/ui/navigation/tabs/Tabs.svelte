<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import type { ComponentType } from 'svelte';
	import { ArrowLeft, ChevronRight, ChevronDown } from 'lucide-svelte';
	import Breadcrumb from '$ui/navigation/breadcrumb/Breadcrumb.svelte';
	import { clickOutside } from '$lib/client/utils/clickOutside';
	import Dropdown from '$ui/dropdown/Dropdown.svelte';
	import DropdownItem from '$ui/dropdown/DropdownItem.svelte';

	interface Tab {
		label: string;
		href: string;
		active?: boolean;
		icon?: ComponentType;
		onboarding?: string;
		badge?: number;
	}

	const badgeClass =
		'inline-flex min-w-5 items-center justify-center rounded-full bg-blue-100 px-1.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';

	interface BackButton {
		label: string;
		href?: string;
	}

	interface Breadcrumb {
		items: { label: string; href: string }[];
		current: string;
	}

	export let tabs: Tab[] = [];
	export let backButton: BackButton | undefined = undefined;
	export let breadcrumb: Breadcrumb | undefined = undefined;
	export let responsive: boolean = false;
	export let mobileBreakpoint: number = 768;
	export let hideWhenSingle: boolean = true;
	export let hiddenSpacerClass: string = 'h-1';

	// Mobile detection
	let isMobile = false;
	let mediaQuery: MediaQueryList | null = null;
	let dropdownOpen = false;
	let triggerEl: HTMLElement;

	onMount(() => {
		if (responsive && typeof window !== 'undefined') {
			mediaQuery = window.matchMedia(`(max-width: ${mobileBreakpoint - 1}px)`);
			isMobile = mediaQuery.matches;
			mediaQuery.addEventListener('change', handleMediaChange);
		}
	});

	onDestroy(() => {
		if (mediaQuery) {
			mediaQuery.removeEventListener('change', handleMediaChange);
		}
	});

	function handleMediaChange(e: MediaQueryListEvent) {
		isMobile = e.matches;
	}

	$: useMobileMode = responsive && isMobile;

	// Get current active tab
	$: activeTab = tabs.find((t) => t.active) ?? tabs[0];

	function handleTabSelect(href: string) {
		dropdownOpen = false;
		goto(href, { replaceState: true });
	}
</script>

{#if hideWhenSingle && tabs.length <= 1 && !backButton && !breadcrumb}
	<div class={hiddenSpacerClass}></div>
{:else if useMobileMode}
	<!-- Mobile: Custom dropdown with icons -->
	<div class="flex h-16 items-center border-b border-border">
		<div class="flex flex-1 items-center gap-2">
			<div
				class="relative flex-1"
				bind:this={triggerEl}
				use:clickOutside={() => (dropdownOpen = false)}
			>
				<button
					type="button"
					on:click={() => (dropdownOpen = !dropdownOpen)}
					class="flex w-full items-center justify-between gap-2 rounded-control border border-border bg-surface px-3 py-2 text-sm font-medium text-text shadow-control transition-colors hover:bg-surface-hover"
				>
					<span class="flex items-center gap-1.5 overflow-hidden">
						{#if breadcrumb}
							{#each breadcrumb.items as item}
								<span class="shrink-0 text-text-muted">{item.label}</span>
								<ChevronRight size={12} class="shrink-0 text-text-subtle" />
							{/each}
							<span class="shrink-0 text-text-muted">{breadcrumb.current}</span>
							<ChevronRight size={12} class="shrink-0 text-text-subtle" />
						{/if}
						{#if activeTab?.icon && !breadcrumb}
							<svelte:component
								this={activeTab.icon}
								size={16}
								class="shrink-0 text-accent-solid"
							/>
						{/if}
						<span class="truncate">{activeTab?.label ?? 'Select...'}</span>
						{#if activeTab?.badge && activeTab.badge > 0}
							<span class={badgeClass}>{activeTab.badge}</span>
						{/if}
					</span>
					<ChevronDown
						size={16}
						class="text-text-muted transition-transform {dropdownOpen ? 'rotate-180' : ''}"
					/>
				</button>

				{#if dropdownOpen}
					<Dropdown position="left" minWidth="100%" {triggerEl}>
						{#each tabs as tab}
							<DropdownItem
								icon={tab.icon}
								label={tab.label}
								customContent
								selected={tab.active}
								on:click={() => handleTabSelect(tab.href)}
							>
								<span class="flex items-center gap-2">
									<span>{tab.label}</span>
									{#if tab.badge && tab.badge > 0}
										<span class={badgeClass}>{tab.badge}</span>
									{/if}
								</span>
							</DropdownItem>
						{/each}
					</Dropdown>
				{/if}
			</div>
			{#if backButton}
				<button
					type="button"
					on:click={() => history.back()}
					class="flex cursor-pointer items-center gap-1.5 rounded-control border border-border bg-surface px-3 py-2 text-sm font-medium text-text-soft shadow-control transition-colors hover:bg-surface-hover hover:text-text"
				>
					<ArrowLeft size={14} />
					{backButton.label}
				</button>
			{/if}
		</div>
	</div>
{:else}
	<!-- Desktop: Tab bar -->
	<div class="flex h-16 items-end border-b border-border">
		<nav class="-mb-px flex flex-1 items-center justify-between gap-2" aria-label="Tabs">
			<div class="flex gap-2">
				{#each tabs as tab (tab.href)}
					<button
						type="button"
						on:click={() => handleTabSelect(tab.href)}
						data-onboarding={tab.onboarding || null}
						class="flex cursor-pointer items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors {tab.active
							? 'border-accent-solid text-accent-solid'
							: 'border-transparent text-text-soft hover:border-border hover:text-text'}"
					>
						{#if tab.icon}
							<svelte:component this={tab.icon} size={16} />
						{/if}
						{tab.label}
						{#if tab.badge && tab.badge > 0}
							<span class={badgeClass}>{tab.badge}</span>
						{/if}
					</button>
				{/each}

				<!-- Actions slot for custom action tabs (like Add Instance) -->
				<slot name="actions" />
			</div>

			{#if breadcrumb}
				<Breadcrumb items={breadcrumb.items} current={breadcrumb.current} />
			{:else if backButton}
				<button
					type="button"
					on:click={() => history.back()}
					class="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm font-medium text-text-soft transition-colors hover:text-text"
				>
					<ArrowLeft size={14} />
					{backButton.label}
				</button>
			{/if}
		</nav>
	</div>
{/if}
