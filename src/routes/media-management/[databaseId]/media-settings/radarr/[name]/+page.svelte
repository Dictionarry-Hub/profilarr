<script lang="ts">
	import MediaSettingsForm from '../../components/MediaSettingsForm.svelte';
	import DirtyModal from '$ui/modal/DirtyModal.svelte';
	import type { PageData } from './$types';

	export let data: PageData;
</script>

<MediaSettingsForm
	mode="edit"
	arrType="radarr"
	databaseName={data.currentDatabase?.name}
	canWriteToBase={data.canWriteToBase}
	actionUrl="?/update"
	initialData={data.mediaSettingsConfig}
	breadcrumbItems={[
		{
			label: data.currentDatabase.name,
			href: `/media-management/${data.currentDatabase.id}/media-settings`
		}
	]}
	breadcrumbCurrent={data.mediaSettingsConfig.name}
/>

<DirtyModal />
