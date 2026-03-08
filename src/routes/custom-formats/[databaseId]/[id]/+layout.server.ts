import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { pcdManager } from '$pcd/core/manager.ts';
import { isParserHealthy } from '$lib/server/utils/arr/parser/client.ts';

export const load: LayoutServerLoad = async ({ params }) => {
	const databaseId = parseInt(params.databaseId, 10);
	const formatId = parseInt(params.id, 10);

	if (isNaN(databaseId) || isNaN(formatId)) {
		error(400, 'Invalid parameters');
	}

	const database = pcdManager.getByIdPublic(databaseId);
	if (!database) error(404, 'Database not found');

	const cache = pcdManager.getCache(databaseId);
	if (!cache) error(500, 'Database cache not available');

	const format = await cache.kb
		.selectFrom('custom_formats')
		.select(['id', 'name'])
		.where('id', '=', formatId)
		.executeTakeFirst();

	if (!format) error(404, 'Custom format not found');

	return {
		databaseName: database.name,
		formatName: format.name,
		parserAvailable: await isParserHealthy()
	};
};
