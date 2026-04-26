<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { page } from '$app/stores';
	import AnnouncementForm from '../components/AnnouncementForm.svelte';

	export let data: PageData;
	export let form: ActionData;

	$: databaseId = parseInt($page.params.id ?? '0', 10);

	const initial = {
		title: '',
		severity: 'info' as const,
		publishedAt: new Date().toISOString(),
		expiresAt: null,
		link: '',
		body: ''
	};

	// Reference data so the unused-prop lint doesn't fire (load currently
	// returns nothing client-relevant).
	$: void data;
</script>

<AnnouncementForm mode="create" {databaseId} {initial} {form} />
