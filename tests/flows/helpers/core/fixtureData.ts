/**
 * What the fixtures database contains, from the snapshot `deno task
 * fixtures:update` writes (tests/flows/data/fixtures.json, built by
 * tests/flows/harness/fixtureSnapshot.ts). Scenarios read names and expected values from
 * here instead of typing them, so a fixtures change only needs the update task.
 */

import { readFileSync } from 'node:fs';
import { FIXTURES_SNAPSHOT, SOURCE_FILE } from '#flows/harness/paths.ts';

export type ArrType = 'radarr' | 'sonarr';

export interface FixtureRegularExpression {
	name: string;
	pattern: string;
	description: string | null;
	regex101Id: string | null;
	tags: string[];
}

export interface FixtureCondition {
	name: string;
	type: string;
	arrType: 'all' | ArrType;
	negate: boolean;
	required: boolean;
	/** The condition type's own fields, e.g. { regularExpressionName } or { minBytes, maxBytes } */
	value: Record<string, unknown> | null;
}

export interface FixtureTest {
	title: string;
	type: 'movie' | 'series';
	shouldMatch: boolean;
	description: string | null;
}

export interface FixtureCustomFormat {
	name: string;
	description: string | null;
	includeInRename: boolean;
	tags: string[];
	conditions: FixtureCondition[];
	tests: FixtureTest[];
}

export interface FixtureQuality {
	/** A quality name, or a group name when `members` is set */
	name: string;
	enabled: boolean;
	upgradeUntil: boolean;
	members?: string[];
}

export interface FixtureQualityProfile {
	name: string;
	description: string | null;
	upgradesAllowed: boolean;
	minimumCustomFormatScore: number;
	upgradeUntilScore: number;
	upgradeScoreIncrement: number;
	tags: string[];
	language: { languageName: string; type: string } | null;
	scores: { customFormatName: string; arrType: 'all' | ArrType; score: number }[];
	/** In profile order */
	qualities: FixtureQuality[];
}

export interface FixtureDelayProfile {
	name: string;
	preferredProtocol: string;
	usenetDelay: number | null;
	torrentDelay: number | null;
	bypassIfHighestQuality: boolean;
	bypassIfAboveCustomFormatScore: boolean;
	minimumCustomFormatScore: number | null;
}

/** Naming and media settings rows, with the columns of each Arr's table */
export type FixtureConfig = { name: string } & Record<string, unknown>;

export interface FixtureQualityDefinitions {
	name: string;
	qualities: { qualityName: string; minSize: number; maxSize: number; preferredSize: number }[];
}

export interface FixtureSnapshot {
	regularExpressions: FixtureRegularExpression[];
	customFormats: FixtureCustomFormat[];
	qualityProfiles: FixtureQualityProfile[];
	delayProfiles: FixtureDelayProfile[];
	naming: Record<ArrType, FixtureConfig[]>;
	mediaSettings: Record<ArrType, FixtureConfig[]>;
	qualityDefinitions: Record<ArrType, FixtureQualityDefinitions[]>;
	/** Profilarr quality name to the name the Arr's API uses, per Arr */
	qualityApiNames: Record<ArrType, Record<string, string>>;
}

/** Sonarr naming fields the snapshot stores as numbers and the app shows as words */
export const SONARR_WORDS: Record<string, Record<number, string>> = {
	colonReplacementFormat: {
		0: 'delete',
		1: 'dash',
		2: 'spaceDash',
		3: 'spaceDashSpace',
		4: 'smart',
		5: 'custom'
	},
	multiEpisodeStyle: {
		0: 'extend',
		1: 'duplicate',
		2: 'repeat',
		3: 'scene',
		4: 'range',
		5: 'prefixedRange'
	}
};

export const fixtures: FixtureSnapshot = JSON.parse(readFileSync(FIXTURES_SNAPSHOT, 'utf8'));

export interface FixtureSource {
	/** The GitHub repository the fixtures and the snapshot came from, and its commit */
	fixtures: { repository: string; commit: string };
	schema: { repository: string; version: string; commit: string };
}

/** Where the vendored fixtures came from (tests/flows/data/source.json) */
export const fixturesSource: FixtureSource = JSON.parse(readFileSync(SOURCE_FILE, 'utf8'));

function find<T extends { name: string }>(items: T[], kind: string, name: string): T {
	const item = items.find((candidate) => candidate.name === name);
	if (!item) {
		const known = items.map((candidate) => candidate.name).join(', ');
		throw new Error(`The fixtures have no ${kind} named "${name}". Known: ${known}`);
	}
	return item;
}

/** Look up a fixture by name; an unknown name fails with the names that exist */
export const fixture = {
	regularExpression: (name: string) =>
		find(fixtures.regularExpressions, 'regular expression', name),
	customFormat: (name: string) => find(fixtures.customFormats, 'custom format', name),
	qualityProfile: (name: string) => find(fixtures.qualityProfiles, 'quality profile', name),
	delayProfile: (name: string) => find(fixtures.delayProfiles, 'delay profile', name),
	naming: (arr: ArrType, name: string) => find(fixtures.naming[arr], `${arr} naming config`, name),
	mediaSettings: (arr: ArrType, name: string) =>
		find(fixtures.mediaSettings[arr], `${arr} media settings config`, name),
	qualityDefinitions: (arr: ArrType, name: string) =>
		find(fixtures.qualityDefinitions[arr], `${arr} quality definitions config`, name),
	/**
	 * The name an Arr's API uses for a Profilarr quality, e.g. Sonarr calls
	 * Remux-1080p "Bluray-1080p Remux". Undefined when that Arr has no such
	 * quality, so sync leaves it out.
	 */
	arrQualityName: (arr: ArrType, name: string): string | undefined =>
		fixtures.qualityApiNames[arr][name]
};
