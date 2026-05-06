import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { pcdOpHistoryQueries } from '$db/queries/pcdOpHistory.ts';
import type { OperationMetadata } from '$pcd/core/types.ts';
import { alignConflict, overrideConflict } from '$pcd/conflicts/index.ts';

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
};

function parseMetadata(raw: string | null): (OperationMetadata & { group_id?: string }) | null {
	if (!raw) return null;
	try {
		return JSON.parse(raw) as OperationMetadata & { group_id?: string };
	} catch {
		return null;
	}
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

export const load: PageServerLoad = async ({ parent }) => {
	const { database } = await parent();
	const conflicts = pcdOpHistoryQueries.listLatestConflictsByDatabase(database.id);

	const rows: ConflictRow[] = conflicts.map(({ history, op }) => {
		const metadata = parseMetadata(op.metadata ?? null);
		const title = metadata?.title ?? metadata?.summary ?? formatTitle(metadata);

		return {
			opId: op.id,
			status: history.status,
			conflictReason: history.conflict_reason,
			appliedAt: history.applied_at,
			operation: metadata?.operation ?? 'update',
			entity: metadata?.entity ?? 'operation',
			name: metadata?.name ?? '',
			title,
			summary: metadata?.summary ?? null,
			origin: op.origin,
			groupId: typeof metadata?.group_id === 'string' ? metadata.group_id : null
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
