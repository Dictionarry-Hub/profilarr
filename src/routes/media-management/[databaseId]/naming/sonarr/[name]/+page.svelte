<script lang="ts">
	import SonarrNamingForm from '../../components/SonarrNamingForm.svelte';
	import DirtyModal from '$ui/modal/DirtyModal.svelte';
	import PageMeta from '$ui/meta/PageMeta.svelte';
	import type { PageData } from './$types';

	export let data: PageData;
</script>

<PageMeta title={`${data.namingConfig.name} · Sonarr Naming`} />

<SonarrNamingForm
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
