import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { compile, invalidate } from '$pcd/database/compiler.ts';
import { syncDependencies } from '$pcd/git/dependencies.ts';
import {
	readManifest,
	writeManifest,
	validateManifest,
	readReadme,
	writeReadme,
	type Manifest
} from '$pcd/manifest/manifest.ts';
import { parseMarkdown } from '$utils/markdown/markdown.ts';
import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import { logger } from '$logger/logger.ts';

export const load: PageServerLoad = async ({ parent }) => {
	const { database } = await parent();

	if (!database.hasPat) {
		error(403, 'Config page requires a personal access token');
	}

	let manifest: Manifest | null = null;
	let readmeRaw: string | null = null;
	let readmeHtml: string | null = null;

	try {
		manifest = await readManifest(database.local_path);
	} catch {
		// Manifest might not exist yet
	}

	readmeRaw = await readReadme(database.local_path);
	if (readmeRaw) {
		readmeHtml = parseMarkdown(readmeRaw);
	}

	return {
		manifest,
		readmeRaw,
		readmeHtml
	};
};

export const actions: Actions = {
	save: async ({ request, params }) => {
		const id = parseInt(params.id, 10);
		const database = databaseInstancesQueries.getById(id);

		if (!database) {
			return fail(404, { error: 'Database not found' });
		}

		if (!database.personal_access_token) {
			return fail(403, { error: 'Personal access token required' });
		}

		const formData = await request.formData();
		const manifestJson = formData.get('manifest') as string;
		const readme = formData.get('readme') as string;

		try {
			const manifest = JSON.parse(manifestJson);
			validateManifest(manifest);
			await writeManifest(database.local_path, manifest);
			await writeReadme(database.local_path, readme);

			let dependencySync;
			try {
				dependencySync = await syncDependencies(
					database.local_path,
					database.personal_access_token ?? undefined
				);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return fail(500, { error: `Failed to sync dependencies: ${message}` });
			}

			if (dependencySync.changed) {
				await logger.info('Dependencies changed, invalidating cache before rebuild', {
					source: 'DatabaseConfig',
					meta: {
						databaseId: id,
						databaseName: database.name,
						repositories: dependencySync.repositories
					}
				});
				invalidate(id);
			}

			if (database.enabled) {
				try {
					await compile(database.local_path, id);
					await logger.info('Rebuilt cache after config dependency sync', {
						source: 'DatabaseConfig',
						meta: {
							databaseId: id,
							databaseName: database.name,
							dependenciesChanged: dependencySync.changed,
							repositories: dependencySync.repositories
						}
					});
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					return fail(500, { error: `Failed to rebuild cache: ${message}` });
				}
			}

			return { success: true };
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return fail(400, { error: message });
		}
	}
};
