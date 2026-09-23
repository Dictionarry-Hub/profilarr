<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		ExternalLink,
		Unlink,
		Lock,
		Code,
		RefreshCw,
		Clock,
		GitPullRequest
	} from '@lucide/svelte';
	import Button from '$ui/button/Button.svelte';
	import Card from '$ui/card/Card.svelte';
	import CardGrid from '$ui/card/CardGrid.svelte';
	import Label from '$ui/label/Label.svelte';
	import type { DatabaseInstanceSummary } from '../+page.server.ts';
	import { formatDateTime } from '$shared/utils/dates';
	import { dateFormat } from '$lib/client/stores/dateFormat';
	import { serverTimezone } from '$lib/client/stores/timezone';
	import { createEventDispatcher } from 'svelte';
	import DatabaseAvatar from '../components/DatabaseAvatar.svelte';

	export let databases: DatabaseInstanceSummary[];

	const dispatch = createEventDispatcher<{
		unlink: DatabaseInstanceSummary;
	}>();

	function formatSyncStrategy(minutes: number): string {
		if (minutes === 0) return 'Manual';
		if (minutes < 60) return `Every ${minutes} min`;
		if (minutes === 60) return 'Hourly';
		if (minutes < 1440) return `Every ${minutes / 60}h`;
		return `Every ${minutes / 1440}d`;
	}

	function formatLastSynced(date: string | null): string {
		if (!date) return 'Never';
		return formatDateTime(date, $serverTimezone, $dateFormat, {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function handleUnlinkClick(e: MouseEvent, database: DatabaseInstanceSummary) {
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

<CardGrid columns={1} className="xl:grid-cols-2 2xl:grid-cols-3" flush>
	{#each databases as database}
		<Card href={resolve(`/databases/${database.id}`)} hoverable>
			<svelte:fragment slot="header">
				<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
				<div class="flex items-center justify-between gap-2">
					<div class="flex min-w-0 items-center gap-2">
						<DatabaseAvatar name={database.name} repoUrl={database.repository_url} size="sm" />
						<h3 class="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
							{database.name}
						</h3>
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
					<div class="flex shrink-0 items-center gap-0.5" on:click|stopPropagation|preventDefault>
						<Button
							icon={ExternalLink}
							size="xs"
							variant="ghost"
							tooltip="View on GitHub"
							on:click={(e) => handleExternalClick(e, database.repository_url)}
						/>
						<Button
							icon={Unlink}
							size="xs"
							variant="ghost"
							iconColor="text-red-600 dark:text-red-400"
							tooltip="Unlink database"
							on:click={(e) => handleUnlinkClick(e, database)}
						/>
					</div>
				</div>
			</svelte:fragment>

			<div class="flex flex-wrap gap-1">
				<Label variant="secondary" size="sm" rounded="md" mono>
					{database.repository_url.replace('https://github.com/', '')}
				</Label>
				<Label variant="secondary" size="sm" rounded="md"
					>{database.qualityProfileCount} Quality Profiles</Label
				>
				<Label variant="secondary" size="sm" rounded="md"
					>{database.customFormatCount} Custom Formats</Label
				>
				<Label variant="secondary" size="sm" rounded="md"
					>{database.delayProfileCount} Delay Profiles</Label
				>
			</div>

			<svelte:fragment slot="footer">
				<div
					class="flex flex-col items-start gap-1.5 text-xs text-neutral-600 sm:flex-row sm:items-center sm:gap-3 dark:text-neutral-400"
				>
					<div class="flex items-center gap-1">
						<RefreshCw size={12} class="text-blue-500 dark:text-blue-400" />
						<span>Sync Strategy: {formatSyncStrategy(database.sync_strategy)}</span>
					</div>
					<span class="hidden text-neutral-300 sm:inline dark:text-neutral-600">&middot;</span>
					<div class="flex items-center gap-1">
						<Clock size={12} class="text-amber-500 dark:text-amber-400" />
						<span>Last Synced: {formatLastSynced(database.last_synced_at)}</span>
					</div>
					<span class="hidden text-neutral-300 sm:inline dark:text-neutral-600">&middot;</span>
					<div class="flex items-center gap-1">
						<GitPullRequest size={12} class="text-violet-500 dark:text-violet-400" />
						<span>Auto Pull: {database.auto_pull ? 'On' : 'Off'}</span>
					</div>
				</div>
			</svelte:fragment>
		</Card>
	{/each}
</CardGrid>
