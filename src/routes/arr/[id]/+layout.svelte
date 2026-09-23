<script lang="ts">
	import { resolve } from '$app/paths';
	import Tabs from '$ui/navigation/tabs/Tabs.svelte';
	import { page } from '$app/stores';
	import {
		Library,
		RefreshCw,
		ArrowLeftRight,
		ArrowUpCircle,
		FileEdit,
		ScrollText,
		Settings
	} from '@lucide/svelte';
	import type { LayoutData } from './$types';

	export let data: LayoutData;

	$: instanceId = $page.params.id;
	$: currentPath = $page.url.pathname;

	$: libraryTab = {
		label: 'Library',
		href: resolve(`/arr/${instanceId}/library`),
		active: currentPath.includes('/library'),
		icon: Library,
		onboarding: 'arr-tab-library'
	};

	$: syncTab = {
		label: 'Sync',
		href: resolve(`/arr/${instanceId}/sync`),
		active: currentPath.includes('/sync'),
		icon: RefreshCw,
		onboarding: 'arr-tab-sync'
	};

	$: driftTab = {
		label: 'Drift',
		href: resolve(`/arr/${instanceId}/drift`),
		active: currentPath.includes('/drift'),
		icon: ArrowLeftRight,
		onboarding: 'arr-tab-drift',
		badge: data.driftCount
	};

	$: otherTabs = [
		driftTab,
		{
			label: 'Upgrades',
			href: resolve(`/arr/${instanceId}/upgrades`),
			active: currentPath.includes('/upgrades'),
			icon: ArrowUpCircle,
			onboarding: 'arr-tab-upgrades'
		},
		{
			label: 'Renames',
			href: resolve(`/arr/${instanceId}/rename`),
			active: currentPath.includes('/rename'),
			icon: FileEdit,
			onboarding: 'arr-tab-renames'
		},
		{
			label: 'Logs',
			href: resolve(`/arr/${instanceId}/logs`),
			active: currentPath.includes('/logs'),
			icon: ScrollText,
			onboarding: 'arr-tab-logs'
		},
		{
			label: 'Settings',
			href: resolve(`/arr/${instanceId}/settings`),
			active: currentPath.includes('/settings'),
			icon: Settings,
			onboarding: 'arr-tab-settings'
		}
	];

	$: tabs = data.hasSyncConfig
		? [libraryTab, syncTab, ...otherTabs]
		: [syncTab, libraryTab, ...otherTabs];

	$: breadcrumb = {
		items: [{ label: 'Arr Instances', href: resolve('/arr') }],
		current: data.instance.name
	};
</script>

<div class="overflow-x-clip px-4 pb-4 md:px-8 md:pb-8">
	<Tabs {tabs} {breadcrumb} responsive mobileBreakpoint={1400} />
	{#key data.instance.id}
		<slot />
	{/key}
</div>
