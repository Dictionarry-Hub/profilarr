<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Table from '$ui/table/Table.svelte';
	import Button from '$ui/button/Button.svelte';
	import type { Column } from '$ui/table/types';
	import type { DelayProfilesRow } from '$shared/pcd/display.ts';
	import { Tag, Clock, Zap, Shield, Copy, Download } from 'lucide-svelte';
	import { escapeHtml } from '$shared/utils/sanitize.ts';
	import { page } from '$app/stores';
	import { FEATURES } from '$shared/features.ts';

	export let profiles: DelayProfilesRow[];

	const dispatch = createEventDispatcher<{ clone: { name: string }; export: { name: string } }>();

	$: databaseId = $page.params.databaseId;

	function getRowHref(row: DelayProfilesRow): string {
		return `/delay-profiles/${databaseId}/${encodeURIComponent(row.name)}`;
	}

	function formatProtocol(protocol: string): string {
		switch (protocol) {
			case 'prefer_usenet':
				return 'Prefer Usenet';
			case 'prefer_torrent':
				return 'Prefer Torrent';
			case 'only_usenet':
				return 'Only Usenet';
			case 'only_torrent':
				return 'Only Torrent';
			default:
				return protocol;
		}
	}

	function formatDelay(minutes: number | null): string {
		if (minutes === null) return '-';
		if (minutes === 0) return 'No delay';
		if (minutes < 60) return `${minutes}m`;
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
	}

	const columns: Column<DelayProfilesRow>[] = [
		{
			key: 'name',
			header: 'Name',
			headerIcon: Tag,
			align: 'left',
			sortable: true,
			cell: (row: DelayProfilesRow) => ({
				html: `<div class="font-medium">${escapeHtml(row.name)}</div>`
			})
		},
		{
			key: 'preferred_protocol',
			header: 'Protocol',
			headerIcon: Zap,
			align: 'left',
			width: 'w-44',
			cell: (row: DelayProfilesRow) => ({
				// nosemgrep: profilarr.xss.table-cell-html-unescaped — formatProtocol returns hardcoded string
				html: `<span class="font-mono text-xs bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded">${formatProtocol(row.preferred_protocol)}</span>`
			})
		},
		{
			key: 'delays',
			header: 'Delays',
			headerIcon: Clock,
			align: 'left',
			width: 'w-48',
			cell: (row: DelayProfilesRow) => ({
				// nosemgrep: profilarr.xss.table-cell-html-unescaped — formatDelay returns hardcoded string
				html: `
					<div class="text-xs space-y-0.5">
						${row.usenet_delay !== null ? `<div>Usenet: <span class="font-mono text-[10px] bg-neutral-100 dark:bg-neutral-800 px-1 rounded">${formatDelay(row.usenet_delay)}</span></div>` : ''}
						${row.torrent_delay !== null ? `<div>Torrent: <span class="font-mono text-[10px] bg-neutral-100 dark:bg-neutral-800 px-1 rounded">${formatDelay(row.torrent_delay)}</span></div>` : ''}
					</div>
				`
			})
		},
		{
			key: 'bypass',
			header: 'Bypass',
			headerIcon: Shield,
			align: 'left',
			width: 'w-56',
			cell: (row: DelayProfilesRow) => {
				const bypasses: string[] = [];
				if (row.bypass_if_highest_quality) {
					bypasses.push('Highest Quality');
				}
				if (row.bypass_if_above_custom_format_score && row.minimum_custom_format_score !== null) {
					bypasses.push(`CF Score ≥ ${row.minimum_custom_format_score}`);
				}

				if (bypasses.length === 0) {
					return { html: '<span class="text-neutral-400">None</span>' };
				}

				return {
					// nosemgrep: profilarr.xss.table-cell-html-unescaped — bypasses built from hardcoded strings
					html: `
						<div class="text-xs space-y-0.5">
							${bypasses.map((b) => `<div class="font-mono text-[10px] bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-1.5 py-0.5 rounded inline-block">${b}</div>`).join('')}
						</div>
					`
				};
			}
		}
	];
</script>

<Table
	data={profiles}
	{columns}
	emptyMessage="No delay profiles found"
	hoverable={true}
	compact={false}
	rowHref={getRowHref}
>
	<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
	<svelte:fragment slot="actions" let:row>
		<div class="flex items-center justify-end gap-0.5" on:click|stopPropagation>
			{#if FEATURES.importExport}
				<Button
					icon={Download}
					size="xs"
					variant="ghost"
					tooltip="Export"
					on:click={() => dispatch('export', { name: row.name })}
				/>
			{/if}
			<Button
				icon={Copy}
				size="xs"
				variant="secondary"
				tooltip="Clone"
				on:click={() => dispatch('clone', { name: row.name })}
			/>
		</div>
	</svelte:fragment>
</Table>
