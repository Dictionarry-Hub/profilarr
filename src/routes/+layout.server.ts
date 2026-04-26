import type { LayoutServerLoad } from './$types';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import { isParserHealthy } from '$lib/server/utils/arr/parser/client.ts';
import { config } from '$lib/server/utils/config/config.ts';
import { build } from '$lib/shared/build.ts';
import { getUnreadCount } from '$announcements/index.ts';

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
		timezone: config.timezone,
		arrInstances,
		databases,
		parserAvailable: await isParserHealthy(),
		unreadAnnouncements: getUnreadCount()
	};
};
