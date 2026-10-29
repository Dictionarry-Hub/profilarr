<script lang="ts">
	import '#client/styles/app.css';
	import '#stores/font.ts';
	import logo from '#client/assets/logo-512.png';
	import Navbar from '#ui/navigation/navbar/navbar.svelte';
	import PageNav from '#ui/navigation/pageNav/pageNav.svelte';
	import BottomNav from '#ui/navigation/bottomNav/BottomNav.svelte';
	import AlertContainer from '#client/alerts/AlertContainer.svelte';
	import HelpButton from '#ui/help/HelpButton.svelte';
	import CutsceneOverlay from '#client/cutscene/CutsceneOverlay.svelte';

	import CutsceneComplete from '#client/cutscene/CutsceneComplete.svelte';
	import { cutscene } from '#client/cutscene/store.ts';
	import { sidebarCollapsed } from '#stores/sidebar.ts';
	import { dateFormat } from '#stores/dateFormat.ts';
	import { serverTimezone } from '#stores/timezone.ts';
	import { FEATURES } from '#shared/features.ts';
	import { dev } from '$app/env';
	import { page } from '#stores/page.ts';
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { alertStore } from '#client/alerts/store.ts';
	import AlertTriangle from '@lucide/svelte/icons/triangle-alert';
	import X from '@lucide/svelte/icons/x';
	import Button from '#ui/button/Button.svelte';

	export let data;

	// Set timezone from server data (available immediately, no async fetch)
	$: serverTimezone.set(data.timezone);
	$: dateFormat.set(data.dateFormat);

	// Hide navigation on auth pages (login, setup, etc.)
	$: isAuthPage = $page.url.pathname.startsWith('/auth/');

	$: cutsceneEnabled = FEATURES.cutscene || dev;

	let innerWidth = 0;
	$: isDesktop = innerWidth >= 768;

	function handleKeydown(e: KeyboardEvent) {
		if (!isDesktop || isAuthPage || $cutscene.active) return;
		const tag = (e.target as HTMLElement)?.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
		if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
			e.preventDefault();
			sidebarCollapsed.toggle();
		}
	}

	onMount(() => {
		document.documentElement.dataset.hydrated = 'true';
		if (!isAuthPage && cutsceneEnabled) cutscene.init();
	});
</script>

<svelte:window bind:innerWidth on:keydown={handleKeydown} />

<svelte:head>
	<link rel="icon" href={logo} />
	<title>Profilarr</title>
</svelte:head>

{#if !isAuthPage}
	<Navbar unreadAnnouncements={data.unreadAnnouncements} />
	<PageNav
		arrInstances={data.arrInstances}
		databases={data.databases}
		parserAvailable={data.parserAvailable}
		unreadAnnouncements={data.unreadAnnouncements}
		showLogout={data.showLogout}
	/>
	<BottomNav />
	<HelpButton />
	{#if cutsceneEnabled && isDesktop}
		<CutsceneOverlay />
		<CutsceneComplete />
	{/if}
{/if}
<AlertContainer />

<main
	class="{isAuthPage
		? ''
		: `pt-16 pb-16 md:pt-0 md:pb-0 ${$sidebarCollapsed ? 'md:pl-14' : 'md:pl-80'}`} transition-[padding-left] duration-200 ease-in-out"
>
	{#if data.restorePending && !isAuthPage}
		<div
			class="flex h-16 items-center gap-3 border-b border-neutral-200 bg-neutral-50 px-4 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
			role="status"
		>
			<AlertTriangle class="h-5 w-5 shrink-0 text-amber-500 dark:text-amber-400" />
			<div class="min-w-0 flex-1 truncate">
				<strong class="font-semibold">Restore pending:</strong>
				<span class="font-mono">{data.restorePending.filename}</span>
				<span class="hidden md:inline">
					will be applied on the next restart. Any changes you make now will be lost.
				</span>
			</div>
			<form
				class="shrink-0"
				method="POST"
				action="/settings/backups?/cancelRestore"
				use:enhance={() => {
					return async ({ result, update }) => {
						if (result.type === 'success') {
							alertStore.add('success', 'Pending restore cancelled');
						} else if (result.type === 'failure' && result.data) {
							alertStore.add(
								'error',
								(result.data as { error?: string }).error || 'Failed to cancel'
							);
						}
						// Stay on the current page instead of navigating to the action's page
						await update({ navigate: false });
					};
				}}
			>
				<Button
					type="submit"
					size="sm"
					text="Cancel restore"
					icon={X}
					iconColor="text-red-600 dark:text-red-400"
					hideTextOnMobile
				/>
			</form>
		</div>
	{/if}
	<slot></slot>
</main>
