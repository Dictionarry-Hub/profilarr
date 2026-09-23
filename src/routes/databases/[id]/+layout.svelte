<script lang="ts">
	import { resolve } from '$app/paths';
	import Tabs from '$ui/navigation/tabs/Tabs.svelte';
	import {
		GitBranch,
		History,
		GitPullRequestClosed,
		Wrench,
		Settings,
		FileCog,
		Megaphone
	} from '@lucide/svelte';
	import { page } from '$app/stores';
	import { FEATURES } from '$lib/shared/features';

	$: database = $page.data.database;
	$: currentPath = $page.url.pathname;

	$: tabs = database
		? [
				{
					label: 'Changes',
					href: resolve(`/databases/${database.id}/changes`),
					icon: GitBranch,
					active: currentPath.endsWith('/changes'),
					onboarding: 'db-tab-changes'
				},
				{
					label: 'Updates',
					href: resolve(`/databases/${database.id}/commits`),
					icon: History,
					active: currentPath.includes('/commits'),
					onboarding: 'db-tab-commits'
				},
				{
					label: 'Conflicts',
					href: resolve(`/databases/${database.id}/conflicts`),
					icon: GitPullRequestClosed,
					active: currentPath.includes('/conflicts'),
					onboarding: 'db-tab-conflicts'
				},
				...(FEATURES.tweaks
					? [
							{
								label: 'Tweaks',
								href: resolve(`/databases/${database.id}/tweaks`),
								icon: Wrench,
								active: currentPath.includes('/tweaks'),
								onboarding: 'db-tab-tweaks'
							}
						]
					: []),
				...(database.hasPat
					? [
							{
								label: 'Announcements',
								href: resolve(`/databases/${database.id}/announcements`),
								icon: Megaphone,
								active: currentPath.includes('/announcements')
							},
							{
								label: 'Config',
								href: resolve(`/databases/${database.id}/config`),
								icon: FileCog,
								active: currentPath.includes('/config')
							}
						]
					: []),
				{
					label: 'Settings',
					href: resolve(`/databases/${database.id}/settings`),
					icon: Settings,
					active: currentPath.includes('/settings'),
					onboarding: 'db-tab-settings'
				}
			]
		: [];

	$: breadcrumb = {
		items: [{ label: 'Databases', href: resolve('/databases') }],
		current: database?.name ?? ''
	};
</script>

<div class="px-4 pb-4 md:px-8 md:pb-8">
	<Tabs {tabs} {breadcrumb} responsive mobileBreakpoint={1400} />
	<slot />
</div>
