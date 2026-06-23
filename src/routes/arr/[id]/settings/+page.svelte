<script lang="ts">
	import InstanceForm from '../../components/InstanceForm.svelte';
	import PageMeta from '$ui/meta/PageMeta.svelte';
	import type { ActionData, PageData } from './$types';

	export let form: ActionData;
	export let data: PageData;
</script>

<PageMeta title={`${data.instance.name} · Settings`} />

<InstanceForm mode="edit" {form} instance={data.instance} cleanupSettings={data.cleanupSettings} />
