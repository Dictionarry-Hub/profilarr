<script lang="ts">
	import Tabs from '#ui/navigation/tabs/Tabs.svelte';
	import { page } from '#stores/page.ts';
	import Library from '@lucide/svelte/icons/library';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right';
	import ArrowUpCircle from '@lucide/svelte/icons/circle-arrow-up';
	import FileEdit from '@lucide/svelte/icons/file-pen';
	import ScrollText from '@lucide/svelte/icons/scroll-text';
	import Settings from '@lucide/svelte/icons/settings';
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

	$: driftTab = {
		label: 'Drift',
		href: `/arr/${instanceId}/drift`,
		active: currentPath.includes('/drift'),
		icon: ArrowLeftRight,
		onboarding: 'arr-tab-drift',
		badge: data.driftCount
	};

	$: otherTabs = [
		driftTab,
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

<div class="overflow-x-clip px-4 pb-4 md:px-8 md:pb-8">
	<Tabs {tabs} {breadcrumb} responsive mobileBreakpoint={1400} />

	{#key data.instance.id}
		<slot></slot>
	{/key}
</div>
