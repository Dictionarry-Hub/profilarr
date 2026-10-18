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
	field: ScoringField | 'custom_format_score';
	customFormat?: ScoreCustomFormat;
	arrType?: string;
	/** null: absent upstream. */
	upstream: Value;
	/** null: absent now. */
	current: Value;
	status: RowStatus;
	pendingValue?: Value;
	/** A generated op on this row conflicted, but what it wanted already holds. */
	inEffect?: boolean;
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
	/** created: not in upstream. */
	status: 'modified' | 'created' | 'unchanged';
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
}

/** Scoring settings an op changes, with the value each wanted. */
function scalarTargets(op: ScoringOp): OpTarget[] {
	return op.changedFields
		.filter((field) => (SCORING_FIELDS as readonly string[]).includes(field))
		.map((field) => ({
			key: field,
			wanted: (op.desiredState?.[field] as { to?: Value } | undefined)?.to ?? null
		}));
}

interface ScoreEntry {
	customFormat: ScoreCustomFormat;
	/** A database row's arr type: 'all' is the shared row. */
	arrType: string;
	to: Value;
}

/** The score rows an op writes, each with its custom format's identity. */
function scoreEntries(
	op: ScoringOp,
	identify: (writtenName: string) => ScoreCustomFormat | null
): ScoreEntry[] {
	const raw = op.desiredState?.custom_format_scores;
	if (!Array.isArray(raw)) return [];
	return raw.flatMap((e) => {
		if (!e || typeof e.custom_format_name !== 'string' || typeof e.arr_type !== 'string') return [];
		const customFormat = identify(e.custom_format_name);
		return customFormat ? [{ customFormat, arrType: e.arr_type, to: e.to ?? null }] : [];
	});
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
	current: PortableQualityProfile;
	cfUpstreamNameOf: (currentName: string) => string | null;
	/** A CF name as a generated op wrote it, resolved as of that op. Defaults to cfUpstreamNameOf. */
	cfUpstreamNameBefore?: (name: string, opId: number) => string | null;
	ops: ScoringOp[];
}): ScoringChanges {
	const { current, cfUpstreamNameOf } = input;
	const cfUpstreamNameBefore = input.cfUpstreamNameBefore ?? ((name) => cfUpstreamNameOf(name));
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
	const currentCustomFormat = (name: string) => ({
		upstreamName: cfUpstreamNameOf(name),
		currentName: name
	});
	// Raw score rows (shared 'all' included) as the overlay sees them: current,
	// plus the intended changes of pending ops replayed so far.
	let intended = new Map(
		current.customFormatScores.map((s) => [
			scoreKey(currentCustomFormat(s.customFormatName), s.arrType),
			s.score
		])
	);
	// One resolver for every effective score, as sync resolves it: the arr type's own row, else the shared row.
	const effective = (rawRows: Map<string, number>, cf: ScoreCustomFormat, arrType: string) =>
		rawRows.get(scoreKey(cf, arrType)) ?? rawRows.get(scoreKey(cf, 'all')) ?? null;
	/** Applies an op's score rows; returns each arr type cell they reach, with its effective value after. */
	const applyScores = (entries: ScoreEntry[]) => {
		const after = new Map(intended);
		for (const e of entries) {
			const key = scoreKey(e.customFormat, e.arrType);
			if (e.to === null) after.delete(key);
			else after.set(key, e.to as number);
		}
		const reached = new Map<string, OpTarget>();
		for (const e of entries) {
			for (const arrType of e.arrType === 'all' ? ARR_TYPES : [e.arrType]) {
				const own = scoreKey(e.customFormat, arrType);
				// A shared row doesn't reach an arr type whose own row decides it throughout.
				if (e.arrType === 'all' && intended.has(own) && after.has(own)) continue;
				reached.set(own, {
					key: own,
					wanted: effective(after, e.customFormat, arrType),
					customFormat: e.customFormat,
					arrType
				});
			}
		}
		return { after, reached: [...reached.values()] };
	};

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
			: { field: key as ScoringField, ...valueAt(key), status: 'related', opIds: [] };
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

	const userIdentity = (op: ScoringOp) => (writtenName: string) => ({
		upstreamName: op.cfUpstreamName,
		currentName: op.cfUpstreamName === null ? writtenName : null
	});
	// Generated ops resolve each name as of the op, so a later rename or reuse of a
	// name can't point them at the wrong row.
	const generatedIdentity = (op: ScoringOp) => (writtenName: string) => {
		const upstreamName = cfUpstreamNameBefore(writtenName, op.opId);
		return upstreamName === null ? null : { upstreamName, currentName: null };
	};

	// Op overlay, oldest first so the latest op on a row decides its status.
	// A pending op adds its row even when current still equals upstream.
	for (const op of [...input.ops].sort((a, b) => a.opId - b.opId)) {
		const status = statusOf(op);
		const { after, reached } = applyScores(
			scoreEntries(op, op.generated ? generatedIdentity(op) : userIdentity(op))
		);
		if (op.generated) {
			// Generated ops (a CF rename or delete) only matter when they conflict. Their
			// guards often miss because a cascade already did the work, so a conflict
			// whose wanted state holds reads as already in effect, not as not applied.
			if (status !== 'pending') continue;
			const holds = reached.every(
				(t) => effective(intended, t.customFormat!, t.arrType!) === t.wanted
			);
			for (const target of reached) {
				if (holds) {
					const row = rows.get(target.key);
					if (!row) continue;
					row.opIds.push(op.opId);
					row.inEffect = true;
					continue;
				}
				const row = ensureRow(target.key, target);
				row.opIds.push(op.opId);
				row.status = 'pending';
				row.pendingValue = target.wanted;
			}
		} else {
			for (const target of [...scalarTargets(op), ...reached]) {
				if (!rows.has(target.key) && status !== 'pending') continue;
				const row = ensureRow(target.key, target);
				row.opIds.push(op.opId);
				row.status = status;
				delete row.inEffect;
				if (status === 'pending') row.pendingValue = target.wanted;
				else delete row.pendingValue;
			}
		}
		// A pending op's rows aren't in the database, but later ops build on them.
		if (status === 'pending') intended = after;
	}

	const status = upstream === null ? 'created' : rows.size > 0 ? 'modified' : 'unchanged';
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
