<script lang="ts">
	import { resolve } from '$app/paths';
	import Tabs from '$ui/navigation/tabs/Tabs.svelte';
	import { page } from '$app/stores';
	import type { LayoutData } from './$types';

	export let data: LayoutData;

	// Determine current config type from URL for proper database tab hrefs
	$: currentPath = $page.url.pathname;
	$: currentConfigType = currentPath.includes('/quality-definitions')
		? 'quality-definitions'
		: currentPath.includes('/media-settings')
			? 'media-settings'
			: 'naming';

	// Check if we're on a nested page (new/edit)
	$: isNestedPage =
		currentPath.includes('/new') ||
		currentPath.includes('/radarr/') ||
		currentPath.includes('/sonarr/');

	// Map databases to tabs - preserve current config type when switching databases
	$: databaseTabs = data.databases.map((db) => ({
		label: db.name,
		href: resolve(`/media-management/${db.id}/${currentConfigType}`),
		active: db.id === data.currentDatabase.id
	}));
</script>

<svelte:head>
	<title>Media Management - {data.currentDatabase?.name} - Profilarr</title>
</svelte:head>

<div class="space-y-6 px-4 pb-8 md:px-8 {isNestedPage ? 'pt-3 md:pt-7' : ''}">
	<!-- Database Tabs -->
	{#if !isNestedPage}
		<Tabs tabs={databaseTabs} />
	{/if}

	<!-- Page Content -->
	<slot />
</div>
