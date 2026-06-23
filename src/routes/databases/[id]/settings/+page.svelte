<script lang="ts">
	import InstanceForm from '../../components/InstanceForm.svelte';
	import PageMeta from '$ui/meta/PageMeta.svelte';
	import type { ActionData, PageData } from './$types';

	export let form: ActionData;
	export let data: PageData;
</script>

<PageMeta title={`${data.database.name} · Settings`} />

<div>
	<InstanceForm
		mode="edit"
		{form}
		instance={data.database}
		repoInfo={data.repoInfo}
		currentBranch={data.currentBranch}
	/>
</div>
