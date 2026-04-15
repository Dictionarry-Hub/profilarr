/**
 * Centralized PCD reference resolver
 * Resolves entity relationships in PCD caches (QP ↔ CF ↔ Regex)
 */

import type { PCDCache } from './database/cache.ts';
import type { SyncArrType } from '../sync/mappings.ts';

/**
 * Get all custom format names referenced by a quality profile
 * (Forward: QP → CFs)
 */
export async function getCustomFormatsForProfile(
	cache: PCDCache,
	profileName: string,
	arrType: SyncArrType
): Promise<string[]> {
	const rows = await cache.kb
		.selectFrom('quality_profile_custom_formats')
		.select(['custom_format_name'])
		.where('quality_profile_name', '=', profileName)
		.where((eb) => eb.or([eb('arr_type', '=', arrType), eb('arr_type', '=', 'all')]))
		.execute();

	return [...new Set(rows.map((r) => r.custom_format_name))];
}

/**
 * Get all quality profile names that reference a custom format
 * (Reverse: CF → QPs)
 */
export async function getProfilesForCustomFormat(
	cache: PCDCache,
	cfName: string,
	arrType: SyncArrType
): Promise<string[]> {
	const rows = await cache.kb
		.selectFrom('quality_profile_custom_formats')
		.select(['quality_profile_name'])
		.where('custom_format_name', '=', cfName)
		.where((eb) => eb.or([eb('arr_type', '=', arrType), eb('arr_type', '=', 'all')]))
		.execute();

	return [...new Set(rows.map((r) => r.quality_profile_name))];
}

/**
 * Get all custom format names that use a regular expression
 * (Reverse: Regex → CFs)
 */
export async function getCustomFormatsForRegex(
	cache: PCDCache,
	regexName: string
): Promise<string[]> {
	const rows = await cache.kb
		.selectFrom('condition_patterns')
		.select(['custom_format_name'])
		.where('regular_expression_name', '=', regexName)
		.execute();

	return [...new Set(rows.map((r) => r.custom_format_name))];
}

export interface ProfileRef {
	id: number;
	name: string;
	radarrScore: number | null;
	sonarrScore: number | null;
}

/**
 * Get all quality profiles that score a custom format, one row per profile.
 * Resolves 'all' arr_type into both radarr and sonarr scores; per-type rows
 * take precedence over 'all'.
 */
export async function getProfileRefsForCustomFormat(
	cache: PCDCache,
	cfName: string
): Promise<ProfileRef[]> {
	const rows = await cache.kb
		.selectFrom('quality_profile_custom_formats as qpcf')
		.innerJoin('quality_profiles as qp', 'qp.name', 'qpcf.quality_profile_name')
		.select(['qp.id', 'qp.name', 'qpcf.score', 'qpcf.arr_type'])
		.where('qpcf.custom_format_name', '=', cfName)
		.orderBy('qp.name')
		.execute();

	const map = new Map<number, ProfileRef>();
	for (const r of rows) {
		let ref = map.get(r.id);
		if (!ref) {
			ref = { id: r.id, name: r.name, radarrScore: null, sonarrScore: null };
			map.set(r.id, ref);
		}
		if (r.arr_type === 'all') {
			if (ref.radarrScore === null) ref.radarrScore = r.score;
			if (ref.sonarrScore === null) ref.sonarrScore = r.score;
		} else if (r.arr_type === 'radarr') {
			ref.radarrScore = r.score;
		} else if (r.arr_type === 'sonarr') {
			ref.sonarrScore = r.score;
		}
	}

	return [...map.values()];
}

export interface ConditionRef {
	cfId: number;
	cfName: string;
	conditionName: string;
	negate: boolean;
	required: boolean;
}

/**
 * Get all custom format conditions that use a regular expression, with detail
 * (Reverse: Regex → CF conditions)
 */
export async function getConditionRefsForRegex(
	cache: PCDCache,
	regexName: string
): Promise<ConditionRef[]> {
	const rows = await cache.kb
		.selectFrom('condition_patterns as cp')
		.innerJoin('custom_format_conditions as cfc', (join) =>
			join
				.onRef('cp.custom_format_name', '=', 'cfc.custom_format_name')
				.onRef('cp.condition_name', '=', 'cfc.name')
		)
		.innerJoin('custom_formats as cf', 'cf.name', 'cp.custom_format_name')
		.select(['cf.id', 'cf.name', 'cp.condition_name', 'cfc.negate', 'cfc.required'])
		.where('cp.regular_expression_name', '=', regexName)
		.orderBy('cf.name')
		.orderBy('cp.condition_name')
		.execute();

	return rows.map((r) => ({
		cfId: r.id,
		cfName: r.name,
		conditionName: r.condition_name,
		negate: !!r.negate,
		required: !!r.required
	}));
}
