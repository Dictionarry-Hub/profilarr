import { arrInstancesQueries, type ArrInstance } from '#db/queries/arrInstances.ts';
import { generalSettingsQueries } from '#db/queries/generalSettings.ts';
import { cleanupJobsForArrInstance } from '#server/jobs/cleanup.ts';
import { scheduleLibraryRefreshForInstance } from '#server/jobs/init.ts';
import { cache } from '#utils/cache/cache.ts';
import { requireSecretForDestinationChange } from '#utils/secretDestination.ts';
import { basicAuthPairError } from '#shared/arr/basicAuth.ts';
import { normalizeArrInstanceUrl } from '#shared/utils/arrUrl.ts';
import { logger } from '#logger/logger.ts';
import { getDefaultDelayProfile } from '#arr/defaults.ts';
import { arrClientOptionsFromInstance, createArrClient } from '#arr/factory.ts';
import { validateCreateInstanceInput, validateUpdateInstanceInput } from './validate.ts';
import { probeAndRecordVersion } from '#arr/version.ts';

const SOURCE = 'arr/instances';
const VERSION_PROBE_TIMEOUT_MS = 5000;

export type ArrInstanceFailureKind = 'invalid' | 'not_found' | 'conflict' | 'failed';

export interface ArrInstanceFailure {
	ok: false;
	kind: ArrInstanceFailureKind;
	message: string;
}

export type ArrInstanceResult =
	{ ok: true; instance: ArrInstance; basicAuthCleared: boolean } | ArrInstanceFailure;

export type ArrInstanceDeleteResult = { ok: true } | ArrInstanceFailure;

