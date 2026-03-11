<script lang="ts">
	import InstanceForm from '../../components/InstanceForm.svelte';
	import type { ActionData, PageData } from './$types';

	export let form: ActionData;
	export let data: PageData;
</script>

<svelte:head>
	<title>{data.database.name} - Settings - Profilarr</title>
</svelte:head>

<div class="mt-6">
	<InstanceForm
		mode="edit"
		{form}
		instance={data.database}
		repoInfo={data.repoInfo}
		currentBranch={data.currentBranch}
	/>
</div>
