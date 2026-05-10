import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from '@sveltejs/kit';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { generalSettingsQueries } from '$db/queries/generalSettings.ts';
import { createArrClient } from '$arr/factory.ts';
import { getDefaultDelayProfile } from '$arr/defaults.ts';
import type { ArrType } from '$arr/types.ts';
import { logger } from '$logger/logger.ts';

const VALID_TYPES = ['radarr', 'sonarr'];

export const actions = {
	default: async ({ request }) => {
		const formData = await request.formData();

		const name = formData.get('name')?.toString().trim();
		const type = formData.get('type')?.toString().trim();
		const url = formData.get('url')?.toString().trim();
		const externalUrlRaw = formData.get('external_url')?.toString().trim() ?? '';
		const externalUrl = externalUrlRaw === '' ? null : externalUrlRaw;
		const apiKey = formData.get('api_key')?.toString().trim();
		const tagsJson = formData.get('tags')?.toString().trim();

		// Validation
		if (!name || !type || !url || !apiKey) {
			await logger.warn('Attempted to create instance with missing required fields', {
				source: 'arr/new',
				meta: { name, type, url, hasApiKey: !!apiKey }
			});

			return fail(400, {
				error: 'Name, type, URL, and API key are required',
				values: { name, type, url }
			});
		}

		if (!VALID_TYPES.includes(type)) {
			await logger.warn('Attempted to create instance with invalid type', {
				source: 'arr/new',
				meta: { name, type, url }
			});

			return fail(400, {
				error: 'Invalid arr type',
				values: { name, type, url }
			});
		}

		// Check if name already exists
		if (arrInstancesQueries.nameExists(name)) {
			await logger.warn('Attempted to create instance with duplicate name', {
				source: 'arr/new',
				meta: { name, type }
			});

			return fail(400, {
				error: 'An instance with this name already exists',
				values: { name, type, url }
			});
		}

		// Check if API key already exists (each Arr instance has a unique API key)
		if (arrInstancesQueries.apiKeyExists(apiKey)) {
			await logger.warn('Attempted to create duplicate instance', {
				source: 'arr/new',
				meta: { name, type, url }
			});

			return fail(400, {
				error: 'This instance is already connected',
				values: { name, type, url }
			});
		}

		// Parse tags
		let tags: string[] = [];
		if (tagsJson) {
			try {
				const parsed = JSON.parse(tagsJson);
				if (Array.isArray(parsed)) {
					tags = parsed;
				}
			} catch (error) {
				await logger.warn('Failed to parse tags JSON', {
					source: 'arr/new',
					meta: { tagsJson, error }
				});
			}
		}

		let id: number;
		try {
			// Create the instance
			id = arrInstancesQueries.create({
				name,
				type,
				url,
				externalUrl,
				apiKey,
				tags
			});

			await logger.info(`Created new ${type} instance: ${name}`, {
				source: 'arr/new',
				meta: { id, name, type, url, externalUrl }
			});

			// Apply default delay profile if enabled
			if (
				(type === 'radarr' || type === 'sonarr') &&
				generalSettingsQueries.shouldApplyDefaultDelayProfiles()
			) {
				try {
					const client = createArrClient(type as ArrType, url, apiKey);
					const defaultProfile = getDefaultDelayProfile(type);

					// Update the default delay profile (id=1)
					await client.updateDelayProfile(1, {
						...defaultProfile,
						id: 1,
						order: 2147483647 // Default profile order
					});

					await logger.info(`Applied default delay profile to ${name}`, {
						source: 'arr/new',
						meta: { id, type, profile: defaultProfile }
					});
				} catch (error) {
					// Log but don't fail - the instance was created successfully
					await logger.warn(`Failed to apply default delay profile to ${name}`, {
						source: 'arr/new',
						meta: { id, type, error: error instanceof Error ? error.message : error }
					});
				}
			}
		} catch (error) {
			await logger.error('Failed to create arr instance', {
				source: 'arr/new',
				meta: error
			});

			return fail(500, {
				error: 'Failed to create instance',
				values: { name, type, url }
			});
		}

		// Redirect to the arr list page (outside try-catch since redirect throws)
		redirect(303, '/arr');
	}
} satisfies Actions;
