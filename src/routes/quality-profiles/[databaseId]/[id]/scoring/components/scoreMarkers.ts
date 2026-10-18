import type { PageData } from '../$types';

type ChangeRow = PageData['localChanges']['rows'][number];
type Value = ChangeRow['upstream'];

type ScoreMarkerStatus = ChangeRow['status'];

export interface ScoreMarker {
	status: ScoreMarkerStatus;
	upstream: Value;
	pendingValue?: Value;
}

export type ScoreMarkers = Record<string, Record<string, ScoreMarker>>;

/** Per-cell local change markers for the scoring tables, keyed by CF name, then arr type. */
export function buildScoreMarkers(rows: ChangeRow[]): ScoreMarkers {
	const markers: ScoreMarkers = {};
	for (const row of rows) {
		if (row.field !== 'custom_format_score' || !row.arrType) continue;
		// The table lists CFs by current name. A removed row has none, so this falls back to
		// the default name, which differs only if the CF was renamed.
		const name = row.customFormat?.currentName ?? row.customFormat?.upstreamName;
		if (!name) continue;
		markers[name] ??= {};
		markers[name][row.arrType] = {
			status: row.status,
			upstream: row.upstream,
			pendingValue: row.pendingValue
		};
	}
	return markers;
}

/** Markers for the profile-level scoring settings, keyed by field. */
export function buildSettingMarkers(rows: ChangeRow[]): Record<string, ScoreMarker> {
	const markers: Record<string, ScoreMarker> = {};
	for (const row of rows) {
		if (row.field === 'custom_format_score') continue;
		markers[row.field] = {
			status: row.status,
			upstream: row.upstream,
			pendingValue: row.pendingValue
		};
	}
	return markers;
}

const show = (value: Value | undefined) =>
	value === null || value === undefined
		? 'unset'
		: typeof value === 'boolean'
			? value
				? 'enabled'
				: 'disabled'
			: String(value);

export function markerText(marker: ScoreMarker): string {
	switch (marker.status) {
		case 'pending':
			return `Default: ${show(marker.upstream)} · yours ${show(marker.pendingValue)} didn't apply`;
		case 'overridden':
			return `Default: ${show(marker.upstream)} · re-applied`;
		case 'related':
			return `Default: ${show(marker.upstream)} · related change`;
		default:
			return `Default: ${show(marker.upstream)}`;
	}
}
