import { error, redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { pcdManager } from '$pcd/core/manager.ts';
import { canWriteToBase } from '$pcd/ops/writer.ts';
import type { OperationLayer } from '$pcd/core/types.ts';
import type { RadarrNamingRow, SonarrNamingRow } from '$shared/pcd/display.ts';
import {
	createRadarrNaming,
	createSonarrNaming
} from '$pcd/entities/mediaManagement/naming/index.ts';
import { validateNamingFormat } from '$shared/pcd/namingTokens.ts';

export const load: PageServerLoad = async ({ parent }) => {
	const parentData = await parent();
	return {
		canWriteToBase: parentData.canWriteToBase
	};
};

export const actions: Actions = {
	default: async ({ request, params }) => {
		const { databaseId } = params;

		if (!databaseId) {
			return fail(400, { error: 'Missing database ID' });
		}

		const currentDatabaseId = parseInt(databaseId, 10);
		if (isNaN(currentDatabaseId)) {
			return fail(400, { error: 'Invalid database ID' });
		}

		const cache = pcdManager.getCache(currentDatabaseId);
		if (!cache) {
			return fail(500, { error: 'Database cache not available' });
		}

		const formData = await request.formData();
		const arrType = formData.get('arrType') as 'radarr' | 'sonarr';
		const name = formData.get('name') as string;
		const layer = (formData.get('layer') as OperationLayer) || 'user';

		if (!name?.trim()) {
			return fail(400, { error: 'Name is required' });
		}

		if (!arrType || (arrType !== 'radarr' && arrType !== 'sonarr')) {
			return fail(400, { error: 'Invalid arr type' });
		}

		if (layer === 'base' && !canWriteToBase(currentDatabaseId)) {
			return fail(403, { error: 'Cannot write to base layer without personal access token' });
		}

		if (arrType === 'radarr') {
			const rename = formData.get('rename') === 'true';
			const movieFormat = formData.get('movieFormat') as string;
			const movieFolderFormat = formData.get('movieFolderFormat') as string;
			const replaceIllegalCharacters = formData.get('replaceIllegalCharacters') === 'true';
			const colonReplacementFormat = formData.get(
				'colonReplacementFormat'
			) as RadarrNamingRow['colon_replacement_format'];

			const movieFormatValidation = validateNamingFormat(movieFormat || '', 'radarr');
			if (!movieFormatValidation.valid) {
				return fail(400, { error: `Movie format: ${movieFormatValidation.errors.join(', ')}` });
			}
			const folderFormatValidation = validateNamingFormat(movieFolderFormat || '', 'radarr');
			if (!folderFormatValidation.valid) {
				return fail(400, { error: `Folder format: ${folderFormatValidation.errors.join(', ')}` });
			}

			let result;
			try {
				result = await createRadarrNaming({
					databaseId: currentDatabaseId,
					cache,
					layer,
					input: {
						name: name.trim(),
						rename,
						movieFormat: movieFormat || '',
						movieFolderFormat: movieFolderFormat || '',
						replaceIllegalCharacters,
						colonReplacementFormat: colonReplacementFormat || 'delete'
					}
				});
			} catch (err) {
				const message =
					err instanceof Error ? err.message : 'Failed to create radarr naming config';
				if (message.includes('already exists')) {
					return fail(400, { error: message });
				}
				return fail(500, { error: message });
			}

			if (!result.success) {
				return fail(500, { error: result.error || 'Failed to create radarr naming config' });
			}
		} else {
			const rename = formData.get('rename') === 'true';
			const standardEpisodeFormat = formData.get('standardEpisodeFormat') as string;
			const dailyEpisodeFormat = formData.get('dailyEpisodeFormat') as string;
			const animeEpisodeFormat = formData.get('animeEpisodeFormat') as string;
			const seriesFolderFormat = formData.get('seriesFolderFormat') as string;
			const seasonFolderFormat = formData.get('seasonFolderFormat') as string;
			const replaceIllegalCharacters = formData.get('replaceIllegalCharacters') === 'true';
			const colonReplacementFormat = formData.get(
				'colonReplacementFormat'
			) as SonarrNamingRow['colon_replacement_format'];
			const customColonReplacementFormat = formData.get('customColonReplacementFormat') as string;
			const multiEpisodeStyle = formData.get(
				'multiEpisodeStyle'
			) as SonarrNamingRow['multi_episode_style'];

			const formatFields = [
				{ name: 'Standard episode format', value: standardEpisodeFormat },
				{ name: 'Daily episode format', value: dailyEpisodeFormat },
				{ name: 'Anime episode format', value: animeEpisodeFormat },
				{ name: 'Series folder format', value: seriesFolderFormat },
				{ name: 'Season folder format', value: seasonFolderFormat }
			];
			for (const field of formatFields) {
				const validation = validateNamingFormat(field.value || '', 'sonarr');
				if (!validation.valid) {
					return fail(400, { error: `${field.name}: ${validation.errors.join(', ')}` });
				}
			}

			let result;
			try {
				result = await createSonarrNaming({
					databaseId: currentDatabaseId,
					cache,
					layer,
					input: {
						name: name.trim(),
						rename,
						standardEpisodeFormat: standardEpisodeFormat || '',
						dailyEpisodeFormat: dailyEpisodeFormat || '',
						animeEpisodeFormat: animeEpisodeFormat || '',
						seriesFolderFormat: seriesFolderFormat || '',
						seasonFolderFormat: seasonFolderFormat || '',
						replaceIllegalCharacters,
						colonReplacementFormat: colonReplacementFormat || 'delete',
						customColonReplacementFormat: customColonReplacementFormat || null,
						multiEpisodeStyle: multiEpisodeStyle || 'extend'
					}
				});
			} catch (err) {
				const message =
					err instanceof Error ? err.message : 'Failed to create sonarr naming config';
				if (message.includes('already exists')) {
					return fail(400, { error: message });
				}
				return fail(500, { error: message });
			}

			if (!result.success) {
				return fail(500, { error: result.error || 'Failed to create sonarr naming config' });
			}
		}

		throw redirect(303, `/media-management/${databaseId}/naming`);
	}
};
