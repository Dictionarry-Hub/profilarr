import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { pcdManager } from '$pcd/core/manager.ts';
import { canWriteToBase } from '$pcd/ops/writer.ts';
import { setLastDatabase, setLastSection } from '$utils/redirect/lastDatabase.ts';

const ALLOWED_SECTIONS = new Set(['naming', 'media-settings', 'quality-definitions']);

export const load: LayoutServerLoad = async ({ params, cookies, url }) => {
	const { databaseId } = params;

	if (!databaseId) {
		throw error(400, 'Missing database ID');
	}

	const databases = pcdManager.getAllPublic();
	const currentDatabaseId = parseInt(databaseId, 10);

	if (isNaN(currentDatabaseId)) {
		throw error(400, 'Invalid database ID');
	}

	const currentDatabase = databases.find((db) => db.id === currentDatabaseId);
	if (!currentDatabase) {
		throw error(404, 'Database not found');
	}

	setLastDatabase(cookies, 'last_db_mm', currentDatabaseId);

	// Persist section from URL path
	const sectionMatch = url.pathname.match(/\/media-management\/\d+\/([^/]+)/);
	if (sectionMatch && ALLOWED_SECTIONS.has(sectionMatch[1])) {
		setLastSection(cookies, 'last_section_mm', sectionMatch[1]);
	}

	return {
		databases,
		currentDatabase,
		canWriteToBase: canWriteToBase(currentDatabaseId)
	};
};
