/**
 * PCD Type Generator
 *
 * Generates TypeScript types from the PCD schema SQL.
 * Uses SQLite introspection to ensure types match the actual schema.
 *
 * Usage:
 *   deno task generate:pcd-types                    # Uses default version (1.0.0)
 *   deno task generate:pcd-types --version=1.1.0    # Uses specific version
 *   deno task generate:pcd-types --local=/path/to/schema.sql  # Uses local file
 */

import { Database } from '@jsr/db__sqlite';

// ============================================================================
// CONFIGURATION
// ============================================================================

const SCHEMA_REPO = 'Dictionarry-Hub/schema';

/**
 * Manual type overrides for columns that store integers in the DB
 * but need semantic string types for the UI/API layer.
 *
 * Columns with CHECK constraints don't need overrides - the generator
 * parses those automatically. These are for Sonarr's integer enums.
 *
 * Runtime conversion functions are in: src/lib/shared/pcd/conversions.ts
 */
const COLUMN_TYPE_OVERRIDES: Record<string, string> = {
	// Sonarr stores these as integers (0-5) but we want semantic strings in TS
	'sonarr_naming.colon_replacement_format':
		"'delete' | 'dash' | 'spaceDash' | 'spaceDashSpace' | 'smart' | 'custom'",
	'sonarr_naming.multi_episode_style':
		"'extend' | 'duplicate' | 'repeat' | 'scene' | 'range' | 'prefixedRange'"
};
const DEFAULT_VERSION = '1.0.0'; // Schema versions are branch names (e.g., 1.0.0, 1.1.0)
const SCHEMA_PATH = 'ops/0.schema.sql';
const OUTPUT_DIR = './src/lib/shared/pcd';
const OUTPUT_PATH = `${OUTPUT_DIR}/types.ts`;

// ============================================================================
// CLI ARGUMENT PARSING
// ============================================================================

interface CliArgs {
	version: string;
	localPath?: string;
	help: boolean;
}

function parseArgs(): CliArgs {
	const args: CliArgs = {
		version: DEFAULT_VERSION,
		help: false
	};

	for (const arg of Deno.args) {
		if (arg === '--help' || arg === '-h') {
			args.help = true;
		} else if (arg.startsWith('--version=')) {
			args.version = arg.slice('--version='.length);
		} else if (arg.startsWith('--local=')) {
			args.localPath = arg.slice('--local='.length);
		}
	}

	return args;
}

function printHelp(): void {
	console.log(`
PCD Type Generator

Generates TypeScript types from the PCD schema SQL.

USAGE:
  deno task generate:pcd-types [OPTIONS]

OPTIONS:
  --version=<ver>    Use specific schema version/branch (default: ${DEFAULT_VERSION})
  --local=<path>     Use local schema file instead of fetching from GitHub
  --help, -h         Show this help message

EXAMPLES:
  deno task generate:pcd-types                      # Fetch version ${DEFAULT_VERSION}
  deno task generate:pcd-types --version=1.1.0      # Fetch version 1.1.0
  deno task generate:pcd-types --local=./schema.sql # Use local file

OUTPUT:
  ${OUTPUT_PATH}
`);
}

// ============================================================================
// SCHEMA FETCHING
// ============================================================================

