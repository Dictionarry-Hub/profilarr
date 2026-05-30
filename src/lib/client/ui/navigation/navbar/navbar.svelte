<script lang="ts">
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
	} from 'lucide-svelte';
	import type { ComponentType } from 'svelte';
	import Button from '$ui/button/Button.svelte';
	import Tooltip from '$ui/tooltip/Tooltip.svelte';
	import { mobileNavOpen } from '$stores/mobileNav';
	import { sidebarCollapsed } from '$stores/sidebar';
	import { navIconStore } from '$stores/navIcons';
	import { cutscene } from '$lib/client/cutscene/store';
	import { page } from '$app/stores';
	import { themePreference } from '$stores/theme.ts';
	import { getThemeDefinition } from '$lib/client/themes/registry.ts';
	import logo from '$assets/logo-512.png';

	export let unreadAnnouncements: number = 0;

	type RailLink = {
		label: string;
		href: string;
		icon: ComponentType;
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
	$: themeDef = getThemeDefinition($themePreference);
	$: fixedAccentColor = themeDef.fixedAccent ? themeDef.accentColor : undefined;

	$: railLinks = [
		{ label: 'Dev', href: '/dev', icon: Wrench, emoji: '🛠️', devOnly: true },
		{
			label: 'Announcements',
			href: '/announcements',
			icon: Megaphone,
			emoji: '📣',
			alert: unreadAnnouncements
		},
		{ label: 'Databases', href: '/databases', icon: FolderTree, emoji: '📦' },
		{ label: 'Arrs', href: '/arr', icon: Link, emoji: '🔗' },
		{ label: 'Quality Profiles', href: '/quality-profiles', icon: Sliders, emoji: '⚡' },
		{ label: 'Custom Formats', href: '/custom-formats', icon: Palette, emoji: '🎨' },
		{ label: 'Regular Expressions', href: '/regular-expressions', icon: Microscope, emoji: '🔬' },
		{ label: 'Media Management', href: '/media-management', icon: Tag, emoji: '🏷️' },
		{ label: 'Delay Profiles', href: '/delay-profiles', icon: Clock, emoji: '⏳' },
		{ label: 'Settings', href: '/settings', icon: Settings, emoji: '⚙️' }
	] satisfies RailLink[];

	function isActive(href: string, pathname: string): boolean {
		return pathname === href || pathname.startsWith(href + '/');
	}
</script>

<nav
	class="fixed top-0 left-0 z-50 w-full border-r-0 border-b border-border bg-surface-muted transition-[width,height] duration-200 ease-in-out md:z-[80] md:overflow-hidden md:border-r
		{collapsed ? 'md:h-screen md:w-14' : 'md:h-16 md:w-80'}"
>
	<!-- Mobile -->
	<div class="flex items-center justify-between gap-3 px-4 py-4 md:hidden">
		<div class="flex items-center gap-2">
			<button
				type="button"
				on:click={() => mobileNavOpen.open()}
				class="rounded-md p-1.5 text-text-muted hover:bg-surface-hover hover:text-text-soft"
				aria-label="Open menu"
			>
				<Menu size={20} />
			</button>
		</div>
		<div class="flex items-center justify-end gap-1">
			<AccentPicker fixedColor={fixedAccentColor} />
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
			<div class="text-xl font-bold text-text">profilarr</div>
		</div>
		<div class="flex items-center justify-end gap-1">
			<AccentPicker onboarding="accent-picker" fixedColor={fixedAccentColor} />
			<ThemeToggle onboarding="theme-toggle" />
			<HelpButton variant="navbar" />
			{#if !cutsceneActive}
				<Button
					icon={ChevronLeft}
					variant="ghost"
					size="md"
					ariaLabel="Collapse sidebar"
					on:click={() => sidebarCollapsed.collapse()}
				/>
			{/if}
		</div>
	</div>

	<!-- Desktop collapsed icon rail -->
	<div
		class="absolute inset-0 hidden flex-col items-center transition-opacity duration-150 ease-in-out md:flex
			{collapsed ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}"
	>
		<div class="mt-4">
			<Button
				icon={ChevronRight}
				variant="ghost"
				size="md"
				tooltip="Expand sidebar"
				tooltipPosition="right"
				ariaLabel="Expand sidebar"
				on:click={() => sidebarCollapsed.expand()}
			/>
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
									class="flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-text-muted transition-colors hover:bg-surface-hover hover:text-text-soft {isActive(
										item.href,
										currentPathname
									)
										? 'border-border bg-surface text-text-soft'
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
			href="/"
			aria-label="Profilarr home"
			class="rounded-md p-1 transition-colors hover:bg-surface-hover"
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
