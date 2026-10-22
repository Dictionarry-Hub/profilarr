/**
 * Compile the vendored fixtures database and describe what it contains.
 *
 * Used by `deno task fixtures:update` to write tests/flows/data/fixtures.json,
 * which flow scenarios read their expected names and values from. The compile
 * mirrors the app's: schema ops, then the database's ops, with the same name
 * lookup functions. Its shape is typed in tests/flows/helpers/fixtureData.ts.
 */

import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

type Row = Record<string, unknown>;

// Columns stored as 0/1 that the snapshot shows as true/false
const BOOLEAN_COLUMNS = new Set([
	'include_in_rename',
	'negate',
	'required',
	'should_match',
	'upgrades_allowed',
	'enabled',
	'upgrade_until',
	'bypass_if_highest_quality',
	'bypass_if_above_custom_format_score',
	'rename',
	'replace_illegal_characters',
	'enable_media_info',
	'except_language'
]);

// Bookkeeping columns that change on every compile or mean nothing to tests
const SKIP_COLUMNS = new Set(['id', 'created_at', 'updated_at']);

const CONDITION_TABLES: Record<string, string> = {
	release_title: 'condition_patterns',
	release_group: 'condition_patterns',
	edition: 'condition_patterns',
	language: 'condition_languages',
	source: 'condition_sources',
	resolution: 'condition_resolutions',
	quality_modifier: 'condition_quality_modifiers',
	release_type: 'condition_release_types',
	indexer_flag: 'condition_indexer_flags',
	size: 'condition_sizes',
	year: 'condition_years'
};

const camel = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

/** A row with camelCase keys, booleans as true/false, and `omit` keys left out */
function clean(row: Row, omit: string[] = []): Row {
	const out: Row = {};
	for (const [key, value] of Object.entries(row)) {
		if (SKIP_COLUMNS.has(key) || omit.includes(key)) continue;
		out[camel(key)] = BOOLEAN_COLUMNS.has(key) && value !== null ? value === 1 : value;
	}
	return out;
}

async function runOps(db: DatabaseSync, dir: string): Promise<void> {
	const files = (await fs.readdir(dir))
		.filter((file) => file.endsWith('.sql'))
		.sort((a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b));
	for (const file of files) db.exec(await fs.readFile(join(dir, file), 'utf8'));
}

/** Compile schema and fixture ops and return the snapshot */
export async function buildSnapshot(schemaOpsDir: string, fixtureOpsDir: string): Promise<Row> {
	const db = new DatabaseSync(':memory:');
	try {
		db.exec('PRAGMA foreign_keys = ON');
		// Same name lookups the app registers before running ops
		for (const [fn, table] of [
			['qp', 'quality_profiles'],
			['cf', 'custom_formats'],
			['dp', 'delay_profiles'],
			['tag', 'tags']
		] as const) {
			db.function(fn, (name) => {
				// Prepared on use: the tables don't exist until the schema ops run
				const row = db.prepare(`SELECT id FROM ${table} WHERE name = ?`).get(name as string) as
					{ id: number } | undefined;
				if (!row) throw new Error(`${table} not found: ${name}`);
				return row.id;
			});
		}
		await runOps(db, schemaOpsDir);
		await runOps(db, fixtureOpsDir);

		const all = (sql: string, ...params: string[]) => db.prepare(sql).all(...params) as Row[];
		const tags = (table: string, key: string, name: string) =>
			all(`SELECT tag_name FROM ${table} WHERE ${key} = ? ORDER BY tag_name`, name).map(
				(row) => row.tag_name
			);

		const regularExpressions = all('SELECT * FROM regular_expressions ORDER BY name').map(
			(row) => ({
				...clean(row),
				tags: tags('regular_expression_tags', 'regular_expression_name', row.name as string)
			})
		);

		const customFormats = all('SELECT * FROM custom_formats ORDER BY name').map((row) => {
			const name = row.name as string;
			const conditions = all(
				'SELECT * FROM custom_format_conditions WHERE custom_format_name = ? ORDER BY name',
				name
			).map((condition) => {
				const table = CONDITION_TABLES[condition.type as string];
				const value = table
					? (db
							.prepare(`SELECT * FROM ${table} WHERE custom_format_name = ? AND condition_name = ?`)
							.get(name, condition.name as string) as Row | undefined)
					: undefined;
				return {
					...clean(condition, ['custom_format_name']),
					value: value ? clean(value, ['custom_format_name', 'condition_name']) : null
				};
			});
			const tests = all(
				'SELECT * FROM custom_format_tests WHERE custom_format_name = ? ORDER BY title, type',
				name
			).map((test) => clean(test, ['custom_format_name']));
			return {
				...clean(row),
				tags: tags('custom_format_tags', 'custom_format_name', name),
				conditions,
				tests
			};
		});

		const qualityProfiles = all('SELECT * FROM quality_profiles ORDER BY name').map((row) => {
			const name = row.name as string;
			const language = all(
				'SELECT language_name, type FROM quality_profile_languages WHERE quality_profile_name = ?',
				name
			)[0];
			const scores = all(
				`SELECT custom_format_name, arr_type, score FROM quality_profile_custom_formats
				 WHERE quality_profile_name = ? ORDER BY custom_format_name, arr_type`,
				name
			).map((score) => clean(score));
			const qualities = all(
				'SELECT * FROM quality_profile_qualities WHERE quality_profile_name = ? ORDER BY position',
				name
			).map((quality) => {
				const group = quality.quality_group_name as string | null;
				return {
					name: group ?? quality.quality_name,
					enabled: quality.enabled === 1,
					upgradeUntil: quality.upgrade_until === 1,
					...(group
						? {
								members: all(
									`SELECT quality_name FROM quality_group_members
									 WHERE quality_profile_name = ? AND quality_group_name = ? ORDER BY position`,
									name,
									group
								).map((member) => member.quality_name)
							}
						: {})
				};
			});
			return {
				...clean(row),
				tags: tags('quality_profile_tags', 'quality_profile_name', name),
				language: language ? clean(language) : null,
				scores,
				qualities
			};
		});

		const delayProfiles = all('SELECT * FROM delay_profiles ORDER BY name').map((row) =>
			clean(row)
		);

		const perArr = (table: string) => ({
			radarr: all(`SELECT * FROM radarr_${table} ORDER BY name`).map((row) => clean(row)),
			sonarr: all(`SELECT * FROM sonarr_${table} ORDER BY name`).map((row) => clean(row))
		});

		const definitions = (arr: 'radarr' | 'sonarr') =>
			[
				...new Set(
					all(`SELECT DISTINCT name FROM ${arr}_quality_definitions ORDER BY name`).map(
						(row) => row.name as string
					)
				)
			].map((name) => ({
				name,
				qualities: all(
					`SELECT quality_name, min_size, max_size, preferred_size FROM ${arr}_quality_definitions
					 WHERE name = ? ORDER BY quality_name`,
					name
				).map((row) => clean(row))
			}));

		return {
			regularExpressions,
			customFormats,
			qualityProfiles,
			delayProfiles,
			naming: perArr('naming'),
			mediaSettings: perArr('media_settings'),
			qualityDefinitions: { radarr: definitions('radarr'), sonarr: definitions('sonarr') }
		};
	} finally {
		db.close();
	}
}
