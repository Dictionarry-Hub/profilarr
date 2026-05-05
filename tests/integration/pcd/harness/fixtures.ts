import type { SeedOperation } from './pcd.ts';

export const base = {
	regex(input: {
		name: string;
		pattern: string;
		description?: string | null;
		regex101Id?: string | null;
		tags?: string[];
	}): SeedOperation {
		const description = 'description' in input ? (input.description ?? null) : '';
		const regex101Id = input.regex101Id ?? null;
		const tags = Array.from(new Set((input.tags ?? []).map((tag) => tag.trim()).filter(Boolean)));
		const tagSql = tags.map((tag) =>
			[
				`INSERT INTO tags (name) VALUES (${sqlValue(tag)}) ON CONFLICT(name) DO NOTHING;`,
				`INSERT INTO regular_expression_tags (regular_expression_name, tag_name) VALUES (${sqlValue(
					input.name
				)}, ${sqlValue(tag)});`
			].join('\n')
		);

		return {
			sql: [
				`INSERT INTO regular_expressions (name, pattern, description, regex101_id)
				 VALUES (${sqlValue(input.name)}, ${sqlValue(input.pattern)}, ${sqlValue(
					description
				)}, ${sqlValue(regex101Id)});`,
				...tagSql
			].join('\n')
		};
	},

	customFormatRegexCondition(input: {
		formatName: string;
		conditionName: string;
		regexName: string;
		type?: 'release_title' | 'release_group' | 'edition';
	}): SeedOperation {
		const type = input.type ?? 'release_title';
		return {
			sql: `INSERT INTO custom_formats (name, description, include_in_rename)
			      VALUES (${sqlValue(input.formatName)}, '', 0);

			      INSERT INTO custom_format_conditions
			        (custom_format_name, name, type, arr_type, negate, required)
			      VALUES (${sqlValue(input.formatName)}, ${sqlValue(input.conditionName)}, ${sqlValue(
							type
						)}, 'all', 0, 0);

			      INSERT INTO condition_patterns
			        (custom_format_name, condition_name, regular_expression_name)
			      VALUES (${sqlValue(input.formatName)}, ${sqlValue(input.conditionName)}, ${sqlValue(
							input.regexName
						)});`
		};
	}
};

function sqlValue(value: string | null): string {
	if (value === null) return 'NULL';
	return `'${value.replace(/'/g, "''")}'`;
}
