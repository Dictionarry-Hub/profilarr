/**
 * Update media settings config operations
 */

import type { PCDCache, WriteResult } from '$pcd/index.ts';
import { writeOperation, type OperationLayer } from '$pcd/index.ts';
import type { RadarrMediaSettingsRow, SonarrMediaSettingsRow } from '$shared/pcd/display.ts';
import { uuid } from '$shared/utils/uuid.ts';
import type { CompiledQuery } from 'kysely';

export interface UpdateMediaSettingsInput {
	name: string;
	propersRepacks: RadarrMediaSettingsRow['propers_repacks'];
	enableMediaInfo: boolean;
}

type MediaSettingsTable = 'radarr_media_settings' | 'sonarr_media_settings';
type MediaSettingsField = 'name' | 'propers_repacks' | 'enable_media_info';
type MediaSettingsRow = Pick<
	RadarrMediaSettingsRow,
	'name' | 'propers_repacks' | 'enable_media_info'
>;

interface MediaSettingsConfig {
	table: MediaSettingsTable;
	entity: MediaSettingsTable;
	stableKey: string;
	arrType: 'radarr' | 'sonarr';
	label: 'Radarr' | 'Sonarr';
}

interface FieldChange {
	field: MediaSettingsField;
	from: unknown;
	to: unknown;
	setValue: unknown;
	guardValue: unknown;
}

const RADARR_CONFIG: MediaSettingsConfig = {
	table: 'radarr_media_settings',
	entity: 'radarr_media_settings',
	stableKey: 'radarr_media_settings_name',
	arrType: 'radarr',
	label: 'Radarr'
};

const SONARR_CONFIG: MediaSettingsConfig = {
	table: 'sonarr_media_settings',
	entity: 'sonarr_media_settings',
	stableKey: 'sonarr_media_settings_name',
	arrType: 'sonarr',
	label: 'Sonarr'
};

export interface UpdateMediaSettingsOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	current: RadarrMediaSettingsRow;
	input: UpdateMediaSettingsInput;
}

export async function updateRadarrMediaSettings(options: UpdateMediaSettingsOptions) {
	return updateMediaSettings({ ...options, config: RADARR_CONFIG });
}

export interface UpdateSonarrMediaSettingsOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	current: SonarrMediaSettingsRow;
	input: UpdateMediaSettingsInput;
}

export async function updateSonarrMediaSettings(options: UpdateSonarrMediaSettingsOptions) {
	return updateMediaSettings({ ...options, config: SONARR_CONFIG });
}

async function updateMediaSettings(options: {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	current: MediaSettingsRow;
	input: UpdateMediaSettingsInput;
	config: MediaSettingsConfig;
}): Promise<WriteResult> {
	const { databaseId, cache, layer, current, input, config } = options;
	const db = cache.kb;

	if (input.name !== current.name) {
		const existing = await db
			.selectFrom(config.table)
			.where((eb) => eb(eb.fn('lower', [eb.ref('name')]), '=', input.name.toLowerCase()))
			.select('name')
			.executeTakeFirst();

		if (existing) {
			throw new Error(`A ${config.arrType} media settings config with name "${input.name}" already exists`);
		}
	}

	const changes: FieldChange[] = [];

	if (current.propers_repacks !== input.propersRepacks) {
		changes.push({
			field: 'propers_repacks',
			from: current.propers_repacks,
			to: input.propersRepacks,
			setValue: input.propersRepacks,
			guardValue: current.propers_repacks
		});
	}
	if (current.enable_media_info !== input.enableMediaInfo) {
		changes.push({
			field: 'enable_media_info',
			from: current.enable_media_info,
			to: input.enableMediaInfo,
			setValue: input.enableMediaInfo ? 1 : 0,
			guardValue: current.enable_media_info ? 1 : 0
		});
	}
	if (current.name !== input.name) {
		changes.push({
			field: 'name',
			from: current.name,
			to: input.name,
			setValue: input.name,
			guardValue: current.name
		});
	}

	if (changes.length === 0) {
		return { success: true };
	}

	const groupId = changes.length > 1 ? uuid() : undefined;
	let lastResult: WriteResult | null = null;

	for (let index = 0; index < changes.length; index++) {
		const change = changes[index];
		const isRename = change.field === 'name';
		const result = await writeOperation({
			databaseId,
			layer,
			description: `update-${config.arrType}-media-settings-${change.field}-${input.name}`,
			queries: [buildUpdateQuery(cache, config.table, current, change)],
			desiredState: {
				[change.field]: { from: change.from, to: change.to }
			},
			metadata: {
				operation: 'update',
				entity: config.entity,
				name: input.name,
				...(isRename && { previousName: current.name }),
				stableKey: { key: config.stableKey, value: current.name },
				...(groupId && { groupId }),
				changedFields: [change.field],
				summary: isRename
					? `Rename ${config.label} media settings`
					: `Update ${config.label} media settings`,
				title: isRename
					? `Rename ${config.label} media settings "${current.name}"`
					: `Update ${config.label} media settings "${input.name}"`
			},
			skipRecompile: index < changes.length - 1
		});

		if (!result.success) {
			return result;
		}
		lastResult = result;
	}

	return lastResult ?? { success: true };
}

function buildUpdateQuery(
	cache: PCDCache,
	table: MediaSettingsTable,
	current: MediaSettingsRow,
	change: FieldChange
): CompiledQuery {
	if (table === 'radarr_media_settings') {
		const setValues: Record<string, unknown> = { [change.field]: change.setValue };
		let query = cache.kb
			.updateTable('radarr_media_settings')
			.set(setValues)
			.where('name', '=', current.name);

		if (change.field !== 'name') {
			query = query.where(change.field, '=', change.guardValue as never);
		}

		return query.compile();
	}

	const setValues: Record<string, unknown> = { [change.field]: change.setValue };
	let query = cache.kb
		.updateTable('sonarr_media_settings')
		.set(setValues)
		.where('name', '=', current.name);

	if (change.field !== 'name') {
		query = query.where(change.field, '=', change.guardValue as never);
	}

	return query.compile();
}
