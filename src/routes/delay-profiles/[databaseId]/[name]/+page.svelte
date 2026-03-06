<script lang="ts">
	import { goto } from '$app/navigation';
	import DelayProfileForm from '../components/DelayProfileForm.svelte';
	import DirtyModal from '$ui/modal/DirtyModal.svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	// Build initial data from server
	$: initialData = {
		name: data.delayProfile.name,
		preferredProtocol: data.delayProfile.preferred_protocol,
		usenetDelay: data.delayProfile.usenet_delay ?? 0,
		torrentDelay: data.delayProfile.torrent_delay ?? 0,
		bypassIfHighestQuality: data.delayProfile.bypass_if_highest_quality,
		bypassIfAboveCfScore: data.delayProfile.bypass_if_above_custom_format_score,
		minimumCfScore: data.delayProfile.minimum_custom_format_score ?? 0
	};

	function handleCancel() {
		goto(`/delay-profiles/${data.currentDatabase.id}`);
	}
</script>

<svelte:head>
	<title>{data.delayProfile.name} - Delay Profiles - Profilarr</title>
</svelte:head>

<div class="p-4 md:p-8">
	<DelayProfileForm
		mode="edit"
		databaseName={data.currentDatabase?.name}
		canWriteToBase={data.canWriteToBase}
		actionUrl="?/update"
		{initialData}
		onCancel={handleCancel}
		breadcrumbItems={[
			{ label: data.currentDatabase.name, href: `/delay-profiles/${data.currentDatabase.id}` }
		]}
		breadcrumbCurrent={data.delayProfile.name}
	/>
</div>

<DirtyModal />
