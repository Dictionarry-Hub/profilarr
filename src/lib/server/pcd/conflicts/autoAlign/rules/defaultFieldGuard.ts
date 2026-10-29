import { AUTO_ALIGN_ENTITIES } from '#entities/registry.ts';
import { isFromTo, resolveCurrentRow, valuesEqual } from '#pcd/conflicts/autoAlign/shared.ts';
import type { UpdateRule } from '#pcd/conflicts/autoAlign/types.ts';

export const defaultFieldGuardRule: UpdateRule = {
	name: 'default_field_guard',
	matches: ({ desiredState }) => !!desiredState,
	shouldAlign: ({ db, entityName, metadata, desiredState }) => {
		if (!entityName || !desiredState) return false;

		const entityConfig = AUTO_ALIGN_ENTITIES.get(entityName);
		if (!entityConfig) return false;

		const fields = entityConfig.fields;
		if (!fields || fields.length === 0) return false;

		const keys = Object.keys(desiredState);
		if (keys.length === 0) return false;

		for (const key of keys) {
			if (!fields.includes(key)) return false;
			if (!isFromTo(desiredState[key])) return false;
		}

		const row = resolveCurrentRow(db, entityConfig, metadata, desiredState);
		if (!row) return false;

		return keys.every((key) => valuesEqual((desiredState[key] as { to: unknown }).to, row[key]));
	}
};
