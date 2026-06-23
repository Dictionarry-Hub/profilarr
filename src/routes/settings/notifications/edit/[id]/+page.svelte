<script lang="ts">
	import NotificationServiceForm from '../../components/NotificationServiceForm.svelte';
	import PageMeta from '$ui/meta/PageMeta.svelte';
	import type { PageData } from './$types';

	export let data: PageData;
</script>

<PageMeta title={`${data.service.name} · Edit`} />

<div class="p-4 md:p-8">
	<NotificationServiceForm
		mode="edit"
		initialData={{
			name: data.service.name,
			serviceType: data.service.serviceType,
			config: data.service.config,
			enabledTypes: data.service.enabledTypes
		}}
	/>
</div>
