/**
 * Custom format syncer
 * Syncs custom formats from PCD to arr instances
 *
 * This is a helper syncer used by quality profiles - custom formats must be
 * synced before quality profiles since profiles reference format IDs.
 */

import type { BaseArrClient } from '#arr/base.ts';
import { logger } from '#logger/logger.ts';
import type { SyncArrType } from '#server/sync/mappings.ts';
import { transformCustomFormat, type PcdCustomFormat } from './transformer.ts';

/**
 * Sync custom formats to an arr instance.
 *
 * @returns Map of PCD format name → arr format ID.
 *          The caller uses this to resolve CF scores in quality profiles.
 */
export async function syncCustomFormats(
	client: BaseArrClient,
	instanceId: number,
	instanceType: SyncArrType,
	pcdFormats: Map<string, PcdCustomFormat>
): Promise<Map<string, number>> {
	const existingFormats = await client.getCustomFormats();
	const existingMap = new Map(existingFormats.map((f) => [f.name, f.id!]));

	const formatIdMap = new Map<string, number>();

	for (const [pcdName, pcdFormat] of pcdFormats) {
		const arrFormat = transformCustomFormat(pcdFormat, instanceType);
		arrFormat.name = pcdName;

		await logger.debug(`Compiled custom format "${pcdName}"`, {
			source: 'Compile:CustomFormat',
			meta: {
				instanceId,
				pcdName,
				format: arrFormat
			}
		});

		try {
			if (existingMap.has(pcdName)) {
				// Update existing
				const existingId = existingMap.get(pcdName)!;
				arrFormat.id = existingId;
				await client.updateCustomFormat(existingId, arrFormat);
				formatIdMap.set(pcdName, existingId);
				await logger.debug(`Updated custom format "${pcdName}"`, {
					source: 'Sync:CustomFormats',
					meta: { instanceId, formatId: existingId, pcdName }
				});
			} else {
				// Create new
				const response = await client.createCustomFormat(arrFormat);
				existingMap.set(pcdName, response.id!);
				formatIdMap.set(pcdName, response.id!);
				await logger.debug(`Created custom format "${pcdName}"`, {
					source: 'Sync:CustomFormats',
					meta: { instanceId, formatId: response.id, pcdName }
				});
			}
		} catch (error) {
			const errorDetails = extractErrorDetails(error);
			await logger.error(`Failed to sync custom format "${pcdName}"`, {
				source: 'Sync:CustomFormats',
				meta: {
					instanceId,
					pcdName,
					request: arrFormat,
					...errorDetails
				}
			});
		}
	}

	// Include all existing CFs so the QP transformer can list every CF with score 0
	// (arr validation requires every CF on the instance to appear in the profile's formatItems)
	for (const [name, id] of existingMap) {
		if (!formatIdMap.has(name)) {
			formatIdMap.set(name, id);
		}
	}

	return formatIdMap;
}

/**
 * Extract error details from HTTP errors for logging
 */
function extractErrorDetails(error: unknown): Record<string, unknown> {
	const details: Record<string, unknown> = {
		error: error instanceof Error ? error.message : 'Unknown error'
	};

	if (error && typeof error === 'object') {
		const err = error as Record<string, unknown>;
		if ('status' in err) details.status = err.status;
		if ('statusText' in err) details.statusText = err.statusText;
		if ('response' in err) details.response = err.response;
		if ('body' in err) details.responseBody = err.body;
		if ('data' in err) details.responseData = err.data;
		if (err.cause) details.cause = err.cause;
	}

	return details;
}
