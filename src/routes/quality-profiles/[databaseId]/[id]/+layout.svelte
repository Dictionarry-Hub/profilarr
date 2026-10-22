<script lang="ts">
	import Tabs from '$ui/navigation/tabs/Tabs.svelte';
	import DirtyModal from '$ui/modal/DirtyModal.svelte';
	import { page } from '$stores/page';
	import FileText from '@lucide/svelte/icons/file-text';
	import Scale from '@lucide/svelte/icons/scale';
	import Layers from '@lucide/svelte/icons/layers';
	import type { LayoutData } from './$types';

	export let data: LayoutData;

	$: databaseId = $page.params.databaseId;
	$: profileId = $page.params.id;
	$: currentPath = $page.url.pathname;

	$: tabs = [
		{
			label: 'General',
			href: `/quality-profiles/${databaseId}/${profileId}/general`,
			active: currentPath.includes('/general'),
			icon: FileText
		},
		{
			label: 'Scoring',
			href: `/quality-profiles/${databaseId}/${profileId}/scoring`,
			active: currentPath.includes('/scoring'),
			icon: Scale
		},
		{
			label: 'Qualities',
			href: `/quality-profiles/${databaseId}/${profileId}/qualities`,
			active: currentPath.includes('/qualities'),
			icon: Layers
		}
	];

	$: breadcrumb = {
		items: [{ label: data.databaseName, href: `/quality-profiles/${databaseId}` }],
		current: data.profileName
	};
</script>

<div class="px-4 pb-4 md:px-8 md:pb-8">
	<Tabs {tabs} {breadcrumb} responsive />
	<slot></slot>
</div>

<DirtyModal />
