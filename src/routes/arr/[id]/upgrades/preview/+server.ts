import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import type { FilterConfig } from '$shared/upgrades/filters.ts';
import { previewUpgradeFilter } from '$lib/server/upgrades/preview.ts';

function isFilterConfig(value: unknown): value is FilterConfig {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const filter = value as Partial<FilterConfig>;
	return (
		typeof filter.id === 'string' &&
		typeof filter.name === 'string' &&
		typeof filter.enabled === 'boolean' &&
		typeof filter.selector === 'string' &&
		typeof filter.count === 'number' &&
		typeof filter.cutoff === 'number' &&
		!!filter.group &&
		typeof filter.group === 'object'
	);
}

export const POST: RequestHandler = async ({ params, request }) => {
	const instanceId = parseInt(params.id ?? '', 10);
	if (!Number.isFinite(instanceId)) {
		return json({ error: 'Invalid instance ID' }, { status: 400 });
	}

	const instance = arrInstancesQueries.getById(instanceId);
	if (!instance) {
		return json({ error: 'Instance not found' }, { status: 404 });
	}

	if (instance.type !== 'radarr' && instance.type !== 'sonarr') {
		return json(
			{ error: `Upgrade preview is not supported for ${instance.type}` },
			{ status: 400 }
		);
	}

	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object' || !('filter' in body) || !isFilterConfig(body.filter)) {
		return json({ error: 'Invalid filter' }, { status: 400 });
	}

	try {
		const preview = await previewUpgradeFilter(instance, body.filter);
		return json(preview);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to preview filter';
		return json({ error: message }, { status: 500 });
	}
};
