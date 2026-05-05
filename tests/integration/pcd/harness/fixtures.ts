import type { SeedOperation } from './pcd.ts';

export const base = {
	regex(input: { name: string; pattern: string; description?: string | null }): SeedOperation {
		const description = input.description ?? '';
		return {
			sql: `INSERT INTO regular_expressions (name, pattern, description)
			      VALUES (${sqlValue(input.name)}, ${sqlValue(input.pattern)}, ${sqlValue(description)});`
		};
	}
};

function sqlValue(value: string | null): string {
	if (value === null) return 'NULL';
	return `'${value.replace(/'/g, "''")}'`;
}
