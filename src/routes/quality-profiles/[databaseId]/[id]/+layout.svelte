<script lang="ts">
	import Tabs from '$ui/navigation/tabs/Tabs.svelte';
	import DirtyModal from '$ui/modal/DirtyModal.svelte';
	import { page } from '$app/stores';
	import FileText from '@lucide/svelte/icons/file-text';
	import Scale from '@lucide/svelte/icons/scale';
	import Layers from '@lucide/svelte/icons/layers';
	import History from '@lucide/svelte/icons/history';
	import type { LayoutData } from './$types';

	export let data: LayoutData;

	$: databaseId = $page.params.databaseId;
	$: profileId = $page.params.id;
	$: currentPath = $page.url.pathname;
	$: onChanges = currentPath.includes('/changes');
	$: changeCount = data.localChanges.rows.length + data.localChanges.relatedChanges.length;

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
		},
		// Only after a local change; also while on it, so it doesn't vanish underfoot.
		...(changeCount > 0 || data.localChanges.snapshot === 'unavailable' || onChanges
			? [
					{
						label: 'Changes',
						href: `/quality-profiles/${databaseId}/${profileId}/changes`,
						active: onChanges,
						icon: History,
						badge: changeCount
					}
				]
			: [])
	];

	$: breadcrumb = {
		items: [{ label: data.databaseName, href: `/quality-profiles/${databaseId}` }],
		current: data.profileName
	};
</script>

<div class="px-4 pb-4 md:px-8 md:pb-8">
	<Tabs {tabs} {breadcrumb} responsive />
	<slot />
</div>

<DirtyModal />
