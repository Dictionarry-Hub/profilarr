import { arrInstancesQueries, type ArrInstance } from '$db/queries/arrInstances.ts';
import { logger } from '$logger/logger.ts';
import type { BaseArrClient } from './base.ts';
import type { ArrVersionInfo } from './types.ts';

export type VersionProbeTarget = Pick<
	ArrInstance,
	'id' | 'name' | 'type' | 'detected_version' | 'detected_api'
>;

/**
 * Probe the instance for its version and current API generation and store
 * the answer on its row. Never throws: a failed probe is logged and leaves the
 * stored values alone, so a Sonarr that is still starting does not erase what
 * the last successful probe learned.
 *
 * Runs wherever a client is about to read or write config, so the stored
 * value tracks upgrades and rollbacks without the user telling Profilarr.
 *
 * @returns what the probe learned, or null if it failed
 */
export async function probeAndRecordVersion(
	instance: VersionProbeTarget,
	client: BaseArrClient,
	source: string
): Promise<ArrVersionInfo | null> {
	let info: ArrVersionInfo;
	try {
		info = await client.detectVersion();
	} catch (error) {
		await logger.warn(`Version check failed for ${instance.name}`, {
			source,
			meta: {
				instanceId: instance.id,
				error: error instanceof Error ? error.message : String(error)
			}
		});
		return null;
	}

	const changed =
		info.version !== instance.detected_version || info.currentApi !== instance.detected_api;

	arrInstancesQueries.updateDetectedVersion(instance.id, {
		version: info.version,
		api: info.currentApi
	});

	if (changed) {
		await logger.info(
			`Detected ${info.appName} ${info.version} (API ${info.currentApi ?? 'unknown'}) for ${instance.name}`,
			{
				source,
				meta: {
					instanceId: instance.id,
					type: instance.type,
					version: info.version,
					api: info.currentApi,
					previousVersion: instance.detected_version,
					previousApi: instance.detected_api
				}
			}
		);
	}

	return info;
}

/**
 * The instance as the probe just saw it. `probeAndRecordVersion` writes the
 * row but does not touch the object the caller already holds, so code that
 * branches on the version in the same request must use this copy. A failed
 * probe (null) returns the instance unchanged.
 */
export function withDetectedVersion<T extends VersionProbeTarget>(
	instance: T,
	info: ArrVersionInfo | null
): T {
	if (!info) return instance;
	return {
		...instance,
		detected_version: info.version,
		detected_api: info.currentApi,
		detected_at: new Date().toISOString()
	};
}
