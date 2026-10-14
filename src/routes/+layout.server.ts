import * as fs from 'node:fs/promises';
import type { LayoutServerLoad } from './$types';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import { isParserHealthy } from '$lib/server/utils/arr/parser/client.ts';
import { config } from '$lib/server/utils/config/config.ts';
import { build } from '$lib/shared/build.ts';
import { getVersionStatus, inbox } from '$announcements/index.ts';
import { generalSettingsQueries } from '$db/queries/generalSettings.ts';
import { isNotFound } from '$utils/fs.ts';

async function readPendingRestore(): Promise<{ filename: string } | null> {
	try {
		const path = (await fs.readFile(`${config.paths.base}/.restore-pending`, 'utf8')).trim();
		const filename = path.split('/').pop() || path;
		return { filename };
	} catch (err) {
		if (isNotFound(err)) return null;
		throw err;
	}
}

export const load: LayoutServerLoad = async () => {
	const arrInstances = arrInstancesQueries.getAll().map((i) => ({
		id: i.id,
		name: i.name,
		type: i.type
	}));

	const databases = databaseInstancesQueries.getAll().map((d) => ({
		id: d.id,
		name: d.name
	}));

	return {
		version: build.version,
		versionStatus: getVersionStatus(),
		timezone: config.timezone,
		// Nothing to log out of when login is off
		showLogout: config.authMode !== 'off',
		dateFormat: generalSettingsQueries.get()?.date_format ?? 'auto',
		arrInstances,
		databases,
		parserAvailable: await isParserHealthy(),
		unreadAnnouncements: inbox.getUnreadCount(),
		restorePending: await readPendingRestore()
	};
};
