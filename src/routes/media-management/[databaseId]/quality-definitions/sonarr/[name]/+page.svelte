<script lang="ts">
	import QualityDefinitionsForm from '../../components/QualityDefinitionsForm.svelte';
	import DirtyModal from '$ui/modal/DirtyModal.svelte';
	import type { PageData } from './$types';

	export let data: PageData;
</script>

<QualityDefinitionsForm
	mode="edit"
	arrType="sonarr"
	databaseName={data.currentDatabase?.name}
	canWriteToBase={data.canWriteToBase}
	actionUrl="?/update"
	availableQualities={data.availableQualities}
	initialData={data.qualityDefinitionsConfig}
	breadcrumbItems={[
		{
			label: data.currentDatabase.name,
			href: `/media-management/${data.currentDatabase.id}/quality-definitions`
		}
	]}
	breadcrumbCurrent={data.qualityDefinitionsConfig.name}
/>

<DirtyModal />
