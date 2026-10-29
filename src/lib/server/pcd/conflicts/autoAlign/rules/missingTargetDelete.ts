import { isMissingTargetRow } from '#pcd/conflicts/autoAlign/shared.ts';
import type { DeleteRule } from '#pcd/conflicts/autoAlign/types.ts';

export const missingTargetDeleteRule: DeleteRule = {
	name: 'missing_target',
	matches: ({ entityName }) => !!entityName,
	shouldAlign: ({ db, entityName, metadata }) => isMissingTargetRow(db, entityName, metadata)
};
