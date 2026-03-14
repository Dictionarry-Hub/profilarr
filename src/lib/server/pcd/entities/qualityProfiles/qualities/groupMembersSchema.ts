import type { Database } from '@jsr/db__sqlite';
import type { PCDCache } from '$pcd/index.ts';

type TableInfoRow = {
	name: string;
};

export function hasQualityGroupMembersPositionInCache(cache: PCDCache): boolean {
	const columns = cache.query<TableInfoRow>(`PRAGMA table_info('quality_group_members')`);
	return columns.some((column) => column.name === 'position');
}

export function hasQualityGroupMembersPositionInDb(db: Database): boolean {
	const columns = db.prepare(`PRAGMA table_info('quality_group_members')`).all() as TableInfoRow[];
	return columns.some((column) => column.name === 'position');
}
