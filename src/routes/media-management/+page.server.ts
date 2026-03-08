import type { ServerLoad } from '@sveltejs/kit';
import { pcdManager } from '$pcd/core/manager.ts';
import { redirectToLastDatabase, getLastSection } from '$utils/redirect/lastDatabase.ts';

const ALLOWED_SECTIONS = new Set(['naming', 'media-settings', 'quality-definitions']);

export const load: ServerLoad = ({ cookies, url }) => {
	// URL query param takes priority, then cookie, then fallback
	const rawSection = url.searchParams.get('section');
	const sectionFromUrl = rawSection ? ALLOWED_SECTIONS.has(rawSection) : false;
	const section = sectionFromUrl
		? rawSection!
		: getLastSection(cookies, 'last_section_mm', ALLOWED_SECTIONS, 'naming');

	redirectToLastDatabase(cookies, 'last_db_mm', '/media-management', {
		suffix: `/${section}`
	});

	return {
		databases: pcdManager.getAllPublic()
	};
};
