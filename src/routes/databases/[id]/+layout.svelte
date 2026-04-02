<script lang="ts">
	import Tabs from '$ui/navigation/tabs/Tabs.svelte';
	import {
		GitBranch,
		History,
		GitPullRequestClosed,
		Wrench,
		Settings,
		FileCog
	} from 'lucide-svelte';
	import { page } from '$app/stores';

	$: database = $page.data.database;
	$: currentPath = $page.url.pathname;

	$: tabs = database
		? [
				{
					label: 'Changes',
					href: `/databases/${database.id}/changes`,
					icon: GitBranch,
					active: currentPath.endsWith('/changes'),
					onboarding: 'db-tab-changes'
				},
				{
					label: 'Commits',
					href: `/databases/${database.id}/commits`,
					icon: History,
					active: currentPath.includes('/commits'),
					onboarding: 'db-tab-commits'
				},
				{
					label: 'Conflicts',
					href: `/databases/${database.id}/conflicts`,
					icon: GitPullRequestClosed,
					active: currentPath.includes('/conflicts'),
					onboarding: 'db-tab-conflicts'
				},
				{
					label: 'Tweaks',
					href: `/databases/${database.id}/tweaks`,
					icon: Wrench,
					active: currentPath.includes('/tweaks'),
					onboarding: 'db-tab-tweaks'
				},
				...(database.hasPat
					? [
							{
								label: 'Config',
								href: `/databases/${database.id}/config`,
								icon: FileCog,
								active: currentPath.includes('/config')
							}
						]
					: []),
				{
					label: 'Settings',
					href: `/databases/${database.id}/settings`,
					icon: Settings,
					active: currentPath.includes('/settings'),
					onboarding: 'db-tab-settings'
				}
			]
		: [];

	$: breadcrumb = {
		items: [{ label: 'Databases', href: '/databases' }],
		current: database?.name ?? ''
	};
</script>

<div class="p-4 md:p-8">
	<Tabs {tabs} {breadcrumb} responsive />
	<slot />
</div>