function failure(kind: ArrInstanceFailureKind, message: string): ArrInstanceFailure {
	return { ok: false, kind, message };
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function probeClientFor(instance: ArrInstance) {
	return createArrClient(
		instance.type as 'radarr' | 'sonarr',
		instance.url,
		instance.api_key,
		arrClientOptionsFromInstance(instance, { timeout: VERSION_PROBE_TIMEOUT_MS, retries: 0 })
	);
}

export async function createArrInstance(raw: Record<string, unknown>): Promise<ArrInstanceResult> {
	const validated = validateCreateInstanceInput(raw);
	if (!validated.ok) return failure('invalid', validated.error);

	const { input } = validated;

	if (arrInstancesQueries.nameExists(input.name)) {
		return failure('conflict', 'An instance with this name already exists');
	}

	if (arrInstancesQueries.targetExists(input.type, input.url)) {
		return failure('conflict', 'This instance target is already configured');
	}

	let created: ArrInstance | undefined;
	try {
		const id = arrInstancesQueries.create(input);
		created = arrInstancesQueries.getById(id);
	} catch (error) {
		await logger.error('Failed to create arr instance', {
			source: SOURCE,
			meta: { name: input.name, type: input.type, error: errorMessage(error) }
		});
		return failure('failed', 'Failed to create instance');
	}

	if (!created) return failure('failed', 'Failed to create instance');

	await logger.info(`Created new ${created.type} instance: ${created.name}`, {
		source: SOURCE,
		meta: { id: created.id, name: created.name, type: created.type, url: created.url }
	});

	// Record what the instance runs; a failed probe is logged, not fatal
	await probeAndRecordVersion(created, probeClientFor(created), SOURCE);

	await applyDefaultDelayProfileIfEnabled(created);

	return {
		ok: true,
		instance: arrInstancesQueries.getById(created.id) ?? created,
		basicAuthCleared: false
	};
}

/** Logged but never fatal: the instance exists either way. */
async function applyDefaultDelayProfileIfEnabled(instance: ArrInstance): Promise<void> {
	if (!generalSettingsQueries.shouldApplyDefaultDelayProfiles()) return;

	try {
		const client = createArrClient(
			instance.type as 'radarr' | 'sonarr',
			instance.url,
			instance.api_key,
			arrClientOptionsFromInstance(instance)
		);
		const defaultProfile = getDefaultDelayProfile(instance.type as 'radarr' | 'sonarr');

		// The default delay profile is id 1
		await client.updateDelayProfile(1, {
			...defaultProfile,
			id: 1,
			order: 2147483647 // Default profile order
		});

		await logger.info(`Applied default delay profile to ${instance.name}`, {
			source: SOURCE,
			meta: { id: instance.id, type: instance.type, profile: defaultProfile }
		});
	} catch (error) {
		await logger.warn(`Failed to apply default delay profile to ${instance.name}`, {
			source: SOURCE,
			meta: { id: instance.id, type: instance.type, error: errorMessage(error) }
		});
	}
}

export async function updateArrInstance(
	id: number,
	raw: Record<string, unknown>
): Promise<ArrInstanceResult> {
	const existing = arrInstancesQueries.getById(id);
	if (!existing) return failure('not_found', 'Instance not found');

	const validated = validateUpdateInstanceInput(raw);
	if (!validated.ok) return failure('invalid', validated.error);

	const { input } = validated;

	const urlChanged =
		input.url !== undefined &&
		normalizeArrInstanceUrl(input.url) !== normalizeArrInstanceUrl(existing.url);

	// The stored key is sent to the URL, so a new URL needs the key re-entered
	const guardError = requireSecretForDestinationChange({
		destinationChanged: urlChanged,
		storedSecret: existing.api_key,
		submittedSecret: input.apiKey,
		secretLabel: 'API key',
		destinationLabel: 'URL'
	});
	if (guardError) return failure('invalid', guardError);

	// Saved Basic Auth is sent to the URL, so a new URL drops it unless it is re-entered
	const keptOrDropped = (stored: string | null) => (urlChanged ? null : stored);
	const basicAuthUsername =
		input.basicAuthUsername !== undefined
			? input.basicAuthUsername
			: keptOrDropped(existing.basic_auth_username);
	const basicAuthPassword =
		input.basicAuthPassword !== undefined
			? input.basicAuthPassword
			: keptOrDropped(existing.basic_auth_password);

	const pairError = basicAuthPairError(!!basicAuthUsername, !!basicAuthPassword);
	if (pairError) return failure('invalid', pairError);

	if (input.name !== undefined && arrInstancesQueries.nameExists(input.name, id)) {
		return failure('conflict', 'An instance with this name already exists');
	}

	if (input.url !== undefined && arrInstancesQueries.targetExists(existing.type, input.url, id)) {
		return failure('conflict', 'This instance target is already configured');
	}

	const basicAuthCleared =
		!!(existing.basic_auth_username || existing.basic_auth_password) &&
		!basicAuthUsername &&
		!basicAuthPassword;

	try {
		arrInstancesQueries.update(id, { ...input, basicAuthUsername, basicAuthPassword });
		scheduleLibraryRefreshForInstance(id);
	} catch (error) {
		await logger.error('Failed to update arr instance', {
			source: SOURCE,
			meta: { id, error: errorMessage(error) }
		});
		return failure('failed', 'Failed to update instance');
	}

	const updated = arrInstancesQueries.getById(id);
	if (!updated) return failure('failed', 'Failed to update instance');

	// A new URL or key may point at a different server, so re-check what it runs
	if (urlChanged || input.apiKey !== undefined) {
		await probeAndRecordVersion(updated, probeClientFor(updated), SOURCE);
	}

	await logger.info(`Updated arr instance: ${updated.name}`, {
		source: SOURCE,
		meta: {
			id,
			name: updated.name,
			type: updated.type,
			url: updated.url,
			externalUrl: updated.external_url,
			libraryRefreshInterval: updated.library_refresh_interval,
			basicAuthCleared
		}
	});

	return { ok: true, instance: arrInstancesQueries.getById(id) ?? updated, basicAuthCleared };
}

export async function deleteArrInstance(id: number): Promise<ArrInstanceDeleteResult> {
	const existing = arrInstancesQueries.getById(id);
	if (!existing) return failure('not_found', 'Instance not found');

	try {
		cleanupJobsForArrInstance(id);
		const deleted = arrInstancesQueries.delete(id);
		if (!deleted) return failure('failed', 'Failed to delete instance');
		cache.delete(`library:${id}`);
	} catch (error) {
		await logger.error('Failed to delete arr instance', {
			source: SOURCE,
			meta: { id, name: existing.name, type: existing.type, error: errorMessage(error) }
		});
		return failure('failed', 'Failed to delete instance');
	}

	await logger.info(`Deleted ${existing.type} instance: ${existing.name}`, {
		source: SOURCE,
		meta: { id, name: existing.name, type: existing.type, url: existing.url }
	});

	return { ok: true };
}
