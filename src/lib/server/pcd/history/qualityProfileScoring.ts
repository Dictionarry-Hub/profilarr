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
 * applied: in effect; every difference from upstream came from a local op, though
 * not always one this profile can name. pending: the op didn't apply (conflict or
 * error); pendingValue is what it wanted. overridden: re-applied over an upstream
 * change. related: changed by another entity's change (a CF rename or delete).
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
}

export interface ScoringChanges {
	/** created: not in upstream, so there's nothing to compare and rows are empty. */
	status: 'modified' | 'created' | 'unchanged';
	rows: ScoringChangeRow[];
}

const SCORE_PREFIX = 'custom_format_score:';

const cfKey = (cf: ScoreCustomFormat) =>
	cf.upstreamName !== null ? `u:${cf.upstreamName}` : `l:${cf.currentName}`;

const scoreKey = (cf: ScoreCustomFormat, arrType: string) =>
	`${SCORE_PREFIX}${cfKey(cf)}:${arrType}`;

/** Raw score rows by custom format (cfKey), then arr type ('all' is the shared row). */
type RawScores = Map<string, Map<string, number>>;

/** As sync resolves it: the arr type's own row, else the shared row. */
const effective = (cfRows: Map<string, number> | undefined, arrType: string): Value =>
	cfRows?.get(arrType) ?? cfRows?.get('all') ?? null;

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
	/** A CF name as an op wrote it, resolved as of that op. Defaults to cfUpstreamNameOf. */
	cfUpstreamNameBefore?: (name: string, opId: number) => string | null;
	ops: ScoringOp[];
}): ScoringChanges {
	const { current, cfUpstreamNameOf } = input;
	const cfUpstreamNameBefore = input.cfUpstreamNameBefore ?? ((name) => cfUpstreamNameOf(name));
	if (input.upstream === undefined) return { status: 'unchanged', rows: [] };
	if (input.upstream === null) return { status: 'created', rows: [] };
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
	// actual: the database now. intended: actual plus pending ops' changes, with
	// later applied writes taking precedence over earlier pending ones.
	const actual: RawScores = new Map();
	for (const s of current.customFormatScores) {
		const key = cfKey(currentCustomFormat(s.customFormatName));
		if (!actual.has(key)) actual.set(key, new Map());
		actual.get(key)!.set(s.arrType, s.score);
	}
	const intended: RawScores = new Map(actual);
	/**
	 * Applies an op's score rows to `base` without changing it, copying only the
	 * custom formats they touch. Returns those formats' rows after, and each arr
	 * type cell the rows reach with its effective value after.
	 */
	const applyScores = (base: RawScores, entries: ScoreEntry[]) => {
		const touched = new Map<string, Map<string, number>>();
		for (const e of entries) {
			const key = cfKey(e.customFormat);
			if (!touched.has(key)) touched.set(key, new Map(base.get(key)));
			if (e.to === null) touched.get(key)!.delete(e.arrType);
			else touched.get(key)!.set(e.arrType, e.to as number);
		}
		const reached = new Map<string, OpTarget>();
		for (const e of entries) {
			const before = base.get(cfKey(e.customFormat));
			const after = touched.get(cfKey(e.customFormat))!;
			for (const arrType of e.arrType === 'all' ? ARR_TYPES : [e.arrType]) {
				// A shared row doesn't reach an arr type whose own row decides it throughout.
				if (e.arrType === 'all' && before?.has(arrType) && after.has(arrType)) continue;
				const key = scoreKey(e.customFormat, arrType);
				reached.set(key, {
					key,
					wanted: effective(after, arrType),
					customFormat: e.customFormat,
					arrType
				});
			}
		}
		return { touched, reached: [...reached.values()] };
	};
	const commit = (touched: Map<string, Map<string, number>>) => {
		for (const [key, cfRows] of touched) intended.set(key, cfRows);
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
					status: 'applied',
					opIds: []
				}
			: { field: key as ScoringField, ...valueAt(key), status: 'applied', opIds: [] };
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

	// Each name resolves as of its op, so a later rename or reuse of a name can't
	// point an op at the wrong row. A generated op's vacated name has nothing to change.
	const identity =
		(op: ScoringOp) =>
		(writtenName: string): ScoreCustomFormat | null => {
			const upstreamName = cfUpstreamNameBefore(writtenName, op.opId);
			if (upstreamName === null && op.generated) return null;
			return { upstreamName, currentName: upstreamName === null ? writtenName : null };
		};

	// Op overlay, oldest first so the latest op on a row decides its status.
	// A pending op adds its row even when current still equals upstream.
	for (const op of [...input.ops].sort((a, b) => a.opId - b.opId)) {
		const status = statusOf(op);
		const entries = scoreEntries(op, identity(op));

		if (op.generated) {
			if (entries.length === 0) continue;
			const { touched, reached } = applyScores(intended, entries);
			if (status !== 'pending') {
				commit(touched);
				// Applied, it's the latest word on the cells it changed: a related change,
				// whatever an earlier op wanted there.
				for (const target of applyScores(actual, entries).reached) {
					const row = rows.get(target.key);
					if (!row) continue;
					row.opIds.push(op.opId);
					row.status = 'related';
					delete row.pendingValue;
					delete row.inEffect;
				}
				continue;
			}
			// A conflicted generated op (a CF rename or delete) often only missed because a
			// cascade already did the work, so one whose wanted state holds is in effect.
			const holds = reached.every(
				(t) => effective(actual.get(cfKey(t.customFormat!)), t.arrType!) === t.wanted
			);
			// Its values are from when it was written, so one in effect mustn't
			// overwrite what a pending op still wants.
			if (!holds) commit(touched);
			for (const target of reached) {
				if (holds) {
					const row = rows.get(target.key);
					if (!row) continue;
					// A difference no other op claims is this related change's.
					if (row.opIds.length === 0) row.status = 'related';
					row.opIds.push(op.opId);
					row.inEffect = true;
					continue;
				}
				const row = ensureRow(target.key, target);
				row.opIds.push(op.opId);
				row.status = 'pending';
			}
			continue;
		}

		// A pending op is judged against the intended state; an applied one against
		// the database it actually changed.
		let reached: OpTarget[] = [];
		if (entries.length > 0) {
			const onIntended = applyScores(intended, entries);
			reached = status === 'pending' ? onIntended.reached : applyScores(actual, entries).reached;
			commit(onIntended.touched);
		}
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

	// A pending score shows what it would be if every pending change applied now.
	for (const row of rows.values()) {
		if (row.status === 'pending' && row.customFormat && row.arrType) {
			row.pendingValue = effective(intended.get(cfKey(row.customFormat)), row.arrType);
		}
	}

	return { status: rows.size > 0 ? 'modified' : 'unchanged', rows: sortRows([...rows.values()]) };
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
