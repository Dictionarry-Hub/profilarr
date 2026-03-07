<script lang="ts">
	import Table from '$ui/table/Table.svelte';
	import Badge from '$ui/badge/Badge.svelte';
	import { marked } from 'marked';
	import { sanitizeHtml } from '$shared/utils/sanitize.ts';
	import { ExternalLink } from 'lucide-svelte';
	import {
		getColonReplacementLabel,
		getMultiEpisodeStyleLabel
	} from '$shared/pcd/mediaManagement.ts';
	import type { Column } from '$ui/table/types';
	import type { FieldRow, OperationType } from './types';

	export let rows: FieldRow[] = [];
	export let operation: OperationType = 'update';

	$: columns = getColumns(operation);

	function parseMarkdown(text: string): string {
		return sanitizeHtml(marked.parse(text) as string); // nosemgrep: profilarr.xss.marked-unsanitized
	}

	function isMarkdownField(field: string): boolean {
		return ['description', 'readme', 'notes'].includes(field);
	}

	function isPatternField(field: string): boolean {
		return field === 'pattern';
	}

	function isRegex101Field(field: string): boolean {
		return field === 'regex101_id';
	}

	function isPreferredProtocolField(field: string): boolean {
		return field === 'preferred_protocol';
	}

	function isNamingTemplateField(field: string): boolean {
		return [
			'movie_format',
			'movie_folder_format',
			'standard_episode_format',
			'daily_episode_format',
			'anime_episode_format',
			'series_folder_format',
			'season_folder_format'
		].includes(field);
	}

	function isCustomColonFormatField(field: string): boolean {
		return field === 'custom_colon_replacement_format';
	}

	function isColonReplacementField(field: string): boolean {
		return field === 'colon_replacement_format';
	}

	function isMultiEpisodeStyleField(field: string): boolean {
		return field === 'multi_episode_style';
	}

	function isPropersRepacksField(field: string): boolean {
		return field === 'propers_repacks';
	}

	function formatColonReplacement(value: string): string {
		return getColonReplacementLabel(value as Parameters<typeof getColonReplacementLabel>[0]);
	}

	function formatMultiEpisodeStyle(value: string): string {
		return getMultiEpisodeStyleLabel(value as Parameters<typeof getMultiEpisodeStyleLabel>[0]);
	}

	function formatPropersRepacks(value: string): string {
		switch (value) {
			case 'doNotPrefer':
				return 'Do Not Prefer';
			case 'preferAndUpgrade':
				return 'Prefer and Upgrade';
			case 'doNotUpgradeAutomatically':
				return 'Do Not Upgrade Automatically';
			default:
				return value;
		}
	}

	function formatPreferredProtocol(value: string): string {
		switch (value) {
			case 'prefer_usenet':
				return 'Prefer Usenet';
			case 'prefer_torrent':
				return 'Prefer Torrent';
			case 'only_usenet':
				return 'Only Usenet';
			case 'only_torrent':
				return 'Only Torrent';
			default:
				return value;
		}
	}

	function regex101Url(value: string): string {
		return `https://regex101.com/r/${value}`;
	}

	function formatValue(value: unknown): string {
		if (value === null) return 'null';
		if (value === undefined) return '—';
		if (Array.isArray(value)) return value.length === 0 ? '—' : value.join(', ');
		if (typeof value === 'object') return JSON.stringify(value);
		return String(value);
	}

	function getFieldBefore(row: FieldRow): unknown {
		if (row.before !== undefined) return row.before;
		if (row.remove && row.remove.length > 0) return row.remove;
		return undefined;
	}

	function getFieldAfter(row: FieldRow): unknown {
		if (row.after !== undefined) return row.after;
		if (row.add && row.add.length > 0) return row.add;
		return undefined;
	}

	function getColumns(nextOperation: OperationType): Column<FieldRow>[] {
		switch (nextOperation) {
			case 'create':
				return [
					{ key: 'label', header: 'Field' },
					{ key: 'after', header: 'Value' }
				];
			case 'delete':
				return [
					{ key: 'label', header: 'Field' },
					{ key: 'before', header: 'Value' }
				];
			default:
				return [
					{ key: 'label', header: 'Field' },
					{ key: 'before', header: 'Before' },
					{ key: 'after', header: 'After' }
				];
		}
	}
</script>

