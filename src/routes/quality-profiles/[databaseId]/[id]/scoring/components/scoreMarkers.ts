/** Per-cell local change markers for the scoring tables, keyed by CF name, then arr type. */

type Value = number | boolean | null;

export type ScoreMarkerStatus = 'applied' | 'pending' | 'overridden' | 'related';

export interface ScoreMarker {
	status: ScoreMarkerStatus;
	upstream: Value;
	pendingValue?: Value;
}

export type ScoreMarkers = Record<string, Record<string, ScoreMarker>>;

interface ChangeRow {
	field: string;
	customFormat?: { upstreamName: string | null; currentName: string | null };
	arrType?: string;
	upstream: Value;
	status: ScoreMarkerStatus;
	pendingValue?: Value;
}

export function buildScoreMarkers(rows: ChangeRow[]): ScoreMarkers {
	const markers: ScoreMarkers = {};
	for (const row of rows) {
		if (row.field !== 'custom_format_score' || !row.arrType) continue;
		// The table lists CFs by current name; a row removed from this profile has none.
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

const show = (value: Value | undefined) =>
	value === null || value === undefined ? 'unset' : String(value);

export function markerText(marker: ScoreMarker): string {
	switch (marker.status) {
		case 'pending':
			return `Yours ${show(marker.pendingValue)} not applied`;
		case 'overridden':
			return `Re-applied · upstream ${show(marker.upstream)}`;
		case 'related':
			return `Upstream ${show(marker.upstream)} · related change`;
		default:
			return `Upstream ${show(marker.upstream)}`;
	}
}

/** Fits one line beside a compact phone input; the number comes first or right after one word. */
export function markerShortText(marker: ScoreMarker): string {
	switch (marker.status) {
		case 'pending':
			return `${show(marker.pendingValue)} not applied`;
		case 'overridden':
			return `re-applied, was ${show(marker.upstream)}`;
		default:
			return `was ${show(marker.upstream)}`;
	}
}

export const markerTextClass: Record<ScoreMarkerStatus, string> = {
	applied: 'text-neutral-500 dark:text-neutral-400',
	pending: 'text-amber-600 dark:text-amber-400',
	overridden: 'text-sky-600 dark:text-sky-400',
	related: 'text-neutral-500 dark:text-neutral-400'
};
