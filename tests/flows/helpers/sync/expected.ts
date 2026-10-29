/**
 * What a sync should send an Arr for a fixture, in the Arr API's own field
 * names and values. Scenarios compare the fake's state with these, so a check
 * reads the fixture once and the mapping lives here.
 *
 * The maps follow the app's sync transformers (src/lib/server/sync/): naming
 * and media settings field names, the propers values, the delay profile
 * protocol table, NULL delays and scores sent as 0, and quality sizes of 0
 * sent as null. Kept free of Playwright imports, like the fixtures reader.
 */

import {
	fixture,
	type ArrType,
	type FixtureConfig,
	type FixtureDelayProfile,
	type FixtureQualityDefinitions,
	type FixtureQualityProfile
} from '#flows/helpers/core/fixtureData.ts';

/** Fixture naming fields to the Arr's naming field names, per Arr */
export const NAMING_FIELDS: Record<ArrType, Record<string, string>> = {
	radarr: {
		rename: 'renameMovies',
		replaceIllegalCharacters: 'replaceIllegalCharacters',
		colonReplacementFormat: 'colonReplacementFormat',
		movieFormat: 'standardMovieFormat',
		movieFolderFormat: 'movieFolderFormat'
	},
	sonarr: {
		rename: 'renameEpisodes',
		replaceIllegalCharacters: 'replaceIllegalCharacters',
		// Sonarr's API takes these two as numbers, which the snapshot stores
		colonReplacementFormat: 'colonReplacementFormat',
		customColonReplacementFormat: 'customColonReplacementFormat',
		multiEpisodeStyle: 'multiEpisodeStyle',
		standardEpisodeFormat: 'standardEpisodeFormat',
		dailyEpisodeFormat: 'dailyEpisodeFormat',
		animeEpisodeFormat: 'animeEpisodeFormat',
		seriesFolderFormat: 'seriesFolderFormat',
		seasonFolderFormat: 'seasonFolderFormat'
	}
};

/** Fixture propers and repacks values to the Arr's `downloadPropersAndRepacks` */
export const PROPERS: Record<string, string> = {
	doNotPrefer: 'doNotPrefer',
	preferAndUpgrade: 'preferAndUpgrade',
	doNotUpgradeAutomatically: 'doNotUpgrade'
};

/** A delay profile's preferred protocol to the Arr's protocol fields */
export const PROTOCOLS: Record<
	string,
	{ enableUsenet: boolean; enableTorrent: boolean; preferredProtocol: 'usenet' | 'torrent' }
> = {
	prefer_usenet: { enableUsenet: true, enableTorrent: true, preferredProtocol: 'usenet' },
	prefer_torrent: { enableUsenet: true, enableTorrent: true, preferredProtocol: 'torrent' },
	only_usenet: { enableUsenet: true, enableTorrent: false, preferredProtocol: 'usenet' },
	only_torrent: { enableUsenet: false, enableTorrent: true, preferredProtocol: 'torrent' }
};

/** The order every synced delay profile gets: the default profile's, max int */
export const DEFAULT_DELAY_PROFILE_ORDER = 2147483647;

/** A naming fixture in the Arr's field names, the fields a sync manages */
export function expectedNaming(app: ArrType, config: FixtureConfig): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(NAMING_FIELDS[app]).map(([field, arrField]) => [arrField, config[field]])
	);
}

/** A media settings fixture in the Arr's field names */
export function expectedMediaSettings(config: FixtureConfig): Record<string, unknown> {
	return {
		downloadPropersAndRepacks: PROPERS[config.propersRepacks as string],
		enableMediaInfo: config.enableMediaInfo
	};
}

/** The delay profile a sync writes over the Arr's default one (id 1) */
export function expectedDelayProfile(profile: FixtureDelayProfile): Record<string, unknown> {
	return {
		id: 1,
		...PROTOCOLS[profile.preferredProtocol],
		usenetDelay: profile.usenetDelay ?? 0,
		torrentDelay: profile.torrentDelay ?? 0,
		bypassIfHighestQuality: profile.bypassIfHighestQuality,
		bypassIfAboveCustomFormatScore: profile.bypassIfAboveCustomFormatScore,
		minimumCustomFormatScore: profile.minimumCustomFormatScore ?? 0,
		order: DEFAULT_DELAY_PROFILE_ORDER,
		tags: []
	};
}

/** One quality's sizes as the Arr gets them */
export interface QualitySizes {
	/** The Arr's quality name, e.g. Sonarr's "Bluray-1080p Remux" */
	name: string;
	minSize: number;
	maxSize: number | null;
	preferredSize: number | null;
}

/**
 * A quality definitions fixture as the Arr gets it, for each quality the Arr
 * has. A maximum or preferred size of 0 means no limit and arrives as null.
 * The minimum arrives as stored.
 */
export function expectedQualitySizes(
	app: ArrType,
	config: FixtureQualityDefinitions
): QualitySizes[] {
	return config.qualities.flatMap((quality) => {
		const name = fixture.arrQualityName(app, quality.qualityName);
		if (!name) return [];
		return [
			{
				name,
				minSize: quality.minSize,
				maxSize: quality.maxSize === 0 ? null : quality.maxSize,
				preferredSize: quality.preferredSize === 0 ? null : quality.preferredSize
			}
		];
	});
}

/**
 * The custom format scores a profile syncs to an Arr, by format name: its
 * scores for that Arr, with one for that Arr winning over one for all.
 */
export function expectedScores(
	profile: FixtureQualityProfile,
	app: ArrType
): Record<string, number> {
	const scores: Record<string, number> = {};
	for (const arrType of ['all', app]) {
		for (const score of profile.scores) {
			if (score.arrType === arrType) scores[score.customFormatName] = score.score;
		}
	}
	return scores;
}

/** The profile settings a sync writes, in the Arr's field names */
export function expectedProfileSettings(profile: FixtureQualityProfile): Record<string, unknown> {
	return {
		upgradeAllowed: profile.upgradesAllowed,
		minFormatScore: profile.minimumCustomFormatScore,
		cutoffFormatScore: profile.upgradeUntilScore,
		minUpgradeFormatScore: Math.max(1, profile.upgradeScoreIncrement)
	};
}