async function fetchSchemaFromGitHub(version: string): Promise<string> {
	const url = `https://raw.githubusercontent.com/${SCHEMA_REPO}/${version}/${SCHEMA_PATH}`;
	console.log(`Fetching schema from: ${url}`);

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch schema: ${response.status} ${response.statusText}`);
	}

	return await response.text();
}

async function loadSchemaFromFile(path: string): Promise<string> {
	console.log(`Loading schema from: ${path}`);
	return await Deno.readTextFile(path);
}

// ============================================================================
// SQLITE INTROSPECTION
// ============================================================================

interface ColumnInfo {
	cid: number;
	name: string;
	type: string;
	notnull: number;
	dflt_value: string | null;
	pk: number;
}

interface ForeignKeyInfo {
	id: number;
	seq: number;
	table: string;
	from: string;
	to: string;
	on_update: string;
	on_delete: string;
}

interface CheckConstraint {
	column: string;
	values: string[];
}

interface TableInfo {
	name: string;
	columns: ColumnInfo[];
	foreignKeys: ForeignKeyInfo[];
	checkConstraints: CheckConstraint[];
	createSql: string;
}

/**
 * Parse CHECK constraints from CREATE TABLE SQL to extract enum values
 * Looks for patterns like: CHECK (column IN ('val1', 'val2', 'val3'))
 */
function parseCheckConstraints(createSql: string): CheckConstraint[] {
	const constraints: CheckConstraint[] = [];

	// Match CHECK (column_name IN ('val1', 'val2', ...)) patterns
	// Handles both quoted strings and unquoted identifiers
	const checkPattern = /CHECK\s*\(\s*(\w+)\s+IN\s*\(\s*([^)]+)\s*\)\s*\)/gi;

	let match;
	while ((match = checkPattern.exec(createSql)) !== null) {
		const column = match[1];
		const valuesStr = match[2];

		// Extract individual values (handles 'quoted' and unquoted)
		const values: string[] = [];
		const valuePattern = /'([^']+)'/g;
		let valueMatch;
		while ((valueMatch = valuePattern.exec(valuesStr)) !== null) {
			values.push(valueMatch[1]);
		}

		if (values.length > 0) {
			constraints.push({ column, values });
		}
	}

	return constraints;
}

/**
 * Check if a column name matches boolean naming patterns
 */
function isBooleanColumn(columnName: string, columnType: string): boolean {
	// Must be INTEGER type
	if (!columnType.toUpperCase().includes('INT')) {
		return false;
	}

	const name = columnName.toLowerCase();

	// Prefix patterns
	const booleanPrefixes = ['is_', 'has_', 'bypass_', 'enable_', 'include_', 'except_', 'replace_'];
	if (booleanPrefixes.some((prefix) => name.startsWith(prefix))) {
		return true;
	}

	// Suffix patterns
	const booleanSuffixes = ['_allowed', '_enabled'];
	if (booleanSuffixes.some((suffix) => name.endsWith(suffix))) {
		return true;
	}

	// Exact matches
	const booleanExactNames = [
		'negate',
		'required',
		'enabled',
		'rename',
		'should_match',
		'upgrades_allowed'
	];
	if (booleanExactNames.includes(name)) {
		return true;
	}

	return false;
}

function introspectDatabase(db: Database): TableInfo[] {
	// Get all table names and their CREATE statements
	const tables = db
		.prepare(
			`SELECT name, sql FROM sqlite_master
       WHERE type='table' AND name NOT LIKE 'sqlite_%'
       ORDER BY name`
		)
		.all() as { name: string; sql: string }[];

	const tableInfos: TableInfo[] = [];

	for (const { name, sql } of tables) {
		// Get column info
		const columns = db.prepare(`PRAGMA table_info('${name}')`).all() as ColumnInfo[];

		// Get foreign key info
		const foreignKeys = db.prepare(`PRAGMA foreign_key_list('${name}')`).all() as ForeignKeyInfo[];

		// Parse CHECK constraints from CREATE TABLE SQL
		const checkConstraints = parseCheckConstraints(sql || '');

		tableInfos.push({ name, columns, foreignKeys, checkConstraints, createSql: sql || '' });
	}

	return tableInfos;
}

// ============================================================================
// TYPE GENERATION
// ============================================================================

/**
 * Map SQLite types to TypeScript types
 */
function sqliteTypeToTs(sqliteType: string, nullable: boolean): string {
	const type = sqliteType.toUpperCase();

	let tsType: string;

	if (type.includes('INT')) {
		tsType = 'number';
	} else if (type.includes('CHAR') || type.includes('TEXT') || type.includes('CLOB')) {
		tsType = 'string';
	} else if (type.includes('REAL') || type.includes('FLOA') || type.includes('DOUB')) {
		tsType = 'number';
	} else if (type.includes('BLOB')) {
		tsType = 'Uint8Array';
	} else if (type === '' || type === 'NUMERIC') {
		// SQLite allows untyped columns
		tsType = 'unknown';
	} else {
		// Default to string for VARCHAR, etc.
		tsType = 'string';
	}

	return nullable ? `${tsType} | null` : tsType;
}

/**
 * Get the semantic TypeScript type for a column
 * Priority: 1) Manual overrides, 2) CHECK constraints, 3) Boolean patterns, 4) SQLite type
 */
function getSemanticType(
	tableName: string,
	column: ColumnInfo,
	checkConstraints: CheckConstraint[],
	nullable: boolean
): string {
	// 1. Check for manual type override (for columns that store numbers but need string types)
	const overrideKey = `${tableName}.${column.name}`;
	const override = COLUMN_TYPE_OVERRIDES[overrideKey];
	if (override) {
		return nullable ? `(${override}) | null` : override;
	}

	// 2. Check if this column has a CHECK IN constraint (union type)
	const constraint = checkConstraints.find((c) => c.column === column.name);
	if (constraint && constraint.values.length > 0) {
		const unionType = constraint.values.map((v) => `'${v}'`).join(' | ');
		return nullable ? `(${unionType}) | null` : unionType;
	}

	// 3. Check if this is a boolean column based on naming patterns
	if (isBooleanColumn(column.name, column.type)) {
		return nullable ? 'boolean | null' : 'boolean';
	}

	// 4. Fall back to standard SQLite type mapping
	return sqliteTypeToTs(column.type, nullable);
}

/**
 * Convert snake_case to PascalCase
 */
function toPascalCase(str: string): string {
	return str
		.split('_')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join('');
}

/**
 * Check if a column has a default value or is auto-generated
 */
function isGenerated(column: ColumnInfo): boolean {
	// Primary key with INTEGER (autoincrement in SQLite)
	if (column.pk === 1 && column.type.toUpperCase().includes('INTEGER')) {
		return true;
	}

	// Has a default value
	if (column.dflt_value !== null) {
		return true;
	}

	return false;
}

/**
 * Check if a column is actually nullable
 * Primary key INTEGER columns are never nullable in practice
 */
function isNullable(column: ColumnInfo): boolean {
	// Primary key INTEGER columns are autoincrement and never null
	if (column.pk === 1 && column.type.toUpperCase().includes('INTEGER')) {
		return false;
	}

	return column.notnull === 0;
}

/**
 * Generate TypeScript interface for a table
 */
function generateTableInterface(table: TableInfo): string {
	const interfaceName = `${toPascalCase(table.name)}Table`;
	const lines: string[] = [];

	lines.push(`export interface ${interfaceName} {`);

	for (const column of table.columns) {
		const nullable = isNullable(column);
		const tsType = sqliteTypeToTs(column.type, nullable);
		const generated = isGenerated(column);

		if (generated) {
			// Wrap in Generated<T> for auto-generated columns
			const baseType = nullable ? tsType.replace(' | null', '') : tsType;
			lines.push(`\t${column.name}: Generated<${baseType}>${nullable ? ' | null' : ''};`);
		} else {
			lines.push(`\t${column.name}: ${tsType};`);
		}
	}

	lines.push('}');

	return lines.join('\n');
}

/**
 * Generate the database interface that maps table names to interfaces
 */
function generateDatabaseInterface(tables: TableInfo[]): string {
	const lines: string[] = [];

	lines.push('export interface PCDDatabase {');

	for (const table of tables) {
		const interfaceName = `${toPascalCase(table.name)}Table`;
		lines.push(`\t${table.name}: ${interfaceName};`);
	}

	lines.push('}');

	return lines.join('\n');
}

/**
 * Generate row types (non-Generated versions for query results)
 * Uses semantic types: booleans as boolean, CHECK IN as union types
 */
function generateRowType(table: TableInfo): string {
	const rowTypeName = `${toPascalCase(table.name)}Row`;
	const lines: string[] = [];

	lines.push(`export interface ${rowTypeName} {`);

	for (const column of table.columns) {
		const nullable = isNullable(column);
		const tsType = getSemanticType(table.name, column, table.checkConstraints, nullable);
		lines.push(`\t${column.name}: ${tsType};`);
	}

	lines.push('}');

	return lines.join('\n');
}

/**
 * Generate the complete types file
 */
function generateTypesFile(tables: TableInfo[], version: string): string {
	const lines: string[] = [];

	// Header
	lines.push(`/**
 * PCD Database Schema Types
 *
 * AUTO-GENERATED - DO NOT EDIT MANUALLY
 *
 * Generated from: https://github.com/${SCHEMA_REPO}/blob/${version}/${SCHEMA_PATH}
 * Generated at: ${new Date().toISOString()}
 *
 * To regenerate: deno task generate:pcd-types --version=${version}
 */

import type { Generated } from 'kysely';
`);

	// Group tables by entity - ordered by importance/usage
	const qualityProfileTables = [
		'quality_profiles',
		'quality_profile_tags',
		'quality_groups',
		'quality_group_members',
		'quality_profile_qualities',
		'quality_profile_languages',
		'quality_profile_custom_formats',
		'test_entities',
		'test_releases'
	];

	const customFormatTables = [
		'custom_formats',
		'custom_format_tags',
		'custom_format_conditions',
		'custom_format_tests'
		// condition_* tables added dynamically below
	];

	const regexTables = ['regular_expressions', 'regular_expression_tags'];

	const delayProfileTables = ['delay_profiles', 'delay_profile_tags'];

	const mediaManagementTables = [
		'radarr_naming',
		'sonarr_naming',
		'radarr_media_settings',
		'sonarr_media_settings',
		'radarr_quality_definitions',
		'sonarr_quality_definitions'
	];

	const coreTables = ['tags', 'languages', 'qualities', 'quality_api_mappings'];

	// Categories in display order
	const categories = [
		'QUALITY PROFILES',
		'CUSTOM FORMATS',
		'REGULAR EXPRESSIONS',
		'DELAY PROFILES',
		'MEDIA MANAGEMENT',
		'CORE'
	] as const;

	const categorized = new Map<string, TableInfo[]>();
	for (const cat of categories) {
		categorized.set(cat, []);
	}

	for (const table of tables) {
		if (qualityProfileTables.includes(table.name)) {
			categorized.get('QUALITY PROFILES')!.push(table);
		} else if (customFormatTables.includes(table.name) || table.name.startsWith('condition_')) {
			categorized.get('CUSTOM FORMATS')!.push(table);
		} else if (regexTables.includes(table.name)) {
			categorized.get('REGULAR EXPRESSIONS')!.push(table);
		} else if (delayProfileTables.includes(table.name)) {
			categorized.get('DELAY PROFILES')!.push(table);
		} else if (mediaManagementTables.includes(table.name)) {
			categorized.get('MEDIA MANAGEMENT')!.push(table);
		} else if (coreTables.includes(table.name)) {
			categorized.get('CORE')!.push(table);
		} else {
			// Unknown tables go to CORE as fallback
			console.warn(`Unknown table: ${table.name} - adding to CORE`);
			categorized.get('CORE')!.push(table);
		}
	}

	// Sort tables within each category by the predefined order
	const sortByOrder = (tables: TableInfo[], order: string[]): TableInfo[] => {
		return tables.sort((a, b) => {
			const aIndex = order.indexOf(a.name);
			const bIndex = order.indexOf(b.name);
			// Tables in the order list come first, sorted by their position
			// Tables not in the list (like condition_*) come after, sorted alphabetically
			if (aIndex === -1 && bIndex === -1) return a.name.localeCompare(b.name);
			if (aIndex === -1) return 1;
			if (bIndex === -1) return -1;
			return aIndex - bIndex;
		});
	};

	categorized.set(
		'QUALITY PROFILES',
		sortByOrder(categorized.get('QUALITY PROFILES')!, qualityProfileTables)
	);
	categorized.set(
		'CUSTOM FORMATS',
		sortByOrder(categorized.get('CUSTOM FORMATS')!, customFormatTables)
	);
	categorized.set(
		'REGULAR EXPRESSIONS',
		sortByOrder(categorized.get('REGULAR EXPRESSIONS')!, regexTables)
	);
	categorized.set(
		'DELAY PROFILES',
		sortByOrder(categorized.get('DELAY PROFILES')!, delayProfileTables)
	);
	categorized.set(
		'MEDIA MANAGEMENT',
		sortByOrder(categorized.get('MEDIA MANAGEMENT')!, mediaManagementTables)
	);
	categorized.set('CORE', sortByOrder(categorized.get('CORE')!, coreTables));

	// Generate Kysely table interfaces
	lines.push('// ============================================================================');
	lines.push('// KYSELY TABLE INTERFACES');
	lines.push('// ============================================================================');
	lines.push('// Use these with Kysely for type-safe queries with Generated<T> support');
	lines.push('');

	for (const [category, categoryTables] of categorized) {
		if (categoryTables.length === 0) continue;

		lines.push(`// ${category}`);
		lines.push('');

		for (const table of categoryTables) {
			lines.push(generateTableInterface(table));
			lines.push('');
		}
	}

	// Generate database interface
	lines.push('// ============================================================================');
	lines.push('// DATABASE INTERFACE');
	lines.push('// ============================================================================');
	lines.push('');
	lines.push(generateDatabaseInterface(tables));
	lines.push('');

	// Generate row types
	lines.push('// ============================================================================');
	lines.push('// ROW TYPES (Query Results)');
	lines.push('// ============================================================================');
	lines.push('// Use these for query result types (no Generated<T> wrapper)');
	lines.push('');

	for (const [category, categoryTables] of categorized) {
		if (categoryTables.length === 0) continue;

		lines.push(`// ${category}`);
		lines.push('');

		for (const table of categoryTables) {
			lines.push(generateRowType(table));
			lines.push('');
		}
	}

	// Generate common types
	lines.push('// ============================================================================');
	lines.push('// COMMON TYPES');
	lines.push('// ============================================================================');
	lines.push('');
	lines.push('/** Which arr application the data applies to */');
	lines.push("export type ArrType = 'radarr' | 'sonarr' | 'all';");
	lines.push('');

	// Generate helper types
	lines.push('// ============================================================================');
	lines.push('// HELPER TYPES');
	lines.push('// ============================================================================');
	lines.push('');
	lines.push('/** Extract insertable type from a table (Generated fields become optional) */');
	lines.push('export type Insertable<T> = {');
	lines.push('\t[K in keyof T]: T[K] extends Generated<infer U>');
	lines.push('\t\t? U | undefined');
	lines.push('\t\t: T[K] extends Generated<infer U> | null');
	lines.push('\t\t\t? U | null | undefined');
	lines.push('\t\t\t: T[K];');
	lines.push('};');
	lines.push('');
	lines.push('/** Extract selectable type from a table (Generated<T> becomes T) */');
	lines.push('export type Selectable<T> = {');
	lines.push('\t[K in keyof T]: T[K] extends Generated<infer U>');
	lines.push('\t\t? U');
	lines.push('\t\t: T[K] extends Generated<infer U> | null');
	lines.push('\t\t\t? U | null');
	lines.push('\t\t\t: T[K];');
	lines.push('};');
	lines.push('');

	return lines.join('\n');
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
	const args = parseArgs();

	if (args.help) {
		printHelp();
		Deno.exit(0);
	}

	try {
		// Load schema
		let schemaSql: string;
		let sourceVersion = args.version;

		if (args.localPath) {
			schemaSql = await loadSchemaFromFile(args.localPath);
			sourceVersion = 'local';
		} else {
			schemaSql = await fetchSchemaFromGitHub(args.version);
		}

		console.log(`Schema loaded (${schemaSql.length} bytes)`);

		// Create in-memory database and run schema
		console.log('Creating database and applying schema...');
		const db = new Database(':memory:');

		try {
			db.exec(schemaSql);
		} catch (error) {
			console.error('Failed to execute schema SQL:', error);
			Deno.exit(1);
		}

		// Introspect database
		console.log('Introspecting database structure...');
		const tables = introspectDatabase(db);
		console.log(`Found ${tables.length} tables`);

		// Generate types
		console.log('Generating TypeScript types...');
		const typesContent = generateTypesFile(tables, sourceVersion);

		// Ensure output directory exists
		await Deno.mkdir(OUTPUT_DIR, { recursive: true });

		// Write output
		await Deno.writeTextFile(OUTPUT_PATH, typesContent);
		console.log(`\nTypes written to: ${OUTPUT_PATH}`);

		// Summary
		console.log('\nGenerated types for:');
		for (const table of tables) {
			console.log(`  - ${table.name} (${table.columns.length} columns)`);
		}

		db.close();
	} catch (error) {
		console.error('Error:', error);
		Deno.exit(1);
	}
}

main();
