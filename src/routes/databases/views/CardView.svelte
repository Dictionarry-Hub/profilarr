<script lang="ts">
	import { ExternalLink, Unlink, Lock, Code } from 'lucide-svelte';
	import Button from '$ui/button/Button.svelte';
	import Card from '$ui/card/Card.svelte';
	import CardGrid from '$ui/card/CardGrid.svelte';
	import Label from '$ui/label/Label.svelte';
	import type { DatabaseInstancePublic } from '$db/queries/databaseInstances.ts';
	import { parseUTC } from '$shared/utils/dates';
	import { createEventDispatcher } from 'svelte';
	import DatabaseAvatar from '../components/DatabaseAvatar.svelte';

	export let databases: DatabaseInstancePublic[];

	const dispatch = createEventDispatcher<{
		unlink: DatabaseInstancePublic;
	}>();

	// Avatar handled by DatabaseAvatar component

	// Format sync strategy for display
	function formatSyncStrategy(minutes: number): string {
		if (minutes === 0) return 'Manual';
		if (minutes < 60) return `Every ${minutes} min`;
		if (minutes === 60) return 'Hourly';
		if (minutes < 1440) return `Every ${minutes / 60}h`;
		return `Every ${minutes / 1440}d`;
	}

	// Format last synced date
	function formatLastSynced(date: string | null): string {
		const d = parseUTC(date);
		if (!d) return 'Never';
		return d.toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	// Handle unlink click
	function handleUnlinkClick(e: MouseEvent, database: DatabaseInstancePublic) {
		e.stopPropagation();
		e.preventDefault();
		dispatch('unlink', database);
	}

	function handleExternalClick(e: MouseEvent, url: string) {
		e.stopPropagation();
		e.preventDefault();
		window.open(url, '_blank');
	}
</script>

<CardGrid columns={1} flush>
	{#each databases as database}
		<Card href="/databases/{database.id}" hoverable>
			<div class="flex items-center gap-3">
				<!-- Top row: Avatar, Name, Action buttons -->
				<DatabaseAvatar name={database.name} repoUrl={database.repository_url} size="md" />
				<div class="min-w-0 flex-1">
					<div class="flex items-center gap-2">
						<span class="truncate font-medium text-neutral-900 dark:text-neutral-100">
							{database.name}
						</span>
						{#if database.is_private}
							<Label variant="secondary" size="sm" rounded="md" mono>
								<Lock size={12} />
								Private
							</Label>
						{/if}
						{#if database.hasPat}
							<Label variant="info" size="sm" rounded="md" mono>
								<Code size={12} />
								Dev
							</Label>
						{/if}
					</div>
					<div class="mt-3 flex flex-wrap items-center gap-2">
						<Label variant="secondary" size="sm" rounded="md" mono>
							{database.repository_url.replace('https://github.com/', '')}
						</Label>
						<Label variant="secondary" size="sm" rounded="md" mono>
							{formatSyncStrategy(database.sync_strategy)}
						</Label>
						<Label variant="secondary" size="sm" rounded="md" mono>
							{formatLastSynced(database.last_synced_at)}
						</Label>
					</div>
				</div>

				<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
				<div class="flex flex-shrink-0 items-center gap-1" on:click|stopPropagation|preventDefault>
					<Button
						icon={ExternalLink}
						size="xs"
						variant="secondary"
						title="View on GitHub"
						ariaLabel="View on GitHub"
						on:click={(e) => handleExternalClick(e, database.repository_url)}
					/>
					<Button
						icon={Unlink}
						size="xs"
						variant="secondary"
						iconColor="text-red-600 dark:text-red-400"
						title="Unlink database"
						ariaLabel="Unlink database"
						on:click={(e) => handleUnlinkClick(e, database)}
					/>
				</div>
			</div>
		</Card>
	{/each}
</CardGrid>
