#!/usr/bin/env -S deno run --allow-read
/**
 * Validates condition values in a PCD's 1.initial.sql against
 * the expected values in conditionTypes.ts
 *
 * Usage: deno run --allow-read scripts/validate-condition-values.ts <path-to-1.initial.sql>
 */

import {
	SOURCE_VALUES,
	RESOLUTION_VALUES,
	QUALITY_MODIFIER_VALUES,
	RELEASE_TYPE_VALUES,
	INDEXER_FLAG_VALUES,
	CONDITION_TYPES
} from '../src/lib/shared/conditionTypes.ts';

// Build sets of valid values
const VALID_VALUES: Record<string, Set<string>> = {
	source: new Set(SOURCE_VALUES.map((v) => v.value)),
	resolution: new Set(RESOLUTION_VALUES.map((v) => v.value)),
	quality_modifier: new Set(QUALITY_MODIFIER_VALUES.map((v) => v.value)),
	release_type: new Set(RELEASE_TYPE_VALUES.map((v) => v.value)),
	indexer_flag: new Set(INDEXER_FLAG_VALUES.map((v) => v.value))
};

const VALID_CONDITION_TYPES = new Set(CONDITION_TYPES.map((t) => t.value));

// Table name to condition type mapping
const TABLE_TO_TYPE: Record<string, string> = {
	condition_sources: 'source',
	condition_resolutions: 'resolution',
	condition_quality_modifiers: 'quality_modifier',
	condition_release_types: 'release_type',
	condition_indexer_flags: 'indexer_flag'
};

interface Mismatch {
	table: string;
	type: string;
	value: string;
	line: number;
	validValues: string[];
}

interface TypeMismatch {
	value: string;
	line: number;
	validTypes: string[];
}

interface PatternMismatch {
	formatName: string;
	conditionName: string;
	patternName: string;
	line: number;
}

interface LanguageMismatch {
	formatName: string;
	conditionName: string;
	languageName: string;
	line: number;
}

interface FKMismatch {
	table: string;
	referencedTable: string;
	referencedColumn: string;
	value: string;
	line: number;
}

interface ConditionDataMismatch {
	formatName: string;
	conditionName: string;
	conditionType: string;
	expectedTable: string;
	line: number;
}

