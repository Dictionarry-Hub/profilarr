import { build } from '$lib/shared/build.ts';
import { compareVersions } from './filter.ts';
import { getVersionsSnapshot } from './service.ts';

export type VersionStatus = 'up-to-date' | 'out-of-date' | 'dev-build';

export interface VersionStatusInfo {
	status: VersionStatus;
	latestVersion: string | null;
	releaseUrl: string | null;
}

export function computeVersionStatus(
	stableLatest: string | null,
	developLatest: string | null,
	developPublishedAt: string | null
): VersionStatus {
	if (build.channel === 'dev') return 'dev-build';
	if (build.version.includes('-')) return 'dev-build';

	if (build.channel === 'stable') {
		if (!stableLatest) return 'dev-build';
		const cmp = compareVersions(build.version, stableLatest);
		if (cmp > 0) return 'dev-build';
		return cmp === 0 ? 'up-to-date' : 'out-of-date';
	}

	if (build.channel === 'develop') {
		if (!developLatest || !build.commit) return 'dev-build';
		if (build.commit.startsWith(developLatest) || developLatest.startsWith(build.commit)) {
			return 'up-to-date';
		}
		if (build.builtAt && developPublishedAt) {
			const localMs = Date.parse(build.builtAt);
			const remoteMs = Date.parse(developPublishedAt);
			if (Number.isFinite(localMs) && Number.isFinite(remoteMs) && localMs >= remoteMs) {
				return 'dev-build';
			}
		}
		return 'out-of-date';
	}

	return 'dev-build';
}

export function getVersionStatus(): VersionStatusInfo {
	const snapshot = getVersionsSnapshot();
	const channels = snapshot?.payload.channels;
	const stableLatest = channels?.stable.latest ?? null;
	const developLatest = channels?.develop.latest ?? null;
	const developPublishedAt = channels?.develop.published_at ?? null;

	const status = computeVersionStatus(stableLatest, developLatest, developPublishedAt);

	if (status !== 'out-of-date') {
		return { status, latestVersion: null, releaseUrl: null };
	}

	if (build.channel === 'stable' && stableLatest) {
		const release = channels?.stable.releases?.[0];
		return {
			status,
			latestVersion: `v${stableLatest}`,
			releaseUrl: release?.url ?? null
		};
	}

	if (build.channel === 'develop' && developLatest) {
		return {
			status,
			latestVersion: developLatest.slice(0, 7),
			releaseUrl: `https://github.com/Dictionarry-Hub/profilarr/commit/${developLatest}`
		};
	}

	return { status, latestVersion: null, releaseUrl: null };
}
