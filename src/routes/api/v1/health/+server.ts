/**
 * GET /api/v1/health
 *
 * Public health check — returns only status and timestamp.
 * No version, uptime, or component details (those are in /health/diagnostics).
 * Used by uptime monitors and load balancers.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { components } from '$api/v1';
import { db } from '$db/db.ts';
import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import { getCache } from '$pcd/database/registry.ts';

type HealthCheckResponse = components['schemas']['HealthCheckResponse'];
type HealthStatus = components['schemas']['HealthStatus'];

export const GET: RequestHandler = async () => {
	const status = determineStatus();

	const response: HealthCheckResponse = {
		status,
		timestamp: new Date().toISOString()
	};

	const httpStatus = status === 'unhealthy' ? 503 : 200;
	return json(response, { status: httpStatus });
};

/**
 * Quick status check without exposing details.
 * Checks the two things that make the system unhealthy: DB and repos.
 */
function determineStatus(): HealthStatus {
	// SQLite health
	try {
		db.queryFirst('SELECT 1');
	} catch {
		return 'unhealthy';
	}

	// Repo health
	try {
		const allDatabases = databaseInstancesQueries.getAll();
		const enabled = allDatabases.filter((d) => d.enabled === 1);

		if (allDatabases.length > 0 && enabled.length === 0) {
			return 'unhealthy';
		}

		if (enabled.length > 0) {
			const disabled = allDatabases.filter((d) => d.enabled === 0);
			if (disabled.length > 0) return 'degraded';

			let cachedCount = 0;
			for (const dbInstance of enabled) {
				const cache = getCache(dbInstance.id);
				if (cache?.isBuilt()) cachedCount++;
			}
			if (cachedCount < enabled.length) return 'degraded';
		}
	} catch {
		return 'unhealthy';
	}

	return 'healthy';
}
