<script lang="ts">
	import Tabs from '$ui/navigation/tabs/Tabs.svelte';
	import DirtyModal from '$ui/modal/DirtyModal.svelte';
	import { page } from '$app/stores';
	import { FileText, Filter, FlaskConical } from '@lucide/svelte';
	import type { LayoutData } from './$types';

	export let data: LayoutData;

	$: databaseId = $page.params.databaseId;
	$: formatId = $page.params.id;
	$: currentPath = $page.url.pathname;

	$: tabs = [
		{
			label: 'General',
			href: `/custom-formats/${databaseId}/${formatId}/general`,
			active: currentPath.includes('/general'),
			icon: FileText
		},
		{
			label: 'Conditions',
			href: `/custom-formats/${databaseId}/${formatId}/conditions`,
			active: currentPath.includes('/conditions'),
			icon: Filter
		},
		...(data.parserAvailable
			? [
					{
						label: 'Testing',
						href: `/custom-formats/${databaseId}/${formatId}/testing`,
						active: currentPath.includes('/testing'),
						icon: FlaskConical
					}
				]
			: [])
	];

	$: breadcrumb = {
		items: [{ label: data.databaseName, href: `/custom-formats/${databaseId}` }],
		current: data.formatName
	};
</script>

<div class="px-4 pb-4 md:px-8 md:pb-8">
	<Tabs {tabs} {breadcrumb} responsive />
	<slot />
</div>

<DirtyModal />
