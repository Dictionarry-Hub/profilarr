import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { pcdOpHistoryQueries } from '$db/queries/pcdOpHistory.ts';
import type { OperationMetadata } from '$pcd/core/types.ts';
import { alignConflict, overrideConflict } from '$pcd/conflicts/index.ts';
import { getCache } from '$pcd/index.ts';
import { AUTO_ALIGN_ENTITIES } from '$pcd/entities/registry.ts';

type FieldConflict = {
	field: string;
	was: unknown;
	you: unknown;
	upstreamNow: unknown;
};

type ConflictRow = {
	opId: number;
	status: string;
	conflictReason: string | null;
	appliedAt: string;
	operation: string;
	entity: string;
	name: string;
	title: string;
	summary: string | null;
	origin: string;
	/** Group identifier for visually clustering siblings from the same save. */
	groupId: string | null;
	/** Per-field conflict breakdown for simple update ops. Empty when complex. */
	fields: FieldConflict[];
	/**
	 * True when desired_state isn't simple per-field {from,to} (creates,
	 * deletes, CF conditions, QP qualities/scoring, etc). UI renders a
	 * placeholder for these.
	 */
	complex: boolean;
};

type ParsedMetadata = (OperationMetadata & { group_id?: string }) | null;

function parseMetadata(raw: string | null): ParsedMetadata {
	if (!raw) return null;
	try {
		return JSON.parse(raw) as OperationMetadata & { group_id?: string };
	} catch {
		return null;
	}
}

function parseDesiredState(raw: string | null): Record<string, unknown> | null {
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
			return parsed as Record<string, unknown>;
		}
	} catch {
		// fall through
	}
	return null;
}

function isFromTo(value: unknown): value is { from: unknown; to: unknown } {
	return (
		value !== null &&
		typeof value === 'object' &&
		'from' in (value as Record<string, unknown>) &&
		'to' in (value as Record<string, unknown>)
	);
}

function formatEntity(entity?: string): string {
	return (entity ?? 'operation').replace(/_/g, ' ');
}

function formatTitle(metadata: OperationMetadata | null): string {
	const operation = metadata?.operation ?? 'update';
	const entity = formatEntity(metadata?.entity);
	const name = metadata?.name ? ` "${metadata.name}"` : '';
	return `${operation} ${entity}${name}`;
}

type CurrentRowLookup = (entity: string, lookupName: string) => Record<string, unknown> | null;

function makeCurrentRowLookup(databaseId: number): CurrentRowLookup {
	const cache = getCache(databaseId);
	const memo = new Map<string, Record<string, unknown> | null>();
	return (entity, lookupName) => {
		if (!cache) return null;
		const config = AUTO_ALIGN_ENTITIES.get(entity);
		if (!config) return null;

		const cacheKey = `${entity}::${lookupName}`;
		if (memo.has(cacheKey)) return memo.get(cacheKey) ?? null;

		try {
			// nosemgrep: profilarr.sql.template-literal-interpolation - table/column from hardcoded registry
			const row = cache.queryOne<Record<string, unknown>>(
				`SELECT * FROM ${config.table} WHERE ${config.keyColumn} = ? LIMIT 1`,
				lookupName
			);
			memo.set(cacheKey, row ?? null);
			return row ?? null;
		} catch {
			memo.set(cacheKey, null);
			return null;
		}
	};
}

function buildFieldConflicts(
	lookupRow: CurrentRowLookup,
	entity: string,
	metadata: ParsedMetadata,
	desiredState: Record<string, unknown> | null
): { fields: FieldConflict[]; complex: boolean } {
	if (!desiredState) return { fields: [], complex: false };

	const keys = Object.keys(desiredState);
	if (keys.length === 0) return { fields: [], complex: false };

	if (!keys.every((key) => isFromTo(desiredState[key]))) {
		return { fields: [], complex: true };
	}

	const lookupName = lookupNameFromMetadata(metadata);
	const currentRow = lookupName ? lookupRow(entity, lookupName) : null;

	const fields: FieldConflict[] = keys.map((field) => {
		const change = desiredState[field] as { from: unknown; to: unknown };
		return {
			field,
			was: change.from,
			you: change.to,
			upstreamNow: currentRow ? (currentRow[field] ?? null) : null
		};
	});

	return { fields, complex: false };
}

function lookupNameFromMetadata(metadata: ParsedMetadata): string | null {
	if (!metadata) return null;
	const stableKey = (metadata as unknown as { stable_key?: { value?: unknown } }).stable_key;
	const stableKeyValue = stableKey?.value;
	if (typeof stableKeyValue === 'string' && stableKeyValue.length > 0) return stableKeyValue;
	if (typeof metadata.name === 'string' && metadata.name.length > 0) return metadata.name;
	return null;
}

export const load: PageServerLoad = async ({ parent }) => {
	const { database } = await parent();
	const conflicts = pcdOpHistoryQueries.listLatestConflictsByDatabase(database.id);
	const lookupRow = makeCurrentRowLookup(database.id);

	const rows: ConflictRow[] = conflicts.map(({ history, op }) => {
		const metadata = parseMetadata(op.metadata ?? null);
		const desiredState = parseDesiredState(op.desired_state ?? null);
		const title = metadata?.title ?? metadata?.summary ?? formatTitle(metadata);
		const entity = metadata?.entity ?? 'operation';
		const { fields, complex } = buildFieldConflicts(lookupRow, entity, metadata, desiredState);

		return {
			opId: op.id,
			status: history.status,
			conflictReason: history.conflict_reason,
			appliedAt: history.applied_at,
			operation: metadata?.operation ?? 'update',
			entity,
			name: metadata?.name ?? '',
			title,
			summary: metadata?.summary ?? null,
			origin: op.origin,
			groupId: typeof metadata?.group_id === 'string' ? metadata.group_id : null,
			fields,
			complex
		};
	});

	return {
		conflictStrategy: database.conflict_strategy ?? 'override',
		conflicts: rows
	};
};

function parseOpId(formData: FormData): number | null {
	const raw = formData.get('opId');
	const opId = Number(raw);
	return Number.isFinite(opId) ? opId : null;
}

export const actions: Actions = {
	align: async ({ request, params }) => {
		const databaseId = Number(params.id);
		if (!Number.isFinite(databaseId)) {
			return fail(400, { error: 'Invalid database id' });
		}

		const formData = await request.formData();
		const opId = parseOpId(formData);
		if (opId === null) {
			return fail(400, { error: 'Invalid operation id' });
		}

		const result = await alignConflict({ databaseId, opId });
		if (!result.success) {
			return fail(400, { error: result.error || 'Failed to align conflict' });
		}

		return { success: true };
	},
	override: async ({ request, params }) => {
		const databaseId = Number(params.id);
		if (!Number.isFinite(databaseId)) {
			return fail(400, { error: 'Invalid database id' });
		}

		const formData = await request.formData();
		const opId = parseOpId(formData);
		if (opId === null) {
			return fail(400, { error: 'Invalid operation id' });
		}

		const result = await overrideConflict({ databaseId, opId });
		if (!result.success) {
			return fail(400, { error: result.error || 'Failed to override conflict' });
		}

		return { success: true };
	}
};
