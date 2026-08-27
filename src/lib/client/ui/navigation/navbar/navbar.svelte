<script lang="ts">
	import { resolve } from '$app/paths';
	import { isRouteActive } from '$lib/client/utils/routePath';
	import AccentPicker from './accentPicker.svelte';
	import ThemeToggle from './themeToggle.svelte';
	import HelpButton from '$ui/help/HelpButton.svelte';
	import {
		Menu,
		ChevronLeft,
		ChevronRight,
		FolderTree,
		Link,
		Sliders,
		Palette,
		Microscope,
		Tag,
		Clock,
		Settings,
		Wrench,
		Megaphone,
		ArrowUp
	} from '@lucide/svelte';
	import type { Component } from 'svelte';
	import Button from '$ui/button/Button.svelte';
	import Tooltip from '$ui/tooltip/Tooltip.svelte';
	import { mobileNavOpen } from '$stores/mobileNav';
	import { sidebarCollapsed } from '$stores/sidebar';
	import { navIconStore } from '$stores/navIcons';
	import { cutscene } from '$lib/client/cutscene/store';
	import { page } from '$app/stores';
	import logo from '$assets/logo-512.png';

	export let unreadAnnouncements: number = 0;

	type RailLink = {
		label: string;
		href: string;
		icon: Component;
		emoji: string;
		devOnly?: boolean;
		alert?: number;
	};

	$: collapsed = $sidebarCollapsed;
	$: cutsceneActive = $cutscene.active;
	$: iconStyle = $navIconStore;
	$: currentPathname = $page.url.pathname;
	$: versionStatus = $page.data.versionStatus ?? null;
	$: outOfDate = versionStatus?.status === 'out-of-date' && versionStatus.latestVersion;

	$: railLinks = [
		{ label: 'Dev', href: resolve('/dev'), icon: Wrench, emoji: '🛠️', devOnly: true },
		{
			label: 'Announcements',
			href: resolve('/announcements'),
			icon: Megaphone,
			emoji: '📣',
			alert: unreadAnnouncements
		},
		{ label: 'Databases', href: resolve('/databases'), icon: FolderTree, emoji: '📦' },
		{ label: 'Arrs', href: resolve('/arr'), icon: Link, emoji: '🔗' },
		{ label: 'Quality Profiles', href: resolve('/quality-profiles'), icon: Sliders, emoji: '⚡' },
		{ label: 'Custom Formats', href: resolve('/custom-formats'), icon: Palette, emoji: '🎨' },
		{
			label: 'Regular Expressions',
			href: resolve('/regular-expressions'),
			icon: Microscope,
			emoji: '🔬'
		},
		{ label: 'Media Management', href: resolve('/media-management'), icon: Tag, emoji: '🏷️' },
		{ label: 'Delay Profiles', href: resolve('/delay-profiles'), icon: Clock, emoji: '⏳' },
		{ label: 'Settings', href: resolve('/settings'), icon: Settings, emoji: '⚙️' }
	] satisfies RailLink[];

	const isActive = isRouteActive;
</script>

<nav
	class="fixed top-0 left-0 z-50 w-full border-r-0 border-b border-neutral-200 bg-neutral-50 transition-[width,height] duration-200 ease-in-out md:z-[80] md:overflow-hidden md:border-r dark:border-neutral-800 dark:bg-neutral-900
		{collapsed ? 'md:h-screen md:w-14' : 'md:h-16 md:w-80'}"
>
	<!-- Mobile -->
	<div class="flex items-center justify-between gap-3 px-4 py-4 md:hidden">
		<div class="flex items-center gap-2">
			<button
				type="button"
				on:click={() => mobileNavOpen.open()}
				class="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
				aria-label="Open menu"
			>
				<Menu size={20} />
			</button>
		</div>
		<div class="flex items-center justify-end gap-1">
			<AccentPicker />
			<ThemeToggle />
			<HelpButton variant="navbar" />
		</div>
	</div>

	<!-- Desktop expanded -->
	<div
		class="hidden items-center justify-between gap-3 px-4 py-4 whitespace-nowrap transition-opacity duration-150 ease-in-out md:flex
			{collapsed ? 'opacity-0' : 'opacity-100'}"
	>
		<div class="flex items-center gap-2">
			<img src={logo} alt="Profilarr logo" class="ml-4 h-5 w-5 translate-y-[2px]" />
			<div class="text-xl font-bold text-neutral-900 dark:text-neutral-100">profilarr</div>
		</div>
		<div class="flex items-center justify-end gap-1">
			<AccentPicker onboarding="accent-picker" />
			<ThemeToggle onboarding="theme-toggle" />
			<HelpButton variant="navbar" />
			{#if !cutsceneActive}
				<button
					type="button"
					on:click={() => sidebarCollapsed.collapse()}
					class="cursor-pointer rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
					aria-label="Collapse sidebar"
				>
					<ChevronLeft size={18} />
				</button>
			{/if}
		</div>
	</div>

	<!-- Desktop collapsed icon rail -->
	<div
		class="absolute inset-0 hidden flex-col items-center transition-opacity duration-150 ease-in-out md:flex
			{collapsed ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}"
	>
		<div class="mt-4">
			<Tooltip text="Expand sidebar" position="right">
				<button
					type="button"
					aria-label="Expand sidebar"
					class="flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
					on:click={() => sidebarCollapsed.expand()}
				>
					<ChevronRight size={16} />
				</button>
			</Tooltip>
		</div>

		<div class="flex min-h-0 flex-1 items-center">
			<div class="flex max-h-full flex-col items-center gap-2 overflow-y-auto px-3">
				{#each railLinks as item}
					{#if !item.devOnly || import.meta.env.DEV}
						<div class="relative">
							<Tooltip text={item.label} position="right">
								<a
									href={item.href}
									aria-label={item.label}
									class="flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 {isActive(
										item.href,
										currentPathname
									)
										? 'border-neutral-300 bg-white text-neutral-700 dark:border-neutral-700/60 dark:bg-neutral-800/50 dark:text-neutral-200'
										: ''}"
								>
									{#if iconStyle === 'emoji'}
										<span class="text-lg leading-none">{item.emoji}</span>
									{:else}
										<svelte:component this={item.icon} size={16} />
									{/if}
								</a>
							</Tooltip>
							{#if (item.alert ?? 0) > 0}
								<span
									class="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] leading-none font-semibold text-white dark:bg-blue-500"
								>
									{item.alert}
								</span>
							{/if}
						</div>
					{/if}
				{/each}
			</div>
		</div>

		<a
			href={resolve('/')}
			aria-label="Profilarr home"
			class="rounded-md p-1 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-800"
		>
			<img src={logo} alt="Profilarr" class="h-5 w-5" />
		</a>

		{#if outOfDate}
			<div class="mt-2 mb-4">
				<Button
					icon={ArrowUp}
					variant="outline"
					size="sm"
					href={versionStatus.releaseUrl ?? undefined}
					target={versionStatus.releaseUrl ? '_blank' : undefined}
					rel={versionStatus.releaseUrl ? 'noopener noreferrer' : undefined}
					iconColor="text-emerald-600 dark:text-emerald-400"
					tooltip="Update Available: {versionStatus.latestVersion}"
					tooltipPosition="right"
				/>
			</div>
		{:else}
			<div class="mb-4"></div>
		{/if}
	</div>
</nav>
