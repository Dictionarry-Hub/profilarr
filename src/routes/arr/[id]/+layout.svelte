<script lang="ts">
	import Tabs from '$ui/navigation/tabs/Tabs.svelte';
	import { page } from '$app/stores';
	import { Library, RefreshCw, ArrowUpCircle, FileEdit, ScrollText, Settings } from 'lucide-svelte';
	import type { LayoutData } from './$types';

	export let data: LayoutData;

	$: instanceId = $page.params.id;
	$: currentPath = $page.url.pathname;

	$: libraryTab = {
		label: 'Library',
		href: `/arr/${instanceId}/library`,
		active: currentPath.includes('/library'),
		icon: Library,
		onboarding: 'arr-tab-library'
	};

	$: syncTab = {
		label: 'Sync',
		href: `/arr/${instanceId}/sync`,
		active: currentPath.includes('/sync'),
		icon: RefreshCw,
		onboarding: 'arr-tab-sync'
	};

	$: otherTabs = [
		{
			label: 'Upgrades',
			href: `/arr/${instanceId}/upgrades`,
			active: currentPath.includes('/upgrades'),
			icon: ArrowUpCircle,
			onboarding: 'arr-tab-upgrades'
		},
		{
			label: 'Renames',
			href: `/arr/${instanceId}/rename`,
			active: currentPath.includes('/rename'),
			icon: FileEdit,
			onboarding: 'arr-tab-renames'
		},
		{
			label: 'Logs',
			href: `/arr/${instanceId}/logs`,
			active: currentPath.includes('/logs'),
			icon: ScrollText,
			onboarding: 'arr-tab-logs'
		},
		{
			label: 'Settings',
			href: `/arr/${instanceId}/settings`,
			active: currentPath.includes('/settings'),
			icon: Settings,
			onboarding: 'arr-tab-settings'
		}
	];

	$: tabs = data.hasSyncConfig
		? [libraryTab, syncTab, ...otherTabs]
		: [syncTab, libraryTab, ...otherTabs];

	$: breadcrumb = {
		items: [{ label: 'Arr Instances', href: '/arr' }],
		current: data.instance.name
	};
</script>

<div class="overflow-x-hidden p-4 md:p-8">
	<Tabs {tabs} {breadcrumb} responsive />
	{#key data.instance.id}
		<slot />
	{/key}
</div>
