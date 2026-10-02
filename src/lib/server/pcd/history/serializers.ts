/**
 * Snapshot serializer dispatch. Import it dynamically from the cache: a static
 * import closes a cycle through the $pcd barrel (compiler.ts loads
 * conflicts/override.ts the same way, for the same reason).
 */

import type { Kysely } from 'kysely';
import type { PCDCache } from '$pcd/index.ts';
import type { PCDDatabase } from '$shared/pcd/types.ts';
import {
	serializeCustomFormat,
	serializeQualityProfile,
	serializeRegularExpression
} from '../entities/serialize.ts';
import type { RawSqlite, SnapshotEntity } from './capture.ts';

/**
 * PCDCache.query() refuses until the build completes, but quality profile
 * serialization calls it. Entity code only uses kb and query, so this view
 * covers every serializer.
 */
export function midBuildCacheView(db: RawSqlite, kb: Kysely<PCDDatabase>): PCDCache {
	const view = {
		kb,
		query: <T>(sql: string, ...params: unknown[]): T[] => db.prepare(sql).all(...params) as T[]
	};
	return view as unknown as PCDCache;
}

export function serializeForSnapshot(
	cache: PCDCache,
	entity: SnapshotEntity,
	name: string
): Promise<unknown> {
	switch (entity) {
		case 'quality_profile':
			return serializeQualityProfile(cache, name);
		case 'custom_format':
			return serializeCustomFormat(cache, name);
		case 'regular_expression':
			return serializeRegularExpression(cache, name);
	}
}
