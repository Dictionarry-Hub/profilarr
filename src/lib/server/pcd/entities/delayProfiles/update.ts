/**
 * Update a delay profile operation
 */

import type { PCDCache } from '$pcd/index.ts';
import { writeOperation, type OperationLayer, type WriteResult } from '$pcd/index.ts';
import type { DelayProfilesRow, PreferredProtocol } from '$shared/pcd/display.ts';
import { logger } from '$logger/logger.ts';
import { uuid } from '$shared/utils/uuid.ts';
import type { CompiledQuery } from 'kysely';

interface UpdateDelayProfileInput {
	name: string;
	preferredProtocol: PreferredProtocol;
	usenetDelay: number;
	torrentDelay: number;
	bypassIfHighestQuality: boolean;
	bypassIfAboveCfScore: boolean;
	minimumCfScore: number;
}

interface UpdateDelayProfileOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	/** The current profile data (for value guards) */
	current: DelayProfilesRow;
	/** The new values */
	input: UpdateDelayProfileInput;
}

type DelayProfileField =
	| 'name'
	| 'preferred_protocol'
	| 'usenet_delay'
	| 'torrent_delay'
	| 'bypass_if_highest_quality'
	| 'bypass_if_above_custom_format_score'
	| 'minimum_custom_format_score';

interface FieldChange {
	field: DelayProfileField;
	from: unknown;
	to: unknown;
	setValue: unknown;
	guardValue: unknown;
}

/**
 * Update a delay profile by writing an operation to the specified layer
 * Uses value guards to detect conflicts with upstream changes
 */
export async function update(options: UpdateDelayProfileOptions) {
	const { databaseId, cache, layer, current, input } = options;
	const db = cache.kb;

	if (input.name !== current.name) {
		const existing = await db
			.selectFrom('delay_profiles')
			.where((eb) => eb(eb.fn('lower', [eb.ref('name')]), '=', input.name.toLowerCase()))
			.select('name')
			.executeTakeFirst();

		if (existing) {
			await logger.warn(`Duplicate delay profile name "${input.name}"`, {
				source: 'DelayProfile',
				meta: { databaseId, name: input.name }
			});
			throw new Error(`A delay profile with name "${input.name}" already exists`);
		}
	}

	// Determine delay values based on protocol (schema has CHECK constraints)
	// only_torrent -> usenet_delay must be NULL
	// only_usenet -> torrent_delay must be NULL
	const usenetDelay = input.preferredProtocol === 'only_torrent' ? null : input.usenetDelay;
	const torrentDelay = input.preferredProtocol === 'only_usenet' ? null : input.torrentDelay;

	// minimum_custom_format_score must be NULL if bypass_if_above_custom_format_score is false
	const minimumCfScore = input.bypassIfAboveCfScore ? input.minimumCfScore : null;

	const changes: FieldChange[] = [];

	if (current.name !== input.name) {
		changes.push({
			field: 'name',
			from: current.name,
			to: input.name,
			setValue: input.name,
			guardValue: current.name
		});
	}
	if (current.preferred_protocol !== input.preferredProtocol) {
		changes.push({
			field: 'preferred_protocol',
			from: current.preferred_protocol,
			to: input.preferredProtocol,
			setValue: input.preferredProtocol,
			guardValue: current.preferred_protocol
		});
	}
	if (current.usenet_delay !== usenetDelay) {
		changes.push({
			field: 'usenet_delay',
			from: current.usenet_delay,
			to: usenetDelay,
			setValue: usenetDelay,
			guardValue: current.usenet_delay
		});
	}
	if (current.torrent_delay !== torrentDelay) {
		changes.push({
			field: 'torrent_delay',
			from: current.torrent_delay,
			to: torrentDelay,
			setValue: torrentDelay,
			guardValue: current.torrent_delay
		});
	}
	if (current.bypass_if_highest_quality !== input.bypassIfHighestQuality) {
		changes.push({
			field: 'bypass_if_highest_quality',
			from: current.bypass_if_highest_quality,
			to: input.bypassIfHighestQuality,
			setValue: input.bypassIfHighestQuality ? 1 : 0,
			guardValue: current.bypass_if_highest_quality ? 1 : 0
		});
	}
	if (current.bypass_if_above_custom_format_score !== input.bypassIfAboveCfScore) {
		changes.push({
			field: 'bypass_if_above_custom_format_score',
			from: current.bypass_if_above_custom_format_score,
			to: input.bypassIfAboveCfScore,
			setValue: input.bypassIfAboveCfScore ? 1 : 0,
			guardValue: current.bypass_if_above_custom_format_score ? 1 : 0
		});
	}
	if (current.minimum_custom_format_score !== minimumCfScore) {
		changes.push({
			field: 'minimum_custom_format_score',
			from: current.minimum_custom_format_score,
			to: minimumCfScore,
			setValue: minimumCfScore,
			guardValue: current.minimum_custom_format_score
		});
	}

	if (changes.length === 0) {
		return { success: true };
	}

	await logger.info(`Save delay profile "${input.name}"`, {
		source: 'DelayProfile',
		meta: {
			id: current.id,
			changes
		}
	});

	const opGroups = groupChanges(changes, current, usenetDelay, torrentDelay, minimumCfScore);
	const groupId = opGroups.length > 1 ? uuid() : undefined;
	const operations = opGroups.map((opChanges) => {
		const fields = opChanges.map((change) => change.field);
		const isRename = fields.length === 1 && fields[0] === 'name';

		return {
			fields,
			isRename,
			queries: [buildUpdateQuery(cache, current, opChanges)],
			desiredState: buildDesiredState(opChanges)
		};
	});
	let lastResult: WriteResult | null = null;

	for (const operation of operations) {
		const result = await writeOperation({
			databaseId,
			layer,
			description: `update-delay-profile-${operation.fields.join('-')}-${input.name}`,
			queries: operation.queries,
			desiredState: operation.desiredState,
			metadata: {
				operation: 'update',
				entity: 'delay_profile',
				name: input.name,
				...(operation.isRename && { previousName: current.name }),
				stableKey: { key: 'delay_profile_name', value: current.name },
				...(groupId && { groupId }),
				changedFields: operation.fields,
				summary: operation.isRename ? 'Rename delay profile' : 'Update delay profile',
				title: operation.isRename
					? `Rename delay profile "${current.name}"`
					: `Update delay profile "${input.name}"`
			}
		});

		if (!result.success) {
			return result;
		}
		lastResult = result;
	}

	return lastResult ?? { success: true };
}

