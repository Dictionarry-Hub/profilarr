<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Table from '$ui/table/Table.svelte';
	import Button from '$ui/button/Button.svelte';
	import type { Column } from '$ui/table/types';
	import type { QualityProfileTableRow } from '$shared/pcd/display.ts';
	import { Tag, FileText, Layers, BookOpenText, Gauge, Earth, Copy, Download } from 'lucide-svelte';
	import { sanitizeHtml, escapeHtml } from '$shared/utils/sanitize.ts';
	import { FEATURES } from '$shared/features.ts';

	export let profiles: QualityProfileTableRow[];
	export let databaseId: number;

	const dispatch = createEventDispatcher<{ clone: { name: string }; export: { name: string } }>();

	function getRowHref(row: QualityProfileTableRow): string {
		return `/quality-profiles/${databaseId}/${row.id}/general`;
	}

	const qualitySecondary =
		'inline-flex items-center leading-none font-medium font-mono px-2.5 py-1 text-xs rounded-md bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300';
	const qualitySuccess =
		'inline-flex items-center leading-none font-medium font-mono px-2.5 py-1 text-xs rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
	const labelSecondary =
		'inline-flex items-center leading-none font-medium font-mono px-2 py-1 text-[10px] rounded-md bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300';
	const labelSecondaryNoMono =
		'inline-flex items-center leading-none font-medium px-2 py-1 text-[10px] rounded-md bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300';

	// Define table columns for quality profiles
	const columns: Column<QualityProfileTableRow>[] = [
		{
			key: 'name',
			header: 'Name',
			headerIcon: Tag,
			align: 'left',
			sortable: true,
			cell: (row: QualityProfileTableRow) => ({
				// nosemgrep: profilarr.xss.table-cell-html-unescaped — all values use escapeHtml()
				html: `
					<div>
						<div class="font-medium">${escapeHtml(row.name)}</div>
						${
							row.tags.length > 0
								? `
							<div class="mt-1 flex flex-wrap gap-1">
								${row.tags
									.map(
										(tag) => `
									<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-accent-100 text-accent-800 dark:bg-accent-900 dark:text-accent-200">
										${escapeHtml(tag.name)}
									</span>
								`
									)
									.join('')}
							</div>
						`
								: ''
						}
					</div>
				`
			})
		},
		{
			key: 'description',
			header: 'Description',
			headerIcon: FileText,
			align: 'left',
			cell: (row: QualityProfileTableRow) => ({
				html: row.description
					? sanitizeHtml(row.description)
					: '<span class="text-neutral-400">No description</span>'
			})
		},
		{
			key: 'qualities',
			header: 'Qualities',
			headerIcon: Layers,
			align: 'left',
			width: 'w-48',
			cell: (row: QualityProfileTableRow) => {
				return {
					// nosemgrep: profilarr.xss.table-cell-html-unescaped — all values use escapeHtml()
					html: `
						<div class="flex flex-wrap gap-1 py-1">
							${row.qualities
								.map(
									(q) => `
								<span class="${q.is_upgrade_until ? qualitySuccess : qualitySecondary}">${escapeHtml(q.name)}</span>
							`
								)
								.join('')}
						</div>
					`
				};
			}
		},
		{
			key: 'custom_formats',
			header: 'Custom Formats',
			headerIcon: BookOpenText,
			align: 'left',
			width: 'w-48',
			cell: (row: QualityProfileTableRow) => ({
				// nosemgrep: profilarr.xss.table-cell-html-unescaped — numeric counts only
				html: `
					<div class="text-xs space-y-1">
						<div class="flex items-center gap-1.5">All: <span class="${labelSecondary}">${row.custom_formats.all}</span></div>
						<div class="flex items-center gap-1.5">Radarr: <span class="${labelSecondary}">${row.custom_formats.radarr}</span></div>
						<div class="flex items-center gap-1.5">Sonarr: <span class="${labelSecondary}">${row.custom_formats.sonarr}</span></div>
					</div>
				`
			})
		},
		{
			key: 'scores',
			header: 'Scores',
			headerIcon: Gauge,
			align: 'left',
			width: 'w-52',
			cell: (row: QualityProfileTableRow) => ({
				// nosemgrep: profilarr.xss.table-cell-html-unescaped — numeric scores only
				html: `
					<div class="text-xs space-y-1">
						<div class="flex items-center gap-1.5">Minimum: <span class="${labelSecondary}">${row.minimum_custom_format_score}</span></div>
						${
							row.upgrades_allowed
								? `
							<div class="flex items-center gap-1.5">Upgrade Until: <span class="${labelSecondary}">${row.upgrade_until_score}</span></div>
							<div class="flex items-center gap-1.5">Increment: <span class="${labelSecondary}">${row.upgrade_score_increment}</span></div>
						`
								: `
							<div class="text-neutral-500 dark:text-neutral-400">No Upgrades</div>
						`
						}
					</div>
				`
			})
		},
		{
			key: 'language',
			header: 'Language',
			headerIcon: Earth,
			align: 'left',
			width: 'w-40',
			cell: (row: QualityProfileTableRow) => {
				return {
					html: `<span class="${labelSecondaryNoMono}">${row.language ? (row.language.name === 'Original' ? 'Any' : escapeHtml(row.language.name)) : 'Any'}</span>`
				};
			}
		}
	];
</script>

<Table
	data={profiles}
	{columns}
	emptyMessage="No quality profiles found"
	hoverable={true}
	compact={false}
	rowHref={getRowHref}
	pageSize={50}
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
