<script lang="ts">
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
		href: `/media-management/${db.id}/${currentConfigType}`,
		active: db.id === data.currentDatabase.id
	}));
</script>

<svelte:head>
	<title>Media Management - {data.currentDatabase?.name} - Profilarr</title>
</svelte:head>

<div class="space-y-6 px-4 pt-4 pb-8 md:px-8">
	<!-- Database Tabs -->
	{#if !isNestedPage}
		<Tabs tabs={databaseTabs} />
	{/if}

	<!-- Page Content -->
	<slot />
</div>