function groupChanges(
	changes: FieldChange[],
	current: DelayProfilesRow,
	usenetDelay: number | null,
	torrentDelay: number | null,
	minimumCfScore: number | null
): FieldChange[][] {
	const byField = new Map<DelayProfileField, FieldChange>();
	for (const change of changes) {
		byField.set(change.field, change);
	}

	const groups: FieldChange[][] = [];
	const used = new Set<DelayProfileField>();
	const protocolChange = byField.get('preferred_protocol');

	if (protocolChange) {
		const protocolFields: DelayProfileField[] = ['preferred_protocol'];
		if (current.usenet_delay === null || usenetDelay === null) {
			protocolFields.push('usenet_delay');
		}
		if (current.torrent_delay === null || torrentDelay === null) {
			protocolFields.push('torrent_delay');
		}
		addGroup(groups, used, byField, protocolFields);
	}

	addSingle(groups, used, byField, 'usenet_delay');
	addSingle(groups, used, byField, 'torrent_delay');
	addSingle(groups, used, byField, 'bypass_if_highest_quality');

	const bypassChange = byField.get('bypass_if_above_custom_format_score');
	if (bypassChange) {
		const bypassFields: DelayProfileField[] = ['bypass_if_above_custom_format_score'];
		if (current.minimum_custom_format_score === null || minimumCfScore === null) {
			bypassFields.push('minimum_custom_format_score');
		}
		addGroup(groups, used, byField, bypassFields);
	}

	addSingle(groups, used, byField, 'minimum_custom_format_score');
	addSingle(groups, used, byField, 'name');

	for (const change of changes) {
		if (!used.has(change.field)) {
			groups.push([change]);
		}
	}

	return groups;
}

function addSingle(
	groups: FieldChange[][],
	used: Set<DelayProfileField>,
	byField: Map<DelayProfileField, FieldChange>,
	field: DelayProfileField
) {
	addGroup(groups, used, byField, [field]);
}

function addGroup(
	groups: FieldChange[][],
	used: Set<DelayProfileField>,
	byField: Map<DelayProfileField, FieldChange>,
	fields: DelayProfileField[]
) {
	const group = fields
		.filter((field) => !used.has(field))
		.map((field) => byField.get(field))
		.filter((change): change is FieldChange => !!change);

	if (group.length === 0) return;
	for (const change of group) {
		used.add(change.field);
	}
	groups.push(group);
}

function buildDesiredState(changes: FieldChange[]): Record<string, unknown> {
	const desiredState: Record<string, unknown> = {};
	for (const change of changes) {
		desiredState[change.field] = { from: change.from, to: change.to };
	}
	return desiredState;
}

function buildUpdateQuery(
	cache: PCDCache,
	current: DelayProfilesRow,
	changes: FieldChange[]
): CompiledQuery {
	const db = cache.kb;
	const setValues: Record<string, unknown> = {};
	for (const change of changes) {
		setValues[change.field] = change.setValue;
	}

	let query = db.updateTable('delay_profiles').set(setValues).where('name', '=', current.name);

	for (const change of changes) {
		if (change.field === 'name') continue;
		if (change.guardValue === null) {
			query = query.where(change.field, 'is', null);
		} else {
			query = query.where(change.field, '=', change.guardValue as never);
		}
	}

	return query.compile();
}
