<script lang="ts">
	import RadarrNamingForm from '../../components/RadarrNamingForm.svelte';
	import DirtyModal from '$ui/modal/DirtyModal.svelte';
	import type { PageData } from './$types';

	export let data: PageData;
</script>

<RadarrNamingForm
	mode="edit"
	databaseName={data.currentDatabase?.name}
	canWriteToBase={data.canWriteToBase}
	actionUrl="?/update"
	initialData={data.namingConfig}
	breadcrumbItems={[
		{
			label: data.currentDatabase.name,
			href: `/media-management/${data.currentDatabase.id}/naming`
		}
	]}
	breadcrumbCurrent={data.namingConfig.name}
/>

<DirtyModal />
