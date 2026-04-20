import { migrationRunner } from '$db/migrations.ts';
import { config } from '$config';
import { build } from '$lib/shared/build.ts';
import { getVersionsSnapshot } from '$lib/server/announcements/index.ts';
import { compareVersions } from '$lib/server/announcements/filter.ts';

type VersionStatus = 'up-to-date' | 'out-of-date' | 'dev-build';

interface ReleaseRow {
	tag_name: string;
	html_url: string;
	published_at: string;
	prerelease: boolean;
}

function computeVersionStatus(
	stableLatest: string | null,
	developLatest: string | null
): VersionStatus {
	if (build.channel === 'dev') return 'dev-build';
	if (build.version.includes('-')) return 'dev-build';

	if (build.channel === 'stable') {
		if (!stableLatest) return 'dev-build';
		const cmp = compareVersions(build.version, stableLatest);
		if (cmp > 0) return 'dev-build'; // ahead of "latest"
		return cmp === 0 ? 'up-to-date' : 'out-of-date';
	}

	if (build.channel === 'develop') {
		if (!developLatest || !build.commit) return 'dev-build';
		return build.commit.startsWith(developLatest) || developLatest.startsWith(build.commit)
			? 'up-to-date'
			: 'out-of-date';
	}

	return 'dev-build';
}

export const load = () => {
	const currentMigrationVersion = migrationRunner.getCurrentVersion();
	const appliedMigrations = migrationRunner.getAppliedMigrations();

	const migrationsWithLatest = appliedMigrations.map((migration) => ({
		...migration,
		latest: migration.version === currentMigrationVersion
	}));

	const snapshot = getVersionsSnapshot();
	const stableLatest = snapshot?.payload.channels.stable.latest ?? null;
	const developLatest = snapshot?.payload.channels.develop.latest ?? null;
	const versionStatus = computeVersionStatus(stableLatest, developLatest);

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
		versionStatus,
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