<Table {columns} data={rows} compact hoverable={false} responsive>
	<svelte:fragment slot="cell" let:row let:column>
		{#if column.key === 'label'}
			<span class="text-sm text-neutral-700 dark:text-neutral-200">
				{row.label}
			</span>
		{:else if column.key === 'before'}
			{@const beforeValue = getFieldBefore(row)}
			{#if row.field === 'language' && typeof beforeValue === 'string'}
				<Badge variant="info" size="md">{beforeValue}</Badge>
			{:else if isPropersRepacksField(row.field) && typeof beforeValue === 'string'}
				<Badge variant="neutral" size="md">{formatPropersRepacks(beforeValue)}</Badge>
			{:else if isColonReplacementField(row.field) && typeof beforeValue === 'string'}
				<Badge variant="neutral" size="md">{formatColonReplacement(beforeValue)}</Badge>
			{:else if isMultiEpisodeStyleField(row.field) && typeof beforeValue === 'string'}
				<Badge variant="neutral" size="md">{formatMultiEpisodeStyle(beforeValue)}</Badge>
			{:else if isNamingTemplateField(row.field) && typeof beforeValue === 'string'}
				<Badge variant="neutral" size="md" mono>
					{beforeValue}
				</Badge>
			{:else if isCustomColonFormatField(row.field) && typeof beforeValue === 'string'}
				<Badge variant="neutral" size="md" mono>
					{beforeValue}
				</Badge>
			{:else if isPreferredProtocolField(row.field) && typeof beforeValue === 'string'}
				<Badge variant="neutral" size="md">{formatPreferredProtocol(beforeValue)}</Badge>
			{:else if isRegex101Field(row.field) && typeof beforeValue === 'string' && beforeValue.trim()}
				<Badge variant="neutral" size="md" mono>
					<a
						href={regex101Url(beforeValue)}
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-1 text-accent-700 hover:underline dark:text-accent-300"
						title="Open on regex101"
					>
						{beforeValue}
						<ExternalLink size={12} />
					</a>
				</Badge>
			{:else if isPatternField(row.field) && typeof beforeValue === 'string'}
				<Badge variant="neutral" size="md" mono>
					{beforeValue}
				</Badge>
			{:else if typeof beforeValue === 'boolean'}
				<Badge variant={beforeValue ? 'success' : 'neutral'} size="md">
					{beforeValue ? 'Yes' : 'No'}
				</Badge>
			{:else if isMarkdownField(row.field) && typeof beforeValue === 'string'}
				<div class="prose prose-sm prose-neutral dark:prose-invert text-sm">
					{@html parseMarkdown(beforeValue)}<!-- nosemgrep: profilarr.xss.at-html-usage -->
				</div>
			{:else if typeof beforeValue === 'number'}
				<Badge variant="neutral" size="md" mono>
					{beforeValue}
				</Badge>
			{:else}
				<span class="text-sm text-neutral-600 dark:text-neutral-400">
					{formatValue(beforeValue)}
				</span>
			{/if}
		{:else if column.key === 'after'}
			{@const afterValue = getFieldAfter(row)}
			{#if row.field === 'language' && typeof afterValue === 'string'}
				<Badge variant="info" size="md">{afterValue}</Badge>
			{:else if isPropersRepacksField(row.field) && typeof afterValue === 'string'}
				<Badge variant="neutral" size="md">{formatPropersRepacks(afterValue)}</Badge>
			{:else if isColonReplacementField(row.field) && typeof afterValue === 'string'}
				<Badge variant="neutral" size="md">{formatColonReplacement(afterValue)}</Badge>
			{:else if isMultiEpisodeStyleField(row.field) && typeof afterValue === 'string'}
				<Badge variant="neutral" size="md">{formatMultiEpisodeStyle(afterValue)}</Badge>
			{:else if isNamingTemplateField(row.field) && typeof afterValue === 'string'}
				<Badge variant="neutral" size="md" mono>
					{afterValue}
				</Badge>
			{:else if isCustomColonFormatField(row.field) && typeof afterValue === 'string'}
				<Badge variant="neutral" size="md" mono>
					{afterValue}
				</Badge>
			{:else if isPreferredProtocolField(row.field) && typeof afterValue === 'string'}
				<Badge variant="neutral" size="md">{formatPreferredProtocol(afterValue)}</Badge>
			{:else if isRegex101Field(row.field) && typeof afterValue === 'string' && afterValue.trim()}
				<Badge variant="neutral" size="md" mono>
					<a
						href={regex101Url(afterValue)}
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-1 text-accent-700 hover:underline dark:text-accent-300"
						title="Open on regex101"
					>
						{afterValue}
						<ExternalLink size={12} />
					</a>
				</Badge>
			{:else if isPatternField(row.field) && typeof afterValue === 'string'}
				<Badge variant="neutral" size="md" mono>
					{afterValue}
				</Badge>
			{:else if typeof afterValue === 'boolean'}
				<Badge variant={afterValue ? 'success' : 'neutral'} size="md">
					{afterValue ? 'Yes' : 'No'}
				</Badge>
			{:else if isMarkdownField(row.field) && typeof afterValue === 'string'}
				<div class="prose prose-sm prose-neutral dark:prose-invert text-sm">
					{@html parseMarkdown(afterValue)}<!-- nosemgrep: profilarr.xss.at-html-usage -->
				</div>
			{:else if typeof afterValue === 'number'}
				<Badge variant="neutral" size="md" mono>
					{afterValue}
				</Badge>
			{:else}
				<span class="text-sm text-neutral-700 dark:text-neutral-200">
					{formatValue(afterValue)}
				</span>
			{/if}
		{/if}
	</svelte:fragment>
</Table>
