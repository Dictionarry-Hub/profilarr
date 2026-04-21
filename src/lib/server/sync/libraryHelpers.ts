import { pcdManager } from '$pcd/index.ts';
import * as qualityProfileQueries from '$pcd/entities/qualityProfiles/index.ts';

/**
 * Get all quality profile names from all enabled Profilarr databases
 */
export async function getProfilarrProfileNames(): Promise<Set<string>> {
	const profileNames = new Set<string>();
	const databases = pcdManager.getAll().filter((db) => db.enabled);

	for (const db of databases) {
		const dbCache = pcdManager.getCache(db.id);
		if (!dbCache?.isBuilt()) continue;

		try {
			const names = await qualityProfileQueries.names(dbCache);
			for (const name of names) {
				profileNames.add(name);
			}
		} catch {
			// Cache query failed, skip this database
		}
	}

	return profileNames;
}
