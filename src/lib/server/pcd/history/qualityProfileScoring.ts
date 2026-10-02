/**
 * Local changes to a quality profile's scoring: upstream vs current, with each
 * row's op status. Custom format names in current rows are normalized to their
 * upstream names, so a CF rename alone doesn't read as a score change. Scores
 * compare per arr type as sync resolves them: an arr type's own row, else the
 * shared 'all' row, so expanding a shared score isn't a change either.
 */

import type { PortableQualityProfile } from '$shared/pcd/portable.ts';

export const SCORING_FIELDS = [
	'upgrades_allowed',
	'minimum_custom_format_score',
	'upgrade_until_score',
	'upgrade_score_increment'
] as const;
export type ScoringField = (typeof SCORING_FIELDS)[number];

type Value = number | boolean | null;

const ARR_TYPES = ['radarr', 'sonarr'] as const;

/** A score row's custom format: by upstream name, or by current name if it has none upstream. */
export interface ScoreCustomFormat {
	upstreamName: string | null;
	currentName: string | null;
}

/**
 * applied: the user's op applied. pending: it didn't (conflict or error);
 * pendingValue is what it wanted. overridden: re-applied over an upstream change.
 * related: changed by another entity's change (a CF rename or delete).
 */
export type RowStatus = 'applied' | 'pending' | 'overridden' | 'related';

export interface ScoringChangeRow {
	key: string;
	field: ScoringField | 'custom_format_score';
	customFormat?: ScoreCustomFormat;
	arrType?: string;
	/** null: absent upstream. */
	upstream: Value;
	/** null: absent now. */
	current: Value;
	status: RowStatus;
	pendingValue?: Value;
	opIds: number[];
}

export interface ScoringOp {
	opId: number;
	changedFields: string[];
	generated: boolean;
	desiredState: Record<string, unknown> | null;
	/** Latest op history status. */
	status: string | null;
	/** Set when this op replaced another through override. */
	replacesOpId: number | null;
	/** For score ops: the custom format's upstream name as of this op. */
	cfUpstreamName: string | null;
}

export interface ScoringChanges {
	/** created: not in upstream. deleted: not in current. */
	status: 'modified' | 'created' | 'deleted' | 'unchanged';
	rows: ScoringChangeRow[];
}

const SCORE_PREFIX = 'custom_format_score:';

const scoreKey = (cf: ScoreCustomFormat, arrType: string) =>
	cf.upstreamName !== null
		? `${SCORE_PREFIX}u:${cf.upstreamName}:${arrType}`
		: `${SCORE_PREFIX}l:${cf.currentName}:${arrType}`;

function scalars(p: PortableQualityProfile | null): Record<ScoringField, Value> {
	return {
		upgrades_allowed: p?.upgradesAllowed ?? null,
		minimum_custom_format_score: p?.minimumScore ?? null,
		upgrade_until_score: p?.upgradeUntilScore ?? null,
		upgrade_score_increment: p?.upgradeScoreIncrement ?? null
	};
}

interface ScoreCell {
	customFormat: ScoreCustomFormat;
	arrType: string;
	score: number;
}

/** Effective score per arr type: shared 'all' rows first, so an arr type's own row wins. */
function scoreCells(
	p: PortableQualityProfile | null,
	customFormatOf: (name: string) => ScoreCustomFormat
): Map<string, ScoreCell> {
	const cells = new Map<string, ScoreCell>();
	const scores = [...(p?.customFormatScores ?? [])].sort(
		(a, b) => Number(b.arrType === 'all') - Number(a.arrType === 'all')
	);
	for (const s of scores) {
		const customFormat = customFormatOf(s.customFormatName);
		for (const arrType of s.arrType === 'all' ? ARR_TYPES : [s.arrType]) {
			cells.set(scoreKey(customFormat, arrType), { customFormat, arrType, score: s.score });
		}
	}
	return cells;
}

interface OpTarget {
	key: string;
	wanted: Value;
	customFormat?: ScoreCustomFormat;
	arrType?: string;
	/** Removes a shared 'all' row: what each arr type ends up with depends on its own row. */
	sharedRemoval?: boolean;
}

/** Row keys an op's changed fields address, with the value each wanted. */
function opTargets(op: ScoringOp): OpTarget[] {
	const targets: OpTarget[] = [];
	for (const field of op.changedFields) {
		if ((SCORING_FIELDS as readonly string[]).includes(field)) {
			const entry = op.desiredState?.[field] as { to?: Value } | undefined;
			targets.push({ key: field, wanted: entry?.to ?? null });
			continue;
		}
		if (!field.startsWith(SCORE_PREFIX)) continue;
		// custom_format_score:<cf>:<arr>; the CF name itself may contain colons.
		const rest = field.slice(SCORE_PREFIX.length);
		const cut = rest.lastIndexOf(':');
		if (cut <= 0) continue;
		const writtenName = rest.slice(0, cut);
		const arrType = rest.slice(cut + 1);
		const customFormat = {
			upstreamName: op.cfUpstreamName,
			currentName: op.cfUpstreamName === null ? writtenName : null
		};
		const entries = (op.desiredState?.custom_format_scores ?? []) as Array<{
			custom_format_name?: string;
			arr_type?: string;
			to?: Value;
		}>;
		const entry = entries.find(
			(e) => e.arr_type === arrType && e.custom_format_name === writtenName
		);
		const wanted = entry?.to ?? null;
		for (const effectiveArrType of arrType === 'all' ? ARR_TYPES : [arrType]) {
			targets.push({
				key: scoreKey(customFormat, effectiveArrType),
				wanted,
				customFormat,
				arrType: effectiveArrType,
				sharedRemoval: arrType === 'all' && wanted === null
			});
		}
	}
	return targets;
}

