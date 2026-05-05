import { migrationRunner } from '$db/migrations.ts';
import { config } from '$config';
import { build } from '$lib/shared/build.ts';
import { getVersionsSnapshot } from '$announcements/index.ts';

interface ReleaseRow {
	tag_name: string;
	html_url: string;
	published_at: string;
	prerelease: boolean;
}

export const load = () => {
	const currentMigrationVersion = migrationRunner.getCurrentVersion();
	const appliedMigrations = migrationRunner.getAppliedMigrations();

	const migrationsWithLatest = appliedMigrations.map((migration) => ({
		...migration,
		latest: migration.version === currentMigrationVersion
	}));

	const snapshot = getVersionsSnapshot();

	const releases: ReleaseRow[] = (snapshot?.payload.channels.stable.releases ?? [])
		.slice(0, 10)
		.map((r) => ({
			tag_name: `v${r.tag}`,
			html_url: r.url,
			published_at: r.published_at,
			prerelease: false
		}));

	return {
		version: build.version,
		timezone: config.timezone,
		paths: {
			base: config.paths.base,
			data: config.paths.data,
			logs: config.paths.logs,
			database: config.paths.database
		},
		migration: {
			current: currentMigrationVersion,
			applied: migrationsWithLatest
		},
		releases,
		cachedAt: snapshot?.fetchedAt ?? null
	};
};
