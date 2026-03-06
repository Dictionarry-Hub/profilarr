<script lang="ts">
	import Table from '$ui/table/Table.svelte';
	import Badge from '$ui/badge/Badge.svelte';
	import type { Column } from '$ui/table/types';
	import type { ConditionDiff, ConditionSnapshot } from './types';
	import radarrLogo from '$lib/client/assets/Radarr.svg';
	import sonarrLogo from '$lib/client/assets/Sonarr.svg';

	export let rows: ConditionDiff[] = [];

	const columns: Column<ConditionDiff>[] = [
		{ key: 'name', header: 'Name' },
		{ key: 'type', header: 'Type' },
		{ key: 'value', header: 'Value' },
		{ key: 'arr', header: 'Arr', width: 'w-20' },
		{ key: 'required', header: 'Required', width: 'w-20' },
		{ key: 'negated', header: 'Negated', width: 'w-20' }
	];

	function formatTitle(value: string): string {
		const trimmed = value.replace(/[_-]+/g, ' ').trim();
		return trimmed.replace(/\b\w/g, (char) => char.toUpperCase());
	}

	function extractConditionValue(
		values?: Record<string, unknown> | null
	): { value: string; mono: boolean } | null {
		if (!values) return null;
		const entries = Object.entries(values).filter(([, val]) => {
			if (Array.isArray(val)) return val.length > 0;
			return val !== null && val !== undefined;
		});
		if (entries.length === 0) return null;
		return formatValue(entries[0][1]);
	}

	function formatValueLabel(raw: string): string {
		const normalized = raw.replace(/_/g, '-').toLowerCase();
		if (normalized === 'web-dl' || normalized === 'webdl') return 'WEBDL';
		if (normalized === 'web-rip' || normalized === 'webrip') return 'WEBRip';
		if (normalized === 'blu-ray' || normalized === 'bluray') return 'Bluray';
		if (normalized === 'hdtv') return 'HDTV';
		if (normalized === 'sd') return 'SD';
		return formatTitle(raw);
	}

	function formatValue(value: unknown): { value: string; mono: boolean } {
		if (value === null || value === undefined) return { value: '—', mono: false };
		if (Array.isArray(value)) {
			if (value.length === 0) return { value: '—', mono: false };
			const first = value[0];
			if (first && typeof first === 'object') {
				const record = first as Record<string, unknown>;
				const name = record.name ? String(record.name) : JSON.stringify(record);
				const label = record.except === true ? `${name} (except)` : name;
				return { value: label, mono: false };
			}
			return { value: formatValueLabel(String(first)), mono: false };
		}
		if (typeof value === 'object') {
			const record = value as Record<string, unknown>;
			if ('minBytes' in record || 'maxBytes' in record) {
				const min = record.minBytes ?? '—';
				const max = record.maxBytes ?? '—';
				return { value: `${min} -> ${max}`, mono: true };
			}
			if ('minYear' in record || 'maxYear' in record) {
				const min = record.minYear ?? '—';
				const max = record.maxYear ?? '—';
				return { value: `${min} -> ${max}`, mono: true };
			}
			if ('name' in record && record.name != null) {
				return { value: String(record.name), mono: false };
			}
			return { value: JSON.stringify(record), mono: false };
		}
		if (typeof value === 'number') return { value: String(value), mono: true };
		return { value: formatValueLabel(String(value)), mono: false };
	}

	function formatChange(
		before?: string | number | boolean | null,
		after?: string | number | boolean | null
	): string {
		if (before === undefined && after === undefined) return '—';
		if (before !== undefined && after !== undefined && before !== after) {
			return `${String(before)} -> ${String(after)}`;
		}
		return String(after ?? before);
	}

	function getSnapshot(
		row: ConditionDiff,
		which: 'before' | 'after'
	): ConditionSnapshot | undefined {
		return which === 'before' ? row.before : row.after;
	}

	function getConditionField(
		row: ConditionDiff,
		field: keyof ConditionSnapshot
	): {
		before?: ConditionSnapshot[keyof ConditionSnapshot];
		after?: ConditionSnapshot[keyof ConditionSnapshot];
	} {
		return {
			before: row.before?.[field],
			after: row.after?.[field]
		};
	}

	function getValueChange(row: ConditionDiff): { before?: string; after?: string } {
		const before = row.before?.values ? extractConditionValue(row.before.values) : null;
		const after = row.after?.values ? extractConditionValue(row.after.values) : null;
		return {
			before: before?.value,
			after: after?.value
		};
	}

	function formatBoolean(value?: boolean): string {
		if (value === undefined) return '—';
		return value ? 'Yes' : 'No';
	}

	function changeBadgeVariant(change: ConditionDiff['change']): 'success' | 'danger' | 'neutral' {
		if (change === 'added') return 'success';
		if (change === 'removed') return 'danger';
		return 'neutral';
	}
</script>