function statusOf(op: ScoringOp): RowStatus {
	if (op.status === 'conflicted_pending' || op.status === 'conflicted' || op.status === 'error') {
		return 'pending';
	}
	if (op.replacesOpId !== null) return 'overridden';
	return 'applied';
}

export function qualityProfileScoringChanges(input: {
	/** undefined: not captured (no local changes reach it). null: not in upstream. */
	upstream: PortableQualityProfile | null | undefined;
	current: PortableQualityProfile | null;
	cfUpstreamNameOf: (currentName: string) => string | null;
	ops: ScoringOp[];
}): ScoringChanges {
	const { current, cfUpstreamNameOf } = input;
	if (input.upstream === undefined) return { status: 'unchanged', rows: [] };
	const upstream = input.upstream;

	const rows = new Map<string, ScoringChangeRow>();
	const up = scalars(upstream);
	const now = scalars(current);
	const upCells = scoreCells(upstream, (name) => ({ upstreamName: name, currentName: null }));
	const nowCells = scoreCells(current, (name) => ({
		upstreamName: cfUpstreamNameOf(name),
		currentName: name
	}));

	const valueAt = (key: string): { upstream: Value; current: Value } =>
		key.startsWith(SCORE_PREFIX)
			? { upstream: upCells.get(key)?.score ?? null, current: nowCells.get(key)?.score ?? null }
			: { upstream: up[key as ScoringField], current: now[key as ScoringField] };

	// The hint names a score row neither side has (a pending op that would add it).
	const ensureRow = (key: string, hint?: OpTarget): ScoringChangeRow => {
		const existing = rows.get(key);
		if (existing) return existing;
		const cell = nowCells.get(key) ?? upCells.get(key);
		const row: ScoringChangeRow = key.startsWith(SCORE_PREFIX)
			? {
					key,
					field: 'custom_format_score',
					customFormat: {
						upstreamName:
							cell?.customFormat.upstreamName ?? hint?.customFormat?.upstreamName ?? null,
						currentName:
							nowCells.get(key)?.customFormat.currentName ?? hint?.customFormat?.currentName ?? null
					},
					arrType: cell?.arrType ?? hint?.arrType,
					...valueAt(key),
					status: 'related',
					opIds: []
				}
			: { key, field: key as ScoringField, ...valueAt(key), status: 'related', opIds: [] };
		rows.set(key, row);
		return row;
	};

	for (const field of SCORING_FIELDS) {
		if (up[field] !== now[field]) ensureRow(field);
	}
	for (const key of new Set([...upCells.keys(), ...nowCells.keys()])) {
		const v = valueAt(key);
		if (v.upstream !== v.current) ensureRow(key);
	}

	// Op overlay, oldest first so the latest op on a row decides its status.
	// A pending op adds its row even when current still equals upstream, unless
	// it only removes a shared row: alone, that says nothing about the result.
	for (const op of [...input.ops].sort((a, b) => a.opId - b.opId)) {
		if (op.generated) continue;
		const status = statusOf(op);
		for (const target of opTargets(op)) {
			const { key, wanted } = target;
			if (!rows.has(key) && (status !== 'pending' || target.sharedRemoval)) continue;
			const row = ensureRow(key, target);
			row.opIds.push(op.opId);
			row.status = status;
			if (status === 'pending') row.pendingValue = wanted;
			else delete row.pendingValue;
		}
	}

	const status =
		upstream === null
			? 'created'
			: current === null
				? 'deleted'
				: rows.size > 0
					? 'modified'
					: 'unchanged';
	return { status, rows: sortRows([...rows.values()]) };
}

function sortRows(rows: ScoringChangeRow[]): ScoringChangeRow[] {
	const fieldOrder = (r: ScoringChangeRow) =>
		r.field === 'custom_format_score' ? SCORING_FIELDS.length : SCORING_FIELDS.indexOf(r.field);
	const cfName = (r: ScoringChangeRow) =>
		r.customFormat?.currentName ?? r.customFormat?.upstreamName ?? '';
	return rows.sort(
		(a, b) =>
			fieldOrder(a) - fieldOrder(b) ||
			cfName(a).localeCompare(cfName(b)) ||
			(a.arrType ?? '').localeCompare(b.arrType ?? '')
	);
}
