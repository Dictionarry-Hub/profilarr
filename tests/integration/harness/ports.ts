/**
 * Integration test port registry.
 *
 * Single source of truth for port allocation across all integration specs.
 * Specs import from here instead of declaring their own PORT constants, so
 * collisions surface as a registry-time error at first import rather than as
 * parallel-run flakes.
 *
 * Range strategy
 *   7000-7099  auth
 *   7100-7199  api
 *   7200-7299  backups
 *   7300-7399  conflicts
 *   7400-7499  notifications (mock webhook targets)
 *   7500-7599  announcements
 *   7600-7699  pcd writes
 *   7700-7799  pcd conflicts
 *   7800-7899  pcd reserved (future write/conflict expansion)
 *   7900-7999  reserved for future suites
 *
 * Each suite gets 100 ports of headroom. From a port number alone you can tell
 * which suite it belongs to. New specs claim the next free slot in their
 * suite's range.
 */

export const PORTS = {
	auth: {
		apiKey: 7000,
		cookieHttps: 7001,
		cookieHttp: 7002,
		csrf: 7003,
		csrfNoOrigin: 7004,
		csrfProxy: 7005,
		health: 7006,
		oidc: 7007,
		oidcProxy: 7008,
		oidcAuthOn: 7009,
		pathTraversal: 7010,
		proxy: 7011,
		rateLimit: 7012,
		reverseProxy502: 7013,
		reverseProxy502Manual: 7014,
		secretExposure: 7015,
		session: 7016,
		xForwardedFor: 7017
	},
	api: {
		arr: 7100,
		databases: 7101,
		status: 7102
	},
	backups: {
		backupSecrets: 7200,
		createAndDelete: 7201,
		jobStatus: 7202,
		listAndDownload: 7203,
		restoreA: 7204,
		restoreB: 7205,
		restoreFormActions: 7206,
		settings: 7207,
		upload: 7208
	},
	conflicts: {
		groupMemberPosition: 7300,
		regexDeleteRenameGeneratedDraft: 7301,
		regexSplitPartialConflict: 7302,
		regexSplitPerField: 7303,
		regexSplitRenameCascade: 7304,
		sequentialEdits: 7305,
		upstreamChange: 7306
	},
	notifications: {
		announcement: 7400,
		arrCleanup: 7401,
		arrDrift: 7402,
		arrSync: 7403,
		backup: 7404,
		pcdSync: 7405,
		rename: 7406,
		test: 7407,
		upgrade: 7408
	},
	announcements: {
		cascade: 7500,
		firstSync: 7501
	},
	pcd: {
		writeRegexCreate: 7600,
		writeRegexDelete: 7601,
		writeRegexRename: 7602,
		writeRegexUpdate: 7603,
		writeDelayProfilesCreate: 7610,
		writeDelayProfilesDelete: 7611,
		writeDelayProfilesUpdate: 7612,
		writeMediaSettingsCreate: 7613,
		writeMediaSettingsDelete: 7614,
		writeMediaSettingsUpdate: 7615,
		writeNamingRadarrCreate: 7616,
		writeNamingRadarrUpdate: 7617,
		writeNamingRadarrDelete: 7618,
		writeNamingSonarrCreate: 7619,
		writeNamingSonarrUpdate: 7620,
		writeNamingSonarrDelete: 7621,
		writeQualityDefinitionsRadarrCreate: 7622,
		writeQualityDefinitionsRadarrUpdate: 7623,
		writeQualityDefinitionsRadarrDelete: 7624,
		writeQualityDefinitionsSonarrCreate: 7625,
		writeQualityDefinitionsSonarrUpdate: 7626,
		writeQualityDefinitionsSonarrDelete: 7627,
		conflictsDelayProfiles: 7700,
		conflictsRegex: 7701,
		conflictsMediaSettings: 7702,
		conflictsNamingRadarr: 7703,
		conflictsNamingSonarr: 7704,
		conflictsQualityDefinitionsRadarr: 7705,
		conflictsQualityDefinitionsSonarr: 7706
	}
} as const;

function assertNoDuplicates(): void {
	const seen = new Map<number, string>();

	function walk(node: unknown, path: string): void {
		if (typeof node === 'number') {
			const existing = seen.get(node);
			if (existing) {
				throw new Error(`Duplicate port ${node} in PORTS registry: ${existing} and ${path}`);
			}
			seen.set(node, path);
			return;
		}
		if (node && typeof node === 'object') {
			for (const [key, value] of Object.entries(node)) {
				walk(value, path ? `${path}.${key}` : key);
			}
		}
	}

	walk(PORTS, '');
}

assertNoDuplicates();