async function validateSqlContent(content: string) {
	const mismatches: Mismatch[] = [];
	const typeMismatches: TypeMismatch[] = [];
	const patternMismatches: PatternMismatch[] = [];
	const languageMismatches: LanguageMismatch[] = [];
	const fkMismatches: FKMismatch[] = [];
	const conditionDataMismatches: ConditionDataMismatch[] = [];

	const foundValues: Record<string, Set<string>> = {
		source: new Set(),
		resolution: new Set(),
		quality_modifier: new Set(),
		release_type: new Set(),
		indexer_flag: new Set()
	};
	const foundConditionTypes = new Set<string>();

	// Track defined entities
	const definedPatterns = new Set<string>();
	const definedLanguages = new Set<string>();
	const definedCustomFormats = new Set<string>();
	const definedTags = new Set<string>();

	// Track references for validation
	const referencedPatterns: {
		formatName: string;
		conditionName: string;
		patternName: string;
		line: number;
	}[] = [];
	const referencedLanguages: {
		formatName: string;
		conditionName: string;
		languageName: string;
		line: number;
	}[] = [];

	// Track conditions and their types for data integrity check
	const conditionDefinitions: Map<
		string,
		{ formatName: string; conditionName: string; type: string; line: number }
	> = new Map();
	const conditionDataEntries: Set<string> = new Set(); // "formatName|conditionName" for conditions that have data

	// Condition type to table mapping
	const CONDITION_TYPE_TO_TABLE: Record<string, string> = {
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

	// Process content by joining INSERT lines with their VALUES/SELECT lines
	// SQL format: INSERT INTO table (...)\nVALUES (...); or INSERT INTO table (...)\nSELECT ...;
	let joinedContent = content.replace(
		/INSERT INTO (\w+)\s*\([^)]+\)\s*\n\s*VALUES/gi,
		'INSERT INTO $1 VALUES'
	);
	// Also join INSERT...SELECT statements
	joinedContent = joinedContent.replace(
		/INSERT INTO (\w+)\s*\([^)]+\)\s*\n\s*SELECT/gi,
		'INSERT INTO $1 SELECT'
	);
	const joinedLines = joinedContent.split('\n');

	// Patterns to match INSERT...VALUES statements (now on same line after joining)
	// Format: INSERT INTO condition_sources VALUES ('format', 'condition', 'value');
	const patterns: Record<string, RegExp> = {
		condition_sources:
			/INSERT INTO condition_sources VALUES\s*\('[^']+',\s*'[^']+',\s*'([^']+)'\)/i,
		condition_resolutions:
			/INSERT INTO condition_resolutions VALUES\s*\('[^']+',\s*'[^']+',\s*'([^']+)'\)/i,
		condition_quality_modifiers:
			/INSERT INTO condition_quality_modifiers VALUES\s*\('[^']+',\s*'[^']+',\s*'([^']+)'\)/i,
		condition_release_types:
			/INSERT INTO condition_release_types VALUES\s*\('[^']+',\s*'[^']+',\s*'([^']+)'\)/i,
		condition_indexer_flags:
			/INSERT INTO condition_indexer_flags VALUES\s*\('[^']+',\s*'[^']+',\s*'([^']+)'\)/i
	};

	// Pattern for condition types in custom_format_conditions
	// Format: INSERT INTO custom_format_conditions (...)\nSELECT cf.name, 'name', 'type', 'arrType', negate, required
	// After joining: INSERT INTO custom_format_conditions SELECT cf.name, 'name', 'type', ...
	const conditionTypePattern =
		/INSERT INTO custom_format_conditions\s+SELECT\s+cf\.name,\s*'[^']+',\s*'([^']+)'/i;

	// Pattern for regular_expressions definitions
	// Format: INSERT INTO regular_expressions (name, pattern, description) VALUES ('name', 'pattern', 'desc');
	const regexDefPattern = /INSERT INTO regular_expressions.*VALUES\s*\('([^']+)'/i;

	// Pattern for languages INSERT start
	const languageInsertStartPattern = /INSERT INTO languages.*VALUES/i;
	// Pattern for language value rows: ('English'),
	const languageValuePattern = /^\s*\('([^']+)'\)[,;]?\s*$/;

	// Pattern for custom_formats definitions
	// Format: INSERT INTO custom_formats (name, ...) VALUES ('name', ...);
	const customFormatDefPattern = /INSERT INTO custom_formats.*VALUES\s*\('([^']+)'/i;

	// Pattern for tags definitions
	// Format: INSERT INTO tags (name) VALUES ('name');
	const tagDefPattern = /INSERT INTO tags.*VALUES\s*\('([^']+)'\)/i;

	// Pattern for condition_patterns references (multi-line, need to track context)
	// Format: INSERT INTO condition_patterns ... SELECT 'format', 'condition', re.name ... WHERE re.name = 'pattern';
	const conditionPatternSelectPattern =
		/INSERT INTO condition_patterns\s+SELECT\s+'([^']+)',\s*'([^']+)'/i;
	const wherePatternPattern = /WHERE\s+re\.name\s*=\s*'([^']+)'/i;

	// Pattern for condition_languages references
	// Format: INSERT INTO condition_languages ... SELECT 'format', 'condition', l.name ... WHERE l.name = 'lang';
	const conditionLanguageSelectPattern =
		/INSERT INTO condition_languages\s+SELECT\s+'([^']+)',\s*'([^']+)'/i;
	const whereLanguagePattern = /WHERE\s+l\.name\s*=\s*'([^']+)'/i;

	// Pattern for custom_format_conditions
	// After joining: INSERT INTO custom_format_conditions SELECT cf.name, 'conditionName', 'type', 'arrType', ...
	const conditionDefPattern =
		/INSERT INTO custom_format_conditions\s+SELECT\s+cf\.name,\s*'([^']+)',\s*'([^']+)'/i;
	// Also need to capture the format name from WHERE clause
	const whereFormatPattern = /WHERE\s+cf\.name\s*=\s*'([^']+)'/i;

	// Patterns for condition data tables (to track which conditions have data)
	const conditionDataPatterns: Record<string, RegExp> = {
		condition_sources: /INSERT INTO condition_sources VALUES\s*\('([^']+)',\s*'([^']+)'/i,
		condition_resolutions: /INSERT INTO condition_resolutions VALUES\s*\('([^']+)',\s*'([^']+)'/i,
		condition_quality_modifiers:
			/INSERT INTO condition_quality_modifiers VALUES\s*\('([^']+)',\s*'([^']+)'/i,
		condition_release_types:
			/INSERT INTO condition_release_types VALUES\s*\('([^']+)',\s*'([^']+)'/i,
		condition_indexer_flags:
			/INSERT INTO condition_indexer_flags VALUES\s*\('([^']+)',\s*'([^']+)'/i,
		condition_sizes: /INSERT INTO condition_sizes VALUES\s*\('([^']+)',\s*'([^']+)'/i,
		condition_years: /INSERT INTO condition_years VALUES\s*\('([^']+)',\s*'([^']+)'/i
	};

	let currentConditionPatternContext: { formatName: string; conditionName: string } | null = null;
	let currentConditionLanguageContext: { formatName: string; conditionName: string } | null = null;
	let currentConditionDefContext: { conditionName: string; type: string; line: number } | null =
		null;
	let inLanguagesInsert = false;

	for (let i = 0; i < joinedLines.length; i++) {
		const line = joinedLines[i];
		const lineNum = i + 1;

		// ========== ENTITY DEFINITIONS ==========

		// Check for regular_expressions definitions
		const regexDefMatch = line.match(regexDefPattern);
		if (regexDefMatch) {
			definedPatterns.add(regexDefMatch[1]);
		}

		// Check for languages definitions (multi-value INSERT format)
		if (line.match(languageInsertStartPattern)) {
			inLanguagesInsert = true;
		}
		if (inLanguagesInsert) {
			const languageMatch = line.match(languageValuePattern);
			if (languageMatch) {
				definedLanguages.add(languageMatch[1]);
			}
			// End of INSERT block (line ends with semicolon or next INSERT starts)
			if (
				line.includes(';') ||
				(line.match(/^INSERT/i) && !line.match(languageInsertStartPattern))
			) {
				inLanguagesInsert = false;
			}
		}

		// Check for custom_formats definitions
		const customFormatDefMatch = line.match(customFormatDefPattern);
		if (customFormatDefMatch) {
			definedCustomFormats.add(customFormatDefMatch[1]);
		}

		// Check for tags definitions
		const tagDefMatch = line.match(tagDefPattern);
		if (tagDefMatch) {
			definedTags.add(tagDefMatch[1]);
		}

		// ========== CONDITION DEFINITIONS ==========

		// Check for condition definition (to track type)
		const conditionDefMatch = line.match(conditionDefPattern);
		if (conditionDefMatch) {
			currentConditionDefContext = {
				conditionName: conditionDefMatch[1],
				type: conditionDefMatch[2],
				line: lineNum
			};
		}

		// Capture format name for condition definition
		const whereFormatMatch = line.match(whereFormatPattern);
		if (whereFormatMatch && currentConditionDefContext) {
			const key = `${whereFormatMatch[1]}|${currentConditionDefContext.conditionName}`;
			conditionDefinitions.set(key, {
				formatName: whereFormatMatch[1],
				conditionName: currentConditionDefContext.conditionName,
				type: currentConditionDefContext.type,
				line: currentConditionDefContext.line
			});
			currentConditionDefContext = null;
		}

		// ========== PATTERN REFERENCES ==========

		// Check for condition_patterns SELECT (captures format and condition names)
		const conditionPatternMatch = line.match(conditionPatternSelectPattern);
		if (conditionPatternMatch) {
			currentConditionPatternContext = {
				formatName: conditionPatternMatch[1],
				conditionName: conditionPatternMatch[2]
			};
			// Mark that this condition has data
			conditionDataEntries.add(`${conditionPatternMatch[1]}|${conditionPatternMatch[2]}`);
		}

		// Check for WHERE re.name = 'pattern' (the actual pattern reference)
		const wherePatternMatch = line.match(wherePatternPattern);
		if (wherePatternMatch && currentConditionPatternContext) {
			referencedPatterns.push({
				formatName: currentConditionPatternContext.formatName,
				conditionName: currentConditionPatternContext.conditionName,
				patternName: wherePatternMatch[1],
				line: lineNum
			});
			currentConditionPatternContext = null;
		}

		// ========== LANGUAGE REFERENCES ==========

		// Check for condition_languages SELECT
		const conditionLanguageMatch = line.match(conditionLanguageSelectPattern);
		if (conditionLanguageMatch) {
			currentConditionLanguageContext = {
				formatName: conditionLanguageMatch[1],
				conditionName: conditionLanguageMatch[2]
			};
			// Mark that this condition has data
			conditionDataEntries.add(`${conditionLanguageMatch[1]}|${conditionLanguageMatch[2]}`);
		}

		// Check for WHERE l.name = 'language'
		const whereLanguageMatch = line.match(whereLanguagePattern);
		if (whereLanguageMatch && currentConditionLanguageContext) {
			referencedLanguages.push({
				formatName: currentConditionLanguageContext.formatName,
				conditionName: currentConditionLanguageContext.conditionName,
				languageName: whereLanguageMatch[1],
				line: lineNum
			});
			currentConditionLanguageContext = null;
		}

		// ========== CONDITION DATA TABLES ==========

		// Check condition data tables (to track which conditions have data)
		for (const [_table, pattern] of Object.entries(conditionDataPatterns)) {
			const match = line.match(pattern);
			if (match) {
				conditionDataEntries.add(`${match[1]}|${match[2]}`);
			}
		}

		// ========== CONDITION TYPES ==========

		// Check condition types
		const typeMatch = line.match(conditionTypePattern);
		if (typeMatch) {
			const conditionType = typeMatch[1]; // type is the 1st capture group now
			foundConditionTypes.add(conditionType);
			if (!VALID_CONDITION_TYPES.has(conditionType)) {
				typeMismatches.push({
					value: conditionType,
					line: lineNum,
					validTypes: Array.from(VALID_CONDITION_TYPES)
				});
			}
		}

		// ========== CONDITION VALUES ==========

		// Check value tables
		for (const [table, pattern] of Object.entries(patterns)) {
			const match = line.match(pattern);
			if (match) {
				const value = match[1];
				const type = TABLE_TO_TYPE[table];
				foundValues[type].add(value);

				if (!VALID_VALUES[type].has(value)) {
					mismatches.push({
						table,
						type,
						value,
						line: lineNum,
						validValues: Array.from(VALID_VALUES[type])
					});
				}
			}
		}
	}

	// ========== POST-LOOP VALIDATION ==========

	// Check for missing patterns
	for (const ref of referencedPatterns) {
		if (!definedPatterns.has(ref.patternName)) {
			patternMismatches.push(ref);
		}
	}

	// Check for missing languages
	for (const ref of referencedLanguages) {
		if (!definedLanguages.has(ref.languageName)) {
			languageMismatches.push(ref);
		}
	}

	// Check for conditions without corresponding data
	for (const [key, def] of conditionDefinitions) {
		const expectedTable = CONDITION_TYPE_TO_TABLE[def.type];
		if (expectedTable && !conditionDataEntries.has(key)) {
			conditionDataMismatches.push({
				formatName: def.formatName,
				conditionName: def.conditionName,
				conditionType: def.type,
				expectedTable,
				line: def.line
			});
		}
	}

	return {
		mismatches,
		typeMismatches,
		patternMismatches,
		languageMismatches,
		fkMismatches,
		conditionDataMismatches,
		foundValues,
		foundConditionTypes,
		definedPatterns,
		definedLanguages,
		definedCustomFormats,
		definedTags,
		referencedPatterns,
		conditionDefinitions
	};
}

// Find all SQL files in a database directory (including deps)
async function findAllSqlFiles(dbPath: string): Promise<string[]> {
	const files: string[] = [];

	// Get the database directory (parent of ops/)
	const dbDir = dbPath.replace(/\/ops\/.*$/, '');

	// Add deps schema files first (they define base entities like languages)
	const depsDir = `${dbDir}/deps/schema/ops`;
	try {
		for await (const entry of Deno.readDir(depsDir)) {
			if (entry.isFile && entry.name.endsWith('.sql')) {
				files.push(`${depsDir}/${entry.name}`);
			}
		}
	} catch {
		// deps dir might not exist
	}

	// Add the main file
	files.push(dbPath);

	return files.sort();
}

async function main() {
	const args = Deno.args;
	if (args.length === 0) {
		console.log('Usage: deno run --allow-read scripts/validate-condition-values.ts <sql-file>');
		console.log('');
		console.log('Example:');
		console.log(
			'  deno run --allow-read scripts/validate-condition-values.ts dist/dev/data/databases/*/ops/1.initial.sql'
		);
		console.log('');
		console.log('Note: The script automatically includes deps/schema/ops/*.sql files');
		Deno.exit(1);
	}

	for (const filePath of args) {
		console.log(`\n${'='.repeat(60)}`);
		console.log(`Validating: ${filePath}`);
		console.log('='.repeat(60));

		try {
			// Find all SQL files including deps
			const allFiles = await findAllSqlFiles(filePath);
			console.log(`Including ${allFiles.length} SQL file(s):`);
			for (const f of allFiles) {
				console.log(`  - ${f.split('/').slice(-3).join('/')}`);
			}

			// Concatenate all SQL content
			let combinedContent = '';
			for (const f of allFiles) {
				combinedContent += (await Deno.readTextFile(f)) + '\n';
			}

			const {
				mismatches,
				typeMismatches,
				patternMismatches,
				languageMismatches,
				conditionDataMismatches,
				foundValues,
				foundConditionTypes,
				definedPatterns,
				definedLanguages,
				definedCustomFormats,
				referencedPatterns,
				conditionDefinitions
			} = await validateSqlContent(combinedContent);

			let hasErrors = false;

			// Report condition type mismatches
			if (typeMismatches.length > 0) {
				hasErrors = true;
				console.log(`\n❌ Found ${typeMismatches.length} invalid condition type(s):`);
				for (const m of typeMismatches) {
					console.log(`   Line ${m.line}: "${m.value}"`);
					console.log(`   Valid types: ${m.validTypes.join(', ')}`);
				}
			}

			// Report value mismatches
			if (mismatches.length > 0) {
				hasErrors = true;
				console.log(`\n❌ Found ${mismatches.length} invalid value(s):`);
				for (const m of mismatches) {
					console.log(`   Line ${m.line}: ${m.type} = "${m.value}"`);
					console.log(`   Valid values: ${m.validValues.join(', ')}`);
				}
			}

			// Report missing patterns
			if (patternMismatches.length > 0) {
				hasErrors = true;
				console.log(`\n❌ Found ${patternMismatches.length} missing pattern(s):`);
				for (const m of patternMismatches) {
					console.log(`   Line ${m.line}: Format "${m.formatName}" condition "${m.conditionName}"`);
					console.log(`   References missing pattern: "${m.patternName}"`);
				}
			}

			// Report missing languages
			if (languageMismatches.length > 0) {
				hasErrors = true;
				console.log(`\n❌ Found ${languageMismatches.length} missing language(s):`);
				for (const m of languageMismatches) {
					console.log(`   Line ${m.line}: Format "${m.formatName}" condition "${m.conditionName}"`);
					console.log(`   References missing language: "${m.languageName}"`);
				}
			}

			// Report conditions without data
			if (conditionDataMismatches.length > 0) {
				hasErrors = true;
				console.log(`\n❌ Found ${conditionDataMismatches.length} condition(s) without data:`);
				for (const m of conditionDataMismatches) {
					console.log(`   Line ${m.line}: Format "${m.formatName}" condition "${m.conditionName}"`);
					console.log(`   Type "${m.conditionType}" requires data in "${m.expectedTable}"`);
				}
			}

			if (!hasErrors) {
				console.log('\n✅ All validations passed!');
			}

			// Summary
			console.log('\n--- Summary ---');
			console.log(`Custom formats: ${definedCustomFormats.size}`);
			console.log(`Conditions: ${conditionDefinitions.size}`);
			console.log(
				`Patterns: ${definedPatterns.size} defined, ${referencedPatterns.length} referenced`
			);
			console.log(`Languages: ${definedLanguages.size}`);
			console.log(`Condition types: ${Array.from(foundConditionTypes).sort().join(', ')}`);

			// Detailed values found
			console.log('\n--- Condition values used ---');
			for (const [type, values] of Object.entries(foundValues)) {
				if (values.size > 0) {
					console.log(`${type}: ${Array.from(values).sort().join(', ')}`);
				}
			}
		} catch (error) {
			console.error(`Error reading file: ${error}`);
		}
	}
}

main();
