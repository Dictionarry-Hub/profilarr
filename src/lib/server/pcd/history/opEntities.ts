/**
 * Builds pcd_op_entities rows from op metadata. Migration 077's backfill
 * applies the same rules in SQL, including empty string = absent, so a
 * change here needs the same change there.
 */

import type { OpEntityRow } from '$db/queries/pcdOpEntities.ts';
import type { PcdOpHistoryStatus } from '$db/queries/pcdOpHistory.ts';
import type { OperationMetadata } from '../core/types.ts';

/** Stable-key names whose entity is implied when a dependency omits it. */
const ENTITY_BY_STABLE_KEY: Readonly<Record<string, string>> = {
	custom_format_name: 'custom_format',
	quality_profile_name: 'quality_profile',
	regular_expression_name: 'regular_expression'
};

/**
 * Target rule: a rename targets its new name and records the old one; any
 * other op targets its stable key, falling back to its name.
 */
export function targetNameOf(
	metadata: Pick<OperationMetadata, 'name' | 'previousName' | 'stableKey'>
): string {
	if (metadata.previousName) return metadata.name;
	return metadata.stableKey?.value || metadata.name;
}

export function entityRowsFromMetadata(metadata: OperationMetadata): OpEntityRow[] {
	const rows: OpEntityRow[] = [];
	const seen = new Set<string>();
	const push = (row: OpEntityRow) => {
		const key = `${row.role}\u0000${row.entity}\u0000${row.name}`;
		if (seen.has(key)) return;
		seen.add(key);
		rows.push(row);
	};

	const target = targetNameOf(metadata);
	if (metadata.entity && target) {
		push({
			entity: metadata.entity,
			name: target,
			previousName: metadata.previousName || null,
			role: 'target'
		});
	}

	for (const dep of metadata.dependsOn ?? []) {
		const entity = dep.entity || ENTITY_BY_STABLE_KEY[dep.key];
		if (!entity || !dep.value) continue;
		push({ entity, name: dep.value, previousName: null, role: 'prerequisite' });
	}

	return rows;
}

/** `entity:name` identity key. */
export function entityKey(entity: string, name: string): string {
	return `${entity}:${name}`;
}

const NOT_APPLIED: ReadonlySet<string> = new Set<PcdOpHistoryStatus>([
	'conflicted',
	'conflicted_pending',
	'error'
]);

/** An op whose latest compile left it in one of these didn't apply. */
export const didNotApply = (status: PcdOpHistoryStatus | null) =>
	status !== null && NOT_APPLIED.has(status);
