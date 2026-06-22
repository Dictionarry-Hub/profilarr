<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { page } from '$app/stores';
	import { AlertTriangle } from '@lucide/svelte';
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
				<AlertTriangle class="h-5 w-5 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
				<div class="text-sm">
					<div class="font-medium text-neutral-900 dark:text-neutral-100">
						The announcement file is malformed
					</div>
					<p class="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
						{data.parseError}
					</p>
					<p class="mt-2 text-xs text-neutral-500 dark:text-neutral-500">
						Saving here will overwrite the broken file with the values below.
					</p>
				</div>
			</div>
		</Card>
	{/if}

	<AnnouncementForm mode="edit" {databaseId} initial={data.announcement} {form} />
</div>
