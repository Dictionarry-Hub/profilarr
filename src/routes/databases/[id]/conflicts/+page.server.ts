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
	/** All op IDs in this conflict group (for batch resolution) */
	groupOpIds: number[];
	/** Number of collapsed intermediate conflicts */
	collapsedCount: number;
};

function parseMetadata(raw: string | null): OperationMetadata | null {
	if (!raw) return null;
	try {
		return JSON.parse(raw) as OperationMetadata;
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
			groupOpIds: [op.id],
			collapsedCount: 0
		};
	});

	return {
		conflictStrategy: database.conflict_strategy ?? 'override',
		conflicts: rows
	};
};

function parseGroupOpIds(formData: FormData): number[] {
	const raw = formData.get('groupOpIds');
	if (!raw || typeof raw !== 'string') return [];
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((id): id is number => typeof id === 'number' && Number.isFinite(id));
	} catch {
		return [];
	}
}

export const actions: Actions = {
	align: async ({ request, params }) => {
		const databaseId = Number(params.id);
		if (!Number.isFinite(databaseId)) {
			return fail(400, { error: 'Invalid database id' });
		}

		const formData = await request.formData();
		const groupOpIds = parseGroupOpIds(formData);
		if (groupOpIds.length === 0) {
			const opId = Number(formData.get('opId'));
			if (!Number.isFinite(opId)) {
				return fail(400, { error: 'Invalid operation id' });
			}
			groupOpIds.push(opId);
		}

		// Align all ops in the group
		for (const opId of groupOpIds) {
			const result = await alignConflict({ databaseId, opId });
			if (!result.success) {
				return fail(400, { error: result.error || 'Failed to align conflict' });
			}
		}

		return { success: true };
	},
	override: async ({ request, params }) => {
		const databaseId = Number(params.id);
		if (!Number.isFinite(databaseId)) {
			return fail(400, { error: 'Invalid database id' });
		}

		const formData = await request.formData();
		const groupOpIds = parseGroupOpIds(formData);
		if (groupOpIds.length === 0) {
			const opId = Number(formData.get('opId'));
			if (!Number.isFinite(opId)) {
				return fail(400, { error: 'Invalid operation id' });
			}
			groupOpIds.push(opId);
		}

		// Override sequentially, oldest first — each resolution may cascade-fix the next
		for (const opId of groupOpIds) {
			const result = await overrideConflict({ databaseId, opId });
			if (!result.success) {
				// Op may have auto-resolved from a prior override in this batch — skip
				continue;
			}
		}

		return { success: true };
	}
};
