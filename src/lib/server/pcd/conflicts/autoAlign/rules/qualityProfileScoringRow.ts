import type { Database } from '@db/sqlite';
import type { ParsedOpMetadata, UpdateRule } from '../types.ts';

type ScoringDesiredEntry = {
	custom_format_name: string;
	arr_type: string;
	from: unknown;
	to: unknown;
};

function parseScoringDesiredEntry(value: unknown): ScoringDesiredEntry | null {
	if (!value || typeof value !== 'object') return null;
	const row = value as {
		custom_format_name?: unknown;
		arr_type?: unknown;
		from?: unknown;
		to?: unknown;
	};

	if (
		typeof row.custom_format_name !== 'string' ||
		row.custom_format_name.length === 0 ||
		typeof row.arr_type !== 'string' ||
		row.arr_type.length === 0 ||
		!('from' in row) ||
		!('to' in row)
	) {
		return null;
	}

	return {
		custom_format_name: row.custom_format_name,
		arr_type: row.arr_type,
		from: row.from,
		to: row.to
	};
}

function normalizeScore(value: unknown): number | null {
	if (value === null || value === undefined) return null;
	if (typeof value === 'number') return Number.isFinite(value) ? value : null;
	if (typeof value === 'bigint') return Number(value);
	if (typeof value === 'string') {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

function fetchQualityProfileScore(
	db: Database,
	profileName: string,
	customFormatName: string,
	arrType: string
): number | null {
	const row = db
		.prepare(
			`SELECT score
FROM quality_profile_custom_formats
WHERE quality_profile_name = ?
  AND custom_format_name = ?
  AND arr_type = ?
LIMIT 1`
		)
		.get(profileName, customFormatName, arrType) as { score?: unknown } | undefined;

	if (!row) return null;
	return normalizeScore(row.score);
}

function shouldAutoAlignQualityProfileScoringRow(
	db: Database,
	metadata: ParsedOpMetadata | null,
	desiredState: Record<string, unknown>
): boolean {
	const profileName = metadata?.stableKey?.value ?? metadata?.name;
	if (!profileName) return false;

	const rawScores = desiredState.custom_format_scores;
	if (!Array.isArray(rawScores) || rawScores.length !== 1) return false;

	const entry = parseScoringDesiredEntry(rawScores[0]);
	if (!entry) return false;

	const currentScore = fetchQualityProfileScore(
		db,
		profileName,
		entry.custom_format_name,
		entry.arr_type
	);
	const desiredTo = normalizeScore(entry.to);

	if (desiredTo === null) {
		return currentScore === null;
	}

	if (currentScore === null) {
		return false;
	}

	return currentScore === desiredTo;
}

export const qualityProfileScoringRowRule: UpdateRule = {
	name: 'quality_profile_scoring_row',
	matches: ({ entityName, desiredState }) =>
		entityName === 'quality_profile' && !!desiredState && 'custom_format_scores' in desiredState,
	shouldAlign: ({ db, metadata, desiredState }) =>
		shouldAutoAlignQualityProfileScoringRow(db, metadata, desiredState ?? {})
};
