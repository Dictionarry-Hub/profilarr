import type { OperationMetadata } from '../core/types.ts';

/** Stored JSON form of op metadata. */
export function buildMetadataJson(metadata?: OperationMetadata): string | null {
	if (!metadata) return null;
	const payload: Record<string, unknown> = {
		operation: metadata.operation,
		entity: metadata.entity,
		name: metadata.name
	};
	if (metadata.previousName) {
		payload.previousName = metadata.previousName;
	}
	if (metadata.qualityName) {
		payload.qualityName = metadata.qualityName;
	}
	if (metadata.summary) {
		payload.summary = metadata.summary;
	}
	if (metadata.title) {
		payload.title = metadata.title;
	}
	if (metadata.changedFields && metadata.changedFields.length > 0) {
		payload.changed_fields = metadata.changedFields;
	}
	if (metadata.stableKey) {
		payload.stable_key = metadata.stableKey;
	}
	if (metadata.groupId) {
		payload.group_id = metadata.groupId;
	}
	if (metadata.generated) {
		payload.generated = true;
	}
	if (metadata.dependsOn && metadata.dependsOn.length > 0) {
		payload.depends_on = metadata.dependsOn;
	}
	return JSON.stringify(payload);
}
