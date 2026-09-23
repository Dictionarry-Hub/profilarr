<script lang="ts">
	import { resolve } from '$app/paths';
	import QualityDefinitionsForm from '../../components/QualityDefinitionsForm.svelte';
	import DirtyModal from '$ui/modal/DirtyModal.svelte';
	import PageMeta from '$ui/meta/PageMeta.svelte';
	import type { PageData } from './$types';

	export let data: PageData;
</script>

<PageMeta title={`${data.qualityDefinitionsConfig.name} · Sonarr Quality Definition`} />

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
			href: resolve(`/media-management/${data.currentDatabase.id}/quality-definitions`)
		}
	]}
	breadcrumbCurrent={data.qualityDefinitionsConfig.name}
/>

<DirtyModal />
