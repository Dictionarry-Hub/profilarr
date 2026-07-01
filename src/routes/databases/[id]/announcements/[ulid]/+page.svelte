<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { page } from '$app/stores';
	import { AlertTriangle } from 'lucide-svelte';
	import Card from '$ui/card/Card.svelte';
	import AnnouncementForm from '../components/AnnouncementForm.svelte';

	export let data: PageData;
	export let form: ActionData;

	$: databaseId = parseInt($page.params.id ?? '0', 10);
</script>

<div class="space-y-4">
	{#if data.parseError}
		<Card padding="md">
			<div class="flex items-start gap-3">
				<AlertTriangle class="h-5 w-5 flex-shrink-0 text-warning-icon " />
				<div class="text-sm">
					<div class="font-medium text-text">The announcement file is malformed</div>
					<p class="mt-1 text-xs text-text-soft">
						{data.parseError}
					</p>
					<p class="mt-2 text-xs text-text-muted">
						Saving here will overwrite the broken file with the values below.
					</p>
				</div>
			</div>
		</Card>
	{/if}

	<AnnouncementForm mode="edit" {databaseId} initial={data.announcement} {form} />
</div>
