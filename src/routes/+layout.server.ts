import type { LayoutServerLoad } from './$types';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import { isParserHealthy } from '$lib/server/utils/arr/parser/client.ts';
import { config } from '$lib/server/utils/config/config.ts';
import { build } from '$lib/shared/build.ts';
import { getVersionStatus, inbox } from '$announcements/index.ts';

async function readPendingRestore(): Promise<{ filename: string } | null> {
	try {
		const path = (await Deno.readTextFile(`${config.paths.base}/.restore-pending`)).trim();
		const filename = path.split('/').pop() || path;
		return { filename };
	} catch (err) {
		if (err instanceof Deno.errors.NotFound) return null;
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
		arrInstances,
		databases,
		parserAvailable: await isParserHealthy(),
		unreadAnnouncements: inbox.getUnreadCount(),
		restorePending: await readPendingRestore()
	};
};