<Table {columns} data={rows} compact hoverable={false} responsive>
	<svelte:fragment slot="cell" let:row let:column>
		{#if column.key === 'name'}
			<div class="flex flex-wrap items-center gap-2">
				<span class="text-sm text-neutral-700 dark:text-neutral-200">
					{row.name}
				</span>
				<Badge variant={changeBadgeVariant(row.change)} size="sm">
					{formatTitle(row.change)}
				</Badge>
			</div>
		{:else if column.key === 'type'}
			{@const change = getConditionField(row, 'type')}
			{#if change.before !== undefined && change.after !== undefined && change.before !== change.after}
				<span class="text-sm text-neutral-600 dark:text-neutral-300">
					{formatTitle(String(change.before))} -&gt; {formatTitle(String(change.after))}
				</span>
			{:else if change.after !== undefined || change.before !== undefined}
				<span class="text-sm text-neutral-600 dark:text-neutral-300">
					{formatTitle(String(change.after ?? change.before))}
				</span>
			{:else}
				<span class="text-sm text-neutral-400">—</span>
			{/if}
		{:else if column.key === 'value'}
			{@const beforeValue = row.before?.values ? extractConditionValue(row.before.values) : null}
			{@const afterValue = row.after?.values ? extractConditionValue(row.after.values) : null}
			{#if beforeValue && afterValue && beforeValue.value !== afterValue.value}
				<div class="flex flex-wrap items-center gap-1">
					<Badge variant="neutral" size="sm" mono={beforeValue.mono}>
						{beforeValue.value}
					</Badge>
					<span class="text-neutral-400">-&gt;</span>
					<Badge variant="neutral" size="sm" mono={afterValue.mono}>
						{afterValue.value}
					</Badge>
				</div>
			{:else if afterValue || beforeValue}
				<Badge variant="neutral" size="sm" mono={(afterValue ?? beforeValue)?.mono}>
					{(afterValue ?? beforeValue)?.value}
				</Badge>
			{:else}
				<span class="text-sm text-neutral-400">—</span>
			{/if}
		{:else if column.key === 'arr'}
			{@const change = getConditionField(row, 'arrType')}
			{@const before = change.before as string | undefined}
			{@const after = change.after as string | undefined}
			{#if before && after && before !== after}
				<div class="flex items-center gap-1">
					{#if before === 'all'}
						<div class="flex items-center gap-1">
							<img src={radarrLogo} alt="Radarr" class="h-4 w-4" />
							<img src={sonarrLogo} alt="Sonarr" class="h-4 w-4" />
						</div>
					{:else if before === 'radarr'}
						<img src={radarrLogo} alt="Radarr" class="h-4 w-4" />
					{:else if before === 'sonarr'}
						<img src={sonarrLogo} alt="Sonarr" class="h-4 w-4" />
					{:else}
						<Badge variant="neutral" size="sm">{formatTitle(before)}</Badge>
					{/if}
					<span class="text-neutral-400">-&gt;</span>
					{#if after === 'all'}
						<div class="flex items-center gap-1">
							<img src={radarrLogo} alt="Radarr" class="h-4 w-4" />
							<img src={sonarrLogo} alt="Sonarr" class="h-4 w-4" />
						</div>
					{:else if after === 'radarr'}
						<img src={radarrLogo} alt="Radarr" class="h-4 w-4" />
					{:else if after === 'sonarr'}
						<img src={sonarrLogo} alt="Sonarr" class="h-4 w-4" />
					{:else}
						<Badge variant="neutral" size="sm">{formatTitle(after)}</Badge>
					{/if}
				</div>
			{:else if after === 'all' || before === 'all'}
				<div class="flex items-center gap-1">
					<img src={radarrLogo} alt="Radarr" class="h-4 w-4" />
					<img src={sonarrLogo} alt="Sonarr" class="h-4 w-4" />
				</div>
			{:else if (after ?? before) === 'radarr'}
				<img src={radarrLogo} alt="Radarr" class="h-5 w-5" />
			{:else if (after ?? before) === 'sonarr'}
				<img src={sonarrLogo} alt="Sonarr" class="h-5 w-5" />
			{:else}
				<Badge variant="neutral" size="sm">{formatTitle(String(after ?? before ?? ''))}</Badge>
			{/if}
		{:else if column.key === 'required'}
			{@const change = getConditionField(row, 'required')}
			{#if change.before !== undefined && change.after !== undefined && change.before !== change.after}
				<div class="flex items-center gap-1 text-xs">
					<Badge variant={change.before ? 'success' : 'neutral'} size="sm">
						{formatBoolean(change.before as boolean)}
					</Badge>
					<span class="text-neutral-400">-&gt;</span>
					<Badge variant={change.after ? 'success' : 'neutral'} size="sm">
						{formatBoolean(change.after as boolean)}
					</Badge>
				</div>
			{:else}
				<Badge variant={(change.after ?? change.before) ? 'success' : 'neutral'} size="sm">
					{formatBoolean((change.after ?? change.before) as boolean | undefined)}
				</Badge>
			{/if}
		{:else if column.key === 'negated'}
			{@const change = getConditionField(row, 'negate')}
			{#if change.before !== undefined && change.after !== undefined && change.before !== change.after}
				<div class="flex items-center gap-1 text-xs">
					<Badge variant={change.before ? 'success' : 'neutral'} size="sm">
						{formatBoolean(change.before as boolean)}
					</Badge>
					<span class="text-neutral-400">-&gt;</span>
					<Badge variant={change.after ? 'success' : 'neutral'} size="sm">
						{formatBoolean(change.after as boolean)}
					</Badge>
				</div>
			{:else}
				<Badge variant={(change.after ?? change.before) ? 'success' : 'neutral'} size="sm">
					{formatBoolean((change.after ?? change.before) as boolean | undefined)}
				</Badge>
			{/if}
		{/if}
	</svelte:fragment>
</Table>
