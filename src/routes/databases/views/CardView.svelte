<script lang="ts">
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Unlink from '@lucide/svelte/icons/unlink';
	import Lock from '@lucide/svelte/icons/lock';
	import Code from '@lucide/svelte/icons/code';
	import type { Component } from 'svelte';
	import Button from '#ui/button/Button.svelte';
	import Tooltip from '#ui/tooltip/Tooltip.svelte';
	import Card from '#ui/card/Card.svelte';
	import CardGrid from '#ui/card/CardGrid.svelte';
	import type { DatabaseInstanceSummary } from '#routes/databases/+page.server.ts';
	import { formatRelative } from '#shared/utils/dates.ts';
	import { createEventDispatcher } from 'svelte';
	import DatabaseAvatar from '#routes/databases/components/DatabaseAvatar.svelte';
	import { DATABASE_CARD_ROWS, type DatabaseRowKey } from './cardRows.ts';

	export let databases: DatabaseInstanceSummary[];
	/** Row keys to show, from the card rows picker. */
	export let visibleRows: readonly string[];

	const dispatch = createEventDispatcher<{
		unlink: DatabaseInstanceSummary;
	}>();

	interface InfoRow {
		key: string;
		label: string;
		icon: Component;
		value: string;
		muted?: boolean;
		/** Trailing text after a dot separator, e.g. the time since the last sync. */
		detail?: string;
		detailMuted?: boolean;
	}

	function formatSyncStrategy(minutes: number): string {
		if (minutes === 0) return 'Manual';
		if (minutes < 60) return `Every ${minutes} min`;
		if (minutes === 60) return 'Hourly';
		if (minutes < 1440) return `Every ${minutes / 60}h`;
		return `Every ${minutes / 1440}d`;
	}

	/** owner/repo for display; the official organisation shows as "profilarr". */
	function formatRepository(url: string): string {
		const slug = url.replace('https://github.com/', '');
		const [owner, ...rest] = slug.split('/');
		if (owner.toLowerCase() === 'dictionarry-hub') return ['profilarr', ...rest].join('/');
		return slug;
	}

	type RowValue = Pick<InfoRow, 'value' | 'muted' | 'detail' | 'detailMuted'>;

	function rowValue(key: DatabaseRowKey, database: DatabaseInstanceSummary): RowValue {
		switch (key) {
			case 'sync':
				return {
					value: formatSyncStrategy(database.sync_strategy),
					detail: database.last_synced_at ? formatRelative(database.last_synced_at) : 'Never',
					detailMuted: !database.last_synced_at
				};
			case 'autoPull':
				return { value: database.auto_pull ? 'On' : 'Off', muted: !database.auto_pull };
			case 'qualityProfiles':
				return { value: String(database.qualityProfileCount) };
			case 'customFormats':
				return { value: String(database.customFormatCount) };
			case 'delayProfiles':
				return { value: String(database.delayProfileCount) };
		}
	}

	function getRows(database: DatabaseInstanceSummary, visible: readonly string[]): InfoRow[] {
		return DATABASE_CARD_ROWS.filter((row) => visible.includes(row.key)).map((row) => ({
			key: row.key,
			label: row.label,
			icon: row.icon,
			...rowValue(row.key, database)
		}));
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

<CardGrid columns={1} className="md:grid-cols-2 xl:grid-cols-4" flush>
	{#each databases as database}
		<Card href="/databases/{database.id}" hoverable>
			<svelte:fragment slot="header">
				<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
				<div class="flex items-center justify-between gap-2">
					<div class="flex min-w-0 items-center gap-2.5">
						<DatabaseAvatar name={database.name} repoUrl={database.repository_url} size="sm" />
						<div class="min-w-0">
							<h3 class="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
								{database.name}
							</h3>
							<p class="truncate text-xs text-neutral-500 dark:text-neutral-400">
								{formatRepository(database.repository_url)}
							</p>
						</div>
					</div>
					<div class="flex shrink-0 items-center gap-0.5" on:click|stopPropagation|preventDefault>
						{#if database.is_private}
							<Tooltip text="Private repository">
								<span
									role="img"
									aria-label="Private repository"
									class="flex p-1.5 text-neutral-500 dark:text-neutral-400"
								>
									<Lock size={12} />
								</span>
							</Tooltip>
						{/if}
						{#if database.hasPat}
							<Tooltip text="Dev mode">
								<span
									role="img"
									aria-label="Dev mode"
									class="flex p-1.5 text-blue-600 dark:text-blue-400"
								>
									<Code size={12} />
								</span>
							</Tooltip>
						{/if}
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

			<div class="space-y-1">
				{#each getRows(database, visibleRows) as row (row.key)}
					<div class="flex items-center justify-between gap-3 text-xs">
						<span class="flex shrink-0 items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
							<svelte:component this={row.icon} size={11} />{row.label}
						</span>
						<span
							class="min-w-0 truncate text-right font-mono {row.muted
								? 'text-neutral-400 dark:text-neutral-500'
								: 'text-neutral-900 dark:text-neutral-100'}"
						>
							{row.value}
							{#if row.detail}
								<span class="text-neutral-400 dark:text-neutral-500">·</span>
								<span class={row.detailMuted ? 'text-neutral-400 dark:text-neutral-500' : ''}>
									{row.detail}
								</span>
							{/if}
						</span>
					</div>
				{/each}
			</div>
		</Card>
	{/each}
</CardGrid>
