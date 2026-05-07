/**
 * PCD conflict tests: custom format conditions.
 */

import { assertEquals, assertExists } from '@std/assert';
import { startServer, stopServer } from '$test-harness/server.ts';
import { openDb } from '$test-harness/db.ts';
import { run, setup, teardown, test } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';
import type { ConditionData } from '$shared/pcd/display.ts';
import { base } from '../harness/fixtures.ts';
import {
	compilePcd,
	insertOp,
	opCheckpoint,
	parseMetadata,
	queryOpsSince,
	seedBase,
	setupPcd,
	type ConflictStrategy,
	type OpRow,
	type PcdTestContext,
	type SeedOperation
} from '../harness/pcd.ts';
import { write } from '../harness/write.ts';

const PORT = PORTS.pcd.conflictsCustomFormatConditions;
const ORIGIN = `http://localhost:${PORT}`;
const STRATEGIES: ConflictStrategy[] = ['ask', 'align', 'override'];
const FORMAT_NAME = 'x265';
const CONDITION_NAME = 'Not 2160p';
const ORIGINAL_RESOLUTION = '2160p';
const CONDITION_A = 'E2E Cond A 1.15';
const CONDITION_B = 'E2E Cond B 1.15';
const LOCAL_SOURCE = 'Bluray';
const UPSTREAM_SOURCE = 'WEB-DL';
const CONDITION_A_INITIAL_SOURCE = 'Bluray';
const CONDITION_B_INITIAL_SOURCE = 'WEB-DL';
const LOCAL_A_SOURCE = 'DVD';
const LOCAL_B_SOURCE = 'Television';
const UPSTREAM_B_SOURCE = 'WEBRip';
const UPSTREAM_C_RESOLUTION = '720p';
const RENAMED_CONDITION = 'Not 2160p Renamed';
const PATTERN_CONDITION = 'E2E Pattern Cond 1.19';
const REGEX_A = 'E2E Pattern A 1.19';
const REGEX_B = 'E2E Pattern B 1.19';
const REGEX_C = 'E2E Pattern C 1.19';
const REGEX_A_PATTERN = '\\bTESTA\\b';
const REGEX_B_PATTERN = '\\bTESTB\\b';
const REGEX_C_PATTERN = '\\bTESTC\\b';
const REGEX_DEP_CONDITION = 'E2E Regex Condition 1.23';
const REGEX_DEP = 'E2E Regex Dep 1.23';
const REGEX_DEP_PATTERN_V1 = '\\bDEP123\\b';
const REGEX_DEP_PATTERN_V2 = '\\bDEP456\\b';
const LANGUAGE_CONDITION = 'E2E Language Cond 1.20';
const BASE_LANGUAGE = 'English';
const LOCAL_LANGUAGE = 'French';
const UPSTREAM_LANGUAGE = 'Spanish';
const SIZE_CONDITION = 'E2E Size Cond 1.21';
const BASE_MIN_BYTES = 1_000_000;
const LOCAL_MIN_BYTES = 2_000_000;
const UPSTREAM_MIN_BYTES = 3_000_000;
const YEAR_CONDITION = 'E2E Year Cond 1.22';
const BASE_MIN_YEAR = 2000;
const LOCAL_MIN_YEAR = 2001;
const UPSTREAM_MIN_YEAR = 2002;

type LatestHistory = {
	status: string;
	conflict_reason: string | null;
};

type ConditionRow = {
	custom_format_name: string;
	name: string;
	type: string;
	arr_type: string;
	negate: number;
	required: number;
};

type ResolutionRow = {
	custom_format_name: string;
	condition_name: string;
	resolution: string;
};

type SourceRow = {
	custom_format_name: string;
	condition_name: string;
	source: string;
};

type PatternRow = {
	custom_format_name: string;
	condition_name: string;
	regular_expression_name: string;
};

type LanguageRow = {
	custom_format_name: string;
	condition_name: string;
	language_name: string;
	except_language: number;
};

type SizeRow = {
	custom_format_name: string;
	condition_name: string;
	min_bytes: number | null;
	max_bytes: number | null;
};

type YearRow = {
	custom_format_name: string;
	condition_name: string;
	min_year: number | null;
	max_year: number | null;
};

type RegexRow = {
	name: string;
	pattern: string;
};

let counter = 0;

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

teardown(async () => {
	await stopServer(PORT);
});

/**
 * Migrates old 1.5 and 1.13.
 *
 * Context
 *   Base layer seeded with one custom format resolution condition:
 *     format='x265', condition='Not 2160p', resolution='2160p'
 *
 * User
 *   POST conditions update changes:
 *     condition 'Not 2160p' resolution = '1080p'
 *
 * Upstream
 *   Published base op changes:
 *     condition 'Not 2160p' resolution '2160p' -> '720p'
 *
 * Expect
 *   - condition op conflicts by strategy
 *   - final resolution is user value only for override, otherwise upstream
 */
test('same condition resolution conflict resolves by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'condition-resolution-conflict');
		const checkpoint = opCheckpoint(ctx);

		await write.customFormat.updateConditions(ctx, 1, [
			resolutionCondition(CONDITION_NAME, '1080p')
		]);

		seedUpstream(
			ctx,
			upstreamUpdateResolution(FORMAT_NAME, CONDITION_NAME, ORIGINAL_RESOLUTION, '720p')
		);
		await compilePcd(ctx);

		const op = firstOpForCondition(opsSince(ctx, checkpoint), CONDITION_NAME);
		assertStrategyOutcome(ctx, op, strategy, 'duplicate_key');

		assertConditionResolution(
			ctx,
			FORMAT_NAME,
			CONDITION_NAME,
			strategy === 'override' ? '1080p' : '720p'
		);
	}
});

/**
 * Context
 *   Base layer seeded with one custom format resolution condition:
 *     format='x265', condition='Not 2160p', resolution='2160p'
 *
 * User
 *   POST conditions update changes:
 *     condition 'Not 2160p' type='source', source='Bluray'
 *
 * Upstream
 *   Published base op changes the same condition to:
 *     type='source', source='WEB-DL'
 *
 * Expect
 *   - condition op conflicts by strategy
 *   - final source is user value only for override, otherwise upstream
 */
test('condition type and source value conflict resolves by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'condition-type-source-conflict');
		const checkpoint = opCheckpoint(ctx);

		await write.customFormat.updateConditions(ctx, 1, [
			sourceCondition(CONDITION_NAME, LOCAL_SOURCE, true)
		]);

		seedUpstream(
			ctx,
			upstreamChangeResolutionToSource(
				FORMAT_NAME,
				CONDITION_NAME,
				ORIGINAL_RESOLUTION,
				UPSTREAM_SOURCE
			)
		);
		await compilePcd(ctx);

		const op = firstOpForCondition(opsSince(ctx, checkpoint), CONDITION_NAME);
		assertStrategyOutcome(ctx, op, strategy, 'duplicate_key');

		assertConditionSource(
			ctx,
			FORMAT_NAME,
			CONDITION_NAME,
			strategy === 'override' ? LOCAL_SOURCE : UPSTREAM_SOURCE
		);
	}
});

/**
 * Context
 *   Base layer seeded with three custom format conditions:
 *     A source='Bluray', B source='WEB-DL', C resolution='2160p'
 *
 * User
 *   POST conditions update changes:
 *     A source='DVD'
 *     B source='Television'
 *
 * Upstream
 *   Published base ops change:
 *     B source='WEBRip'
 *     C resolution='720p'
 *
 * Expect
 *   - A applies cleanly for every strategy
 *   - B conflicts by strategy
 *   - C keeps upstream value for every strategy
 */
test('multiple condition changes isolate overlapping conflict', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'multiple-condition-conflicts', [
			multiConditionSeed()
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.customFormat.updateConditions(ctx, 1, [
			sourceCondition(CONDITION_A, LOCAL_A_SOURCE),
			sourceCondition(CONDITION_B, LOCAL_B_SOURCE),
			resolutionCondition(CONDITION_NAME, ORIGINAL_RESOLUTION)
		]);

		seedUpstream(
			ctx,
			upstreamUpdateSource(FORMAT_NAME, CONDITION_B, CONDITION_B_INITIAL_SOURCE, UPSTREAM_B_SOURCE)
		);
		seedUpstream(
			ctx,
			upstreamUpdateResolution(
				FORMAT_NAME,
				CONDITION_NAME,
				ORIGINAL_RESOLUTION,
				UPSTREAM_C_RESOLUTION
			)
		);
		await compilePcd(ctx);

		const userOps = opsSince(ctx, checkpoint);
		const opA = firstOpForCondition(userOps, CONDITION_A);
		assertEquals(opA.state, 'published');
		assertLatestHistory(ctx, opA, 'applied');

		const opB = firstOpForCondition(userOps, CONDITION_B);
		assertStrategyOutcome(ctx, opB, strategy, 'duplicate_key');

		assertConditionSource(ctx, FORMAT_NAME, CONDITION_A, LOCAL_A_SOURCE);
		assertConditionSource(
			ctx,
			FORMAT_NAME,
			CONDITION_B,
			strategy === 'override' ? LOCAL_B_SOURCE : UPSTREAM_B_SOURCE
		);
		assertConditionResolution(ctx, FORMAT_NAME, CONDITION_NAME, UPSTREAM_C_RESOLUTION);
	}
});

/**
 * Context
 *   Base layer seeded with one custom format resolution condition.
 *
 * User
 *   POST conditions update renames:
 *     'Not 2160p' -> 'Not 2160p Renamed'
 *
 * Upstream
 *   Published base op changes:
 *     required false -> true
 *
 * Expect
 *   - rename delete op conflicts by strategy
 *   - override removes the upstream condition and keeps the renamed local condition
 *   - ask/align keep both conditions under current strategy-driven compile behavior
 */
test('condition rename conflict resolves by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'condition-rename-conflict');
		const checkpoint = opCheckpoint(ctx);

		await write.customFormat.updateConditions(ctx, 1, [
			resolutionCondition(RENAMED_CONDITION, ORIGINAL_RESOLUTION)
		]);

		seedUpstream(ctx, upstreamUpdateRequired(FORMAT_NAME, CONDITION_NAME, false, true));
		await compilePcd(ctx);

		const userOps = opsSince(ctx, checkpoint);
		const deleteOp = firstOpForCondition(userOps, CONDITION_NAME);
		assertStrategyOutcome(ctx, deleteOp, strategy, 'guard_mismatch');

		const addOp = firstOpForCondition(userOps, RENAMED_CONDITION);
		assertEquals(addOp.state, 'published');
		assertLatestHistory(ctx, addOp, 'applied');

		assertConditionResolution(ctx, FORMAT_NAME, RENAMED_CONDITION, ORIGINAL_RESOLUTION);
		assertConditionBase(ctx, FORMAT_NAME, RENAMED_CONDITION, {
			type: 'resolution',
			arrType: 'all',
			negate: true,
			required: false
		});

		if (strategy === 'override') {
			assertNoCondition(ctx, FORMAT_NAME, CONDITION_NAME);
		} else {
			assertConditionResolution(ctx, FORMAT_NAME, CONDITION_NAME, ORIGINAL_RESOLUTION);
			assertConditionBase(ctx, FORMAT_NAME, CONDITION_NAME, {
				type: 'resolution',
				arrType: 'all',
				negate: true,
				required: true
			});
		}
	}
});

/**
 * Context
 *   Base layer seeded with one custom format resolution condition.
 *
 * User
 *   POST conditions update changes:
 *     required false -> true
 *     arrType all -> radarr
 *
 * Upstream
 *   Published base op changes:
 *     negate true -> false
 *
 * Expect
 *   - condition op conflicts by strategy
 *   - override keeps local required/arrType and original negate
 *   - ask/align keep upstream negate and original required/arrType
 */
test('condition base toggles conflict by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'condition-toggle-conflict');
		const checkpoint = opCheckpoint(ctx);

		await write.customFormat.updateConditions(ctx, 1, [
			resolutionCondition(CONDITION_NAME, ORIGINAL_RESOLUTION, {
				arrType: 'radarr',
				required: true,
				negate: true
			})
		]);

		seedUpstream(ctx, upstreamUpdateNegate(FORMAT_NAME, CONDITION_NAME, true, false));
		await compilePcd(ctx);

		const op = firstOpForCondition(opsSince(ctx, checkpoint), CONDITION_NAME);
		assertStrategyOutcome(ctx, op, strategy, 'guard_mismatch');

		assertConditionBase(
			ctx,
			FORMAT_NAME,
			CONDITION_NAME,
			strategy === 'override'
				? { type: 'resolution', arrType: 'radarr', negate: true, required: true }
				: { type: 'resolution', arrType: 'all', negate: false, required: false }
		);
	}
});

/**
 * Context
 *   Base layer seeded with three regexes and one release title pattern condition.
 *
 * User
 *   POST conditions update changes:
 *     pattern REGEX_A -> REGEX_B
 *
 * Upstream
 *   Published base op changes:
 *     pattern REGEX_A -> REGEX_C
 *
 * Expect
 *   - condition op conflicts by strategy
 *   - final pattern is user value only for override, otherwise upstream
 */
test('pattern condition value conflict resolves by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'condition-pattern-conflict', patternSeed());
		const checkpoint = opCheckpoint(ctx);

		await write.customFormat.updateConditions(ctx, 1, [
			patternCondition(PATTERN_CONDITION, REGEX_B, REGEX_B_PATTERN)
		]);

		seedUpstream(ctx, upstreamUpdatePattern(FORMAT_NAME, PATTERN_CONDITION, REGEX_A, REGEX_C));
		await compilePcd(ctx);

		const op = firstOpForCondition(opsSince(ctx, checkpoint), PATTERN_CONDITION);
		assertStrategyOutcome(ctx, op, strategy, 'duplicate_key');

		assertConditionPattern(
			ctx,
			FORMAT_NAME,
			PATTERN_CONDITION,
			strategy === 'override' ? REGEX_B : REGEX_C
		);
	}
});

/**
 * Context
 *   Base layer seeded with one regex and one release title pattern condition.
 *
 * User
 *   POST conditions update changes:
 *     condition required false -> true
 *
 * Upstream
 *   Published base op changes:
 *     referenced regex pattern V1 -> V2
 *
 * Expect
 *   - condition op applies cleanly for every strategy
 *   - no pending conflicts remain
 *   - condition keeps the local required toggle and regex gets upstream pattern
 */
test('condition update applies when referenced regex changes upstream', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'condition-regex-dependency', regexDependencySeed());
		const checkpoint = opCheckpoint(ctx);

		await write.customFormat.updateConditions(ctx, 1, [
			patternCondition(REGEX_DEP_CONDITION, REGEX_DEP, REGEX_DEP_PATTERN_V1, {
				required: true
			})
		]);

		seedUpstream(
			ctx,
			upstreamUpdateRegexPattern(REGEX_DEP, REGEX_DEP_PATTERN_V1, REGEX_DEP_PATTERN_V2)
		);
		await compilePcd(ctx);

		const op = firstOpForCondition(opsSince(ctx, checkpoint), REGEX_DEP_CONDITION);
		assertEquals(op.state, 'published');
		assertLatestHistory(ctx, op, 'applied');
		assertNoPendingConflicts(ctx);

		assertConditionBase(ctx, FORMAT_NAME, REGEX_DEP_CONDITION, {
			type: 'release_title',
			arrType: 'all',
			negate: false,
			required: true
		});
		assertConditionPattern(ctx, FORMAT_NAME, REGEX_DEP_CONDITION, REGEX_DEP);
		assertRegexPattern(ctx, REGEX_DEP, REGEX_DEP_PATTERN_V2);
	}
});

/**
 * Context
 *   Base layer seeded with one language condition and all referenced languages.
 *
 * User
 *   POST conditions update changes:
 *     language English -> French
 *
 * Upstream
 *   Published base op changes:
 *     language English -> Spanish
 *
 * Expect
 *   - condition op conflicts by strategy
 *   - final language is user value only for override, otherwise upstream
 */
test('language condition value conflict resolves by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'condition-language-conflict', [
			languageConditionSeed(LANGUAGE_CONDITION, BASE_LANGUAGE)
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.customFormat.updateConditions(ctx, 1, [
			languageCondition(LANGUAGE_CONDITION, LOCAL_LANGUAGE)
		]);

		seedUpstream(
			ctx,
			upstreamUpdateLanguage(FORMAT_NAME, LANGUAGE_CONDITION, BASE_LANGUAGE, UPSTREAM_LANGUAGE)
		);
		await compilePcd(ctx);

		const op = firstOpForCondition(opsSince(ctx, checkpoint), LANGUAGE_CONDITION);
		assertStrategyOutcome(ctx, op, strategy, 'duplicate_key');

		assertConditionLanguage(
			ctx,
			FORMAT_NAME,
			LANGUAGE_CONDITION,
			strategy === 'override' ? LOCAL_LANGUAGE : UPSTREAM_LANGUAGE
		);
	}
});

/**
 * Context
 *   Base layer seeded with one size condition.
 *
 * User
 *   POST conditions update changes:
 *     minBytes BASE -> LOCAL
 *
 * Upstream
 *   Published base op changes:
 *     minBytes BASE -> UPSTREAM
 *
 * Expect
 *   - condition op conflicts by strategy
 *   - final size is user value only for override, otherwise upstream
 */
test('size condition value conflict resolves by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'condition-size-conflict', [
			sizeConditionSeed(SIZE_CONDITION, BASE_MIN_BYTES)
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.customFormat.updateConditions(ctx, 1, [
			sizeCondition(SIZE_CONDITION, LOCAL_MIN_BYTES)
		]);

		seedUpstream(
			ctx,
			upstreamUpdateSize(FORMAT_NAME, SIZE_CONDITION, BASE_MIN_BYTES, UPSTREAM_MIN_BYTES)
		);
		await compilePcd(ctx);

		const op = firstOpForCondition(opsSince(ctx, checkpoint), SIZE_CONDITION);
		assertStrategyOutcome(ctx, op, strategy, 'duplicate_key');

		assertConditionSize(
			ctx,
			FORMAT_NAME,
			SIZE_CONDITION,
			strategy === 'override' ? LOCAL_MIN_BYTES : UPSTREAM_MIN_BYTES
		);
	}
});

/**
 * Context
 *   Base layer seeded with one year condition.
 *
 * User
 *   POST conditions update changes:
 *     minYear BASE -> LOCAL
 *
 * Upstream
 *   Published base op changes:
 *     minYear BASE -> UPSTREAM
 *
 * Expect
 *   - condition op conflicts by strategy
 *   - final year is user value only for override, otherwise upstream
 */
test('year condition value conflict resolves by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'condition-year-conflict', [
			yearConditionSeed(YEAR_CONDITION, BASE_MIN_YEAR)
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.customFormat.updateConditions(ctx, 1, [
			yearCondition(YEAR_CONDITION, LOCAL_MIN_YEAR)
		]);

		seedUpstream(
			ctx,
			upstreamUpdateYear(FORMAT_NAME, YEAR_CONDITION, BASE_MIN_YEAR, UPSTREAM_MIN_YEAR)
		);
		await compilePcd(ctx);

		const op = firstOpForCondition(opsSince(ctx, checkpoint), YEAR_CONDITION);
		assertStrategyOutcome(ctx, op, strategy, 'duplicate_key');

		assertConditionYear(
			ctx,
			FORMAT_NAME,
			YEAR_CONDITION,
			strategy === 'override' ? LOCAL_MIN_YEAR : UPSTREAM_MIN_YEAR
		);
	}
});

/**
 * Context
 *   Base layer seeded with one custom format resolution condition:
 *     format='x265', condition='Not 2160p', resolution='2160p'
 *
 * User
 *   POST conditions update changes:
 *     condition 'Not 2160p' resolution = '1080p'
 *
 * Upstream
 *   Published base op adds:
 *     condition='Upstream 720p', resolution='720p'
 *
 * Expect
 *   - user condition op applies cleanly for every strategy
 *   - no pending conflicts remain
 *   - final state has the user-updated condition plus the upstream-added condition
 */
test('local condition update applies when upstream adds different condition', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'condition-add-no-conflict');
		const checkpoint = opCheckpoint(ctx);

		await write.customFormat.updateConditions(ctx, 1, [
			resolutionCondition(CONDITION_NAME, '1080p')
		]);

		seedUpstream(ctx, upstreamAddResolution(FORMAT_NAME, 'Upstream 720p', '720p'));
		await compilePcd(ctx);

		const op = firstOpForCondition(opsSince(ctx, checkpoint), CONDITION_NAME);
		assertEquals(op.state, 'published');
		assertLatestHistory(ctx, op, 'applied');
		assertNoPendingConflicts(ctx);

		assertConditionResolution(ctx, FORMAT_NAME, CONDITION_NAME, '1080p');
		assertConditionResolution(ctx, FORMAT_NAME, 'Upstream 720p', '720p');
	}
});

/**
 * Context
 *   Base layer seeded with one custom format resolution condition:
 *     format='x265', condition='Not 2160p', resolution='2160p'
 *
 * User
 *   POST conditions update changes:
 *     condition 'Not 2160p' resolution = '1080p'
 *
 * Upstream
 *   Published base delete removes:
 *     condition='Not 2160p'
 *
 * Expect
 *   - condition op conflicts by strategy
 *   - override recreates the condition with the user value
 *   - ask/align leave the condition deleted
 */
test('local condition update conflicts when upstream deletes condition', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'condition-upstream-deleted');
		const checkpoint = opCheckpoint(ctx);

		await write.customFormat.updateConditions(ctx, 1, [
			resolutionCondition(CONDITION_NAME, '1080p')
		]);

		seedUpstream(ctx, upstreamDeleteCondition(FORMAT_NAME, CONDITION_NAME));
		await compilePcd(ctx);

		const op = firstOpForCondition(opsSince(ctx, checkpoint), CONDITION_NAME);
		assertStrategyOutcome(ctx, op, strategy, 'missing_target');

		if (strategy === 'override') {
			assertConditionResolution(ctx, FORMAT_NAME, CONDITION_NAME, '1080p');
		} else {
			assertNoCondition(ctx, FORMAT_NAME, CONDITION_NAME);
		}
	}
});

async function newScenario(strategy: ConflictStrategy, name: string): Promise<PcdTestContext> {
	counter++;
	return setupPcd({
		port: PORT,
		name: `pcd-conflict-custom-format-conditions-${counter}-${strategy}-${name}`,
		conflictStrategy: strategy
	});
}

async function seededScenario(
	strategy: ConflictStrategy,
	name: string,
	operations?: Array<string | SeedOperation>
): Promise<PcdTestContext> {
	const ctx = await newScenario(strategy, name);
	seedBase(
		ctx,
		operations ?? [
			base.customFormatResolutionCondition({
				formatName: FORMAT_NAME,
				conditionName: CONDITION_NAME,
				resolution: ORIGINAL_RESOLUTION,
				negate: true
			})
		]
	);
	await compilePcd(ctx);
	return ctx;
}

function seedUpstream(ctx: PcdTestContext, operation: SeedOperation): number {
	return insertOp(ctx, {
		...operation,
		origin: 'base',
		state: 'published',
		source: 'repo'
	});
}

function resolutionCondition(
	name: string,
	resolution: string,
	options: {
		arrType?: 'all' | 'radarr' | 'sonarr';
		negate?: boolean;
		required?: boolean;
	} = {}
): ConditionData {
	return {
		name,
		type: 'resolution',
		arrType: options.arrType ?? 'all',
		negate: options.negate ?? true,
		required: options.required ?? false,
		resolutions: [resolution]
	};
}

function sourceCondition(name: string, source: string, negate = false): ConditionData {
	return {
		name,
		type: 'source',
		arrType: 'all',
		negate,
		required: false,
		sources: [source]
	};
}

function patternCondition(
	name: string,
	regexName: string,
	pattern: string,
	options: { required?: boolean } = {}
): ConditionData {
	return {
		name,
		type: 'release_title',
		arrType: 'all',
		negate: false,
		required: options.required ?? false,
		patterns: [{ name: regexName, pattern }]
	};
}

function languageCondition(name: string, language: string): ConditionData {
	return {
		name,
		type: 'language',
		arrType: 'all',
		negate: false,
		required: false,
		languages: [{ name: language, except: false }]
	};
}

function sizeCondition(name: string, minBytes: number): ConditionData {
	return {
		name,
		type: 'size',
		arrType: 'all',
		negate: false,
		required: false,
		size: { minBytes, maxBytes: null }
	};
}

function yearCondition(name: string, minYear: number): ConditionData {
	return {
		name,
		type: 'year',
		arrType: 'all',
		negate: false,
		required: false,
		years: { minYear, maxYear: null }
	};
}

function opsSince(ctx: PcdTestContext, checkpoint: number): OpRow[] {
	return queryOpsSince(ctx, checkpoint, { origin: 'user' });
}

function firstOpForCondition(ops: OpRow[], conditionName: string): OpRow {
	const op = ops.find((candidate) =>
		changedFields(candidate).includes(`condition:${conditionName}`)
	);
	assertExists(op, `Expected a user op for condition ${conditionName}`);
	return op;
}

function changedFields(op: OpRow): string[] {
	const fields = parseMetadata(op).changed_fields;
	if (!Array.isArray(fields)) return [];
	return fields.filter((field): field is string => typeof field === 'string');
}

function assertStrategyOutcome(
	ctx: PcdTestContext,
	op: OpRow,
	strategy: ConflictStrategy,
	reason: string
): void {
	if (strategy === 'ask') {
		assertEquals(op.state, 'published');
		assertLatestHistory(ctx, op, 'conflicted_pending', reason);
		return;
	}

	if (strategy === 'align') {
		assertEquals(op.state, 'dropped');
		assertLatestHistory(ctx, op, 'dropped', 'aligned');
		return;
	}

	assertEquals(op.state, 'superseded');
	assertExists(op.superseded_by_op_id, 'Expected override to link a replacement op');
	assertLatestHistory(ctx, op, 'superseded');
}

function assertLatestHistory(
	ctx: PcdTestContext,
	op: OpRow,
	status: string,
	reason?: string
): void {
	const history = latestHistory(ctx, op.id);
	assertEquals(history.status, status);
	if (reason !== undefined) {
		assertEquals(history.conflict_reason, reason);
	}
}

function latestHistory(ctx: PcdTestContext, opId: number): LatestHistory {
	const db = openDb(ctx.dbPath);
	try {
		const row = db
			.prepare(
				`SELECT status, conflict_reason
				 FROM pcd_op_history
				 WHERE database_id = ?
				   AND op_id = ?
				 ORDER BY applied_at DESC, id DESC
				 LIMIT 1`
			)
			.get(ctx.dbId, opId) as LatestHistory | undefined;
		assertExists(row, `Expected latest history for op ${opId}`);
		return row;
	} finally {
		db.close();
	}
}

function assertNoPendingConflicts(ctx: PcdTestContext): void {
	const db = openDb(ctx.dbPath);
	try {
		const row = db
			.prepare(
				`SELECT COUNT(*) AS count
				 FROM pcd_op_history h
				 INNER JOIN (
				     SELECT op_id, MAX(id) AS max_id
				     FROM pcd_op_history
				     WHERE database_id = ?
				     GROUP BY op_id
				 ) latest ON h.id = latest.max_id
				 WHERE h.status IN ('conflicted', 'conflicted_pending')`
			)
			.get(ctx.dbId) as { count: number };
		assertEquals(row.count, 0);
	} finally {
		db.close();
	}
}

function assertConditionResolution(
	ctx: PcdTestContext,
	formatName: string,
	conditionName: string,
	resolution: string
): void {
	assertCondition(ctx, formatName, conditionName);
	const row = compiledConditionState(ctx).resolutions.find(
		(candidate) =>
			candidate.custom_format_name === formatName && candidate.condition_name === conditionName
	);
	assertExists(row, `Expected resolution for ${conditionName}`);
	assertEquals(row.resolution, resolution);
}

function assertConditionSource(
	ctx: PcdTestContext,
	formatName: string,
	conditionName: string,
	source: string
): void {
	const condition = assertCondition(ctx, formatName, conditionName);
	assertEquals(condition.type, 'source');
	const row = compiledConditionState(ctx).sources.find(
		(candidate) =>
			candidate.custom_format_name === formatName && candidate.condition_name === conditionName
	);
	assertExists(row, `Expected source for ${conditionName}`);
	assertEquals(row.source, source);
}

function assertConditionPattern(
	ctx: PcdTestContext,
	formatName: string,
	conditionName: string,
	regexName: string
): void {
	const condition = assertCondition(ctx, formatName, conditionName);
	assertEquals(condition.type, 'release_title');
	const row = compiledConditionState(ctx).patterns.find(
		(candidate) =>
			candidate.custom_format_name === formatName && candidate.condition_name === conditionName
	);
	assertExists(row, `Expected pattern for ${conditionName}`);
	assertEquals(row.regular_expression_name, regexName);
}

function assertRegexPattern(ctx: PcdTestContext, regexName: string, pattern: string): void {
	const row = compiledConditionState(ctx).regexes.find((candidate) => candidate.name === regexName);
	assertExists(row, `Expected regex ${regexName}`);
	assertEquals(row.pattern, pattern);
}

function assertConditionLanguage(
	ctx: PcdTestContext,
	formatName: string,
	conditionName: string,
	language: string
): void {
	const condition = assertCondition(ctx, formatName, conditionName);
	assertEquals(condition.type, 'language');
	const row = compiledConditionState(ctx).languages.find(
		(candidate) =>
			candidate.custom_format_name === formatName && candidate.condition_name === conditionName
	);
	assertExists(row, `Expected language for ${conditionName}`);
	assertEquals(row.language_name, language);
	assertEquals(row.except_language, 0);
}

function assertConditionSize(
	ctx: PcdTestContext,
	formatName: string,
	conditionName: string,
	minBytes: number
): void {
	const condition = assertCondition(ctx, formatName, conditionName);
	assertEquals(condition.type, 'size');
	const row = compiledConditionState(ctx).sizes.find(
		(candidate) =>
			candidate.custom_format_name === formatName && candidate.condition_name === conditionName
	);
	assertExists(row, `Expected size for ${conditionName}`);
	assertEquals(row.min_bytes, minBytes);
	assertEquals(row.max_bytes, null);
}

function assertConditionYear(
	ctx: PcdTestContext,
	formatName: string,
	conditionName: string,
	minYear: number
): void {
	const condition = assertCondition(ctx, formatName, conditionName);
	assertEquals(condition.type, 'year');
	const row = compiledConditionState(ctx).years.find(
		(candidate) =>
			candidate.custom_format_name === formatName && candidate.condition_name === conditionName
	);
	assertExists(row, `Expected year for ${conditionName}`);
	assertEquals(row.min_year, minYear);
	assertEquals(row.max_year, null);
}

function assertConditionBase(
	ctx: PcdTestContext,
	formatName: string,
	conditionName: string,
	expected: {
		type: string;
		arrType: string;
		negate: boolean;
		required: boolean;
	}
): void {
	const row = assertCondition(ctx, formatName, conditionName);
	assertEquals(row.type, expected.type);
	assertEquals(row.arr_type, expected.arrType);
	assertEquals(row.negate, expected.negate ? 1 : 0);
	assertEquals(row.required, expected.required ? 1 : 0);
}

function assertCondition(
	ctx: PcdTestContext,
	formatName: string,
	conditionName: string
): ConditionRow {
	const row = compiledConditionState(ctx).conditions.find(
		(candidate) => candidate.custom_format_name === formatName && candidate.name === conditionName
	);
	assertExists(row, `Expected condition ${conditionName}`);
	return row;
}

function assertNoCondition(ctx: PcdTestContext, formatName: string, conditionName: string): void {
	const row = compiledConditionState(ctx).conditions.find(
		(candidate) => candidate.custom_format_name === formatName && candidate.name === conditionName
	);
	assertEquals(row, undefined);
}

function compiledConditionState(ctx: PcdTestContext): {
	conditions: ConditionRow[];
	resolutions: ResolutionRow[];
	sources: SourceRow[];
	patterns: PatternRow[];
	languages: LanguageRow[];
	sizes: SizeRow[];
	years: YearRow[];
	regexes: RegexRow[];
} {
	const source = openDb(ctx.dbPath);
	const replay = openDb(':memory:');

	try {
		replay.exec('PRAGMA foreign_keys = ON');
		replay.exec(Deno.readTextFileSync('docs/backend/0.schema.sql'));

		const baseOps = source
			.prepare(
				`SELECT *
				 FROM pcd_ops
				 WHERE database_id = ?
				   AND origin = 'base'
				   AND state = 'published'
				 ORDER BY COALESCE(sequence, id), id`
			)
			.all(ctx.dbId) as OpRow[];

		const userOps = source
			.prepare(
				`SELECT *
				 FROM pcd_ops
				 WHERE database_id = ?
				   AND origin = 'user'
				   AND state = 'published'
				 ORDER BY COALESCE(sequence, id), id`
			)
			.all(ctx.dbId) as OpRow[];
		const histories = latestHistories(source, ctx.dbId);

		for (const op of baseOps) {
			replay.exec(op.sql);
		}
		for (const op of userOps) {
			if (histories.get(op.id)?.status !== 'applied') continue;
			replay.exec(op.sql);
		}

		const conditions = replay
			.prepare(
				`SELECT custom_format_name, name, type, arr_type, negate, required
				 FROM custom_format_conditions
				 ORDER BY custom_format_name, name`
			)
			.all() as ConditionRow[];
		const resolutions = replay
			.prepare(
				`SELECT custom_format_name, condition_name, resolution
				 FROM condition_resolutions
				 ORDER BY custom_format_name, condition_name`
			)
			.all() as ResolutionRow[];
		const sources = replay
			.prepare(
				`SELECT custom_format_name, condition_name, source
				 FROM condition_sources
				 ORDER BY custom_format_name, condition_name`
			)
			.all() as SourceRow[];
		const patterns = replay
			.prepare(
				`SELECT custom_format_name, condition_name, regular_expression_name
				 FROM condition_patterns
				 ORDER BY custom_format_name, condition_name`
			)
			.all() as PatternRow[];
		const languages = replay
			.prepare(
				`SELECT custom_format_name, condition_name, language_name, except_language
				 FROM condition_languages
				 ORDER BY custom_format_name, condition_name`
			)
			.all() as LanguageRow[];
		const sizes = replay
			.prepare(
				`SELECT custom_format_name, condition_name, min_bytes, max_bytes
				 FROM condition_sizes
				 ORDER BY custom_format_name, condition_name`
			)
			.all() as SizeRow[];
		const years = replay
			.prepare(
				`SELECT custom_format_name, condition_name, min_year, max_year
				 FROM condition_years
				 ORDER BY custom_format_name, condition_name`
			)
			.all() as YearRow[];
		const regexes = replay
			.prepare(
				`SELECT name, pattern
				 FROM regular_expressions
				 ORDER BY name`
			)
			.all() as RegexRow[];

		return { conditions, resolutions, sources, patterns, languages, sizes, years, regexes };
	} finally {
		replay.close();
		source.close();
	}
}

function latestHistories(
	db: ReturnType<typeof openDb>,
	databaseId: number
): Map<number, LatestHistory> {
	const rows = db
		.prepare(
			`SELECT op_id, status, conflict_reason
			 FROM pcd_op_history
			 WHERE database_id = ?
			 ORDER BY applied_at ASC, id ASC`
		)
		.all(databaseId) as Array<LatestHistory & { op_id: number }>;
	const latest = new Map<number, LatestHistory>();
	for (const row of rows) {
		latest.set(row.op_id, row);
	}
	return latest;
}

function upstreamUpdateResolution(
	formatName: string,
	conditionName: string,
	from: string,
	to: string
): SeedOperation {
	return {
		sql: `UPDATE condition_resolutions
		      SET resolution = ${sqlValue(to)}
		      WHERE custom_format_name = ${sqlValue(formatName)}
		        AND condition_name = ${sqlValue(conditionName)}
		        AND resolution = ${sqlValue(from)};`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'custom_format',
			name: formatName,
			stable_key: { key: 'custom_format_name', value: formatName },
			changed_fields: ['conditions', `condition:${conditionName}`]
		}),
		desiredState: JSON.stringify({
			conditions: {
				updated: [
					{
						name: conditionName,
						base: {
							from: { type: 'resolution', arrType: 'all', negate: true, required: false },
							to: { type: 'resolution', arrType: 'all', negate: true, required: false }
						},
						values: {
							from: { resolutions: [from] },
							to: { resolutions: [to] }
						}
					}
				]
			}
		})
	};
}

function upstreamUpdateRequired(
	formatName: string,
	conditionName: string,
	from: boolean,
	to: boolean
): SeedOperation {
	return upstreamUpdateConditionBase(formatName, conditionName, {
		field: 'required',
		from,
		to,
		baseFrom: { type: 'resolution', arrType: 'all', negate: true, required: from },
		baseTo: { type: 'resolution', arrType: 'all', negate: true, required: to },
		values: { resolutions: [ORIGINAL_RESOLUTION] }
	});
}

function upstreamUpdateNegate(
	formatName: string,
	conditionName: string,
	from: boolean,
	to: boolean
): SeedOperation {
	return upstreamUpdateConditionBase(formatName, conditionName, {
		field: 'negate',
		from,
		to,
		baseFrom: { type: 'resolution', arrType: 'all', negate: from, required: false },
		baseTo: { type: 'resolution', arrType: 'all', negate: to, required: false },
		values: { resolutions: [ORIGINAL_RESOLUTION] }
	});
}

function upstreamUpdateConditionBase(
	formatName: string,
	conditionName: string,
	input: {
		field: 'required' | 'negate';
		from: boolean;
		to: boolean;
		baseFrom: Record<string, unknown>;
		baseTo: Record<string, unknown>;
		values: Record<string, unknown>;
	}
): SeedOperation {
	return {
		sql: `UPDATE custom_format_conditions
		      SET ${input.field} = ${input.to ? 1 : 0}
		      WHERE custom_format_name = ${sqlValue(formatName)}
		        AND name = ${sqlValue(conditionName)}
		        AND ${input.field} = ${input.from ? 1 : 0};`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'custom_format',
			name: formatName,
			stable_key: { key: 'custom_format_name', value: formatName },
			changed_fields: ['conditions', `condition:${conditionName}`]
		}),
		desiredState: JSON.stringify({
			conditions: {
				updated: [
					{
						name: conditionName,
						base: {
							from: input.baseFrom,
							to: input.baseTo
						},
						values: {
							from: input.values,
							to: input.values
						}
					}
				]
			}
		})
	};
}

function upstreamUpdatePattern(
	formatName: string,
	conditionName: string,
	from: string,
	to: string
): SeedOperation {
	return {
		sql: `UPDATE condition_patterns
		      SET regular_expression_name = ${sqlValue(to)}
		      WHERE custom_format_name = ${sqlValue(formatName)}
		        AND condition_name = ${sqlValue(conditionName)}
		        AND regular_expression_name = ${sqlValue(from)};`,
		metadata: JSON.stringify(conditionMetadata(formatName, conditionName)),
		desiredState: JSON.stringify(
			conditionUpdateDesiredState(conditionName, {
				base: { type: 'release_title', arrType: 'all', negate: false, required: false },
				from: { patterns: [{ name: from, pattern: REGEX_A_PATTERN }] },
				to: { patterns: [{ name: to, pattern: REGEX_C_PATTERN }] }
			})
		)
	};
}

function upstreamUpdateRegexPattern(name: string, from: string, to: string): SeedOperation {
	return {
		sql: `UPDATE regular_expressions
		      SET pattern = ${sqlValue(to)}
		      WHERE name = ${sqlValue(name)}
		        AND pattern = ${sqlValue(from)};`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'regular_expression',
			name,
			stable_key: { key: 'regular_expression_name', value: name },
			changed_fields: ['pattern']
		}),
		desiredState: JSON.stringify({
			pattern: { from, to }
		})
	};
}

function upstreamUpdateLanguage(
	formatName: string,
	conditionName: string,
	from: string,
	to: string
): SeedOperation {
	return {
		sql: `UPDATE condition_languages
		      SET language_name = ${sqlValue(to)}
		      WHERE custom_format_name = ${sqlValue(formatName)}
		        AND condition_name = ${sqlValue(conditionName)}
		        AND language_name = ${sqlValue(from)}
		        AND except_language = 0;`,
		metadata: JSON.stringify(conditionMetadata(formatName, conditionName)),
		desiredState: JSON.stringify(
			conditionUpdateDesiredState(conditionName, {
				base: { type: 'language', arrType: 'all', negate: false, required: false },
				from: { languages: [{ name: from, except: false }] },
				to: { languages: [{ name: to, except: false }] }
			})
		)
	};
}

function upstreamUpdateSize(
	formatName: string,
	conditionName: string,
	from: number,
	to: number
): SeedOperation {
	return {
		sql: `UPDATE condition_sizes
		      SET min_bytes = ${to}
		      WHERE custom_format_name = ${sqlValue(formatName)}
		        AND condition_name = ${sqlValue(conditionName)}
		        AND min_bytes = ${from}
		        AND max_bytes IS NULL;`,
		metadata: JSON.stringify(conditionMetadata(formatName, conditionName)),
		desiredState: JSON.stringify(
			conditionUpdateDesiredState(conditionName, {
				base: { type: 'size', arrType: 'all', negate: false, required: false },
				from: { size: { minBytes: from, maxBytes: null } },
				to: { size: { minBytes: to, maxBytes: null } }
			})
		)
	};
}

function upstreamUpdateYear(
	formatName: string,
	conditionName: string,
	from: number,
	to: number
): SeedOperation {
	return {
		sql: `UPDATE condition_years
		      SET min_year = ${to}
		      WHERE custom_format_name = ${sqlValue(formatName)}
		        AND condition_name = ${sqlValue(conditionName)}
		        AND min_year = ${from}
		        AND max_year IS NULL;`,
		metadata: JSON.stringify(conditionMetadata(formatName, conditionName)),
		desiredState: JSON.stringify(
			conditionUpdateDesiredState(conditionName, {
				base: { type: 'year', arrType: 'all', negate: false, required: false },
				from: { years: { minYear: from, maxYear: null } },
				to: { years: { minYear: to, maxYear: null } }
			})
		)
	};
}

function upstreamUpdateSource(
	formatName: string,
	conditionName: string,
	from: string,
	to: string
): SeedOperation {
	return {
		sql: `UPDATE condition_sources
		      SET source = ${sqlValue(to)}
		      WHERE custom_format_name = ${sqlValue(formatName)}
		        AND condition_name = ${sqlValue(conditionName)}
		        AND source = ${sqlValue(from)};`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'custom_format',
			name: formatName,
			stable_key: { key: 'custom_format_name', value: formatName },
			changed_fields: ['conditions', `condition:${conditionName}`]
		}),
		desiredState: JSON.stringify({
			conditions: {
				updated: [
					{
						name: conditionName,
						base: {
							from: { type: 'source', arrType: 'all', negate: false, required: false },
							to: { type: 'source', arrType: 'all', negate: false, required: false }
						},
						values: {
							from: { sources: [from] },
							to: { sources: [to] }
						}
					}
				]
			}
		})
	};
}

function upstreamChangeResolutionToSource(
	formatName: string,
	conditionName: string,
	fromResolution: string,
	toSource: string
): SeedOperation {
	return {
		sql: `UPDATE custom_format_conditions
		      SET type = 'source'
		      WHERE custom_format_name = ${sqlValue(formatName)}
		        AND name = ${sqlValue(conditionName)}
		        AND type = 'resolution'
		        AND arr_type = 'all'
		        AND negate = 1
		        AND required = 0;

		      DELETE FROM condition_resolutions
		      WHERE custom_format_name = ${sqlValue(formatName)}
		        AND condition_name = ${sqlValue(conditionName)}
		        AND resolution = ${sqlValue(fromResolution)};

		      INSERT INTO condition_sources
		        (custom_format_name, condition_name, source)
		      VALUES (${sqlValue(formatName)}, ${sqlValue(conditionName)}, ${sqlValue(toSource)});`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'custom_format',
			name: formatName,
			stable_key: { key: 'custom_format_name', value: formatName },
			changed_fields: ['conditions', `condition:${conditionName}`]
		}),
		desiredState: JSON.stringify({
			conditions: {
				updated: [
					{
						name: conditionName,
						base: {
							from: { type: 'resolution', arrType: 'all', negate: true, required: false },
							to: { type: 'source', arrType: 'all', negate: true, required: false }
						},
						values: {
							from: { resolutions: [fromResolution] },
							to: { sources: [toSource] }
						}
					}
				]
			}
		})
	};
}

function upstreamAddResolution(
	formatName: string,
	conditionName: string,
	resolution: string
): SeedOperation {
	return {
		sql: `INSERT INTO custom_format_conditions
		        (custom_format_name, name, type, arr_type, negate, required)
		      VALUES (
		        ${sqlValue(formatName)},
		        ${sqlValue(conditionName)},
		        'resolution',
		        'all',
		        0,
		        0
		      );

		      INSERT INTO condition_resolutions
		        (custom_format_name, condition_name, resolution)
		      VALUES (${sqlValue(formatName)}, ${sqlValue(conditionName)}, ${sqlValue(resolution)});`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'custom_format',
			name: formatName,
			stable_key: { key: 'custom_format_name', value: formatName },
			changed_fields: ['conditions', `condition:${conditionName}`]
		}),
		desiredState: JSON.stringify({
			conditions: {
				added: [
					{
						name: conditionName,
						base: { type: 'resolution', arrType: 'all', negate: false, required: false },
						values: { resolutions: [resolution] }
					}
				]
			}
		})
	};
}

function upstreamDeleteCondition(formatName: string, conditionName: string): SeedOperation {
	return {
		sql: `DELETE FROM custom_format_conditions
		      WHERE custom_format_name = ${sqlValue(formatName)}
		        AND name = ${sqlValue(conditionName)}
		        AND type = 'resolution'
		        AND arr_type = 'all'
		        AND negate = 1
		        AND required = 0;`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'custom_format',
			name: formatName,
			stable_key: { key: 'custom_format_name', value: formatName },
			changed_fields: ['conditions', `condition:${conditionName}`]
		}),
		desiredState: JSON.stringify({
			conditions: {
				removed: [
					{
						name: conditionName,
						base: { type: 'resolution', arrType: 'all', negate: true, required: false },
						values: { resolutions: [ORIGINAL_RESOLUTION] }
					}
				]
			}
		})
	};
}

function multiConditionSeed(): SeedOperation {
	return {
		sql: [
			`INSERT INTO custom_formats (name, description, include_in_rename)
			 VALUES (${sqlValue(FORMAT_NAME)}, '', 0);`,
			sourceConditionSql(FORMAT_NAME, CONDITION_A, CONDITION_A_INITIAL_SOURCE),
			sourceConditionSql(FORMAT_NAME, CONDITION_B, CONDITION_B_INITIAL_SOURCE),
			resolutionConditionSql(FORMAT_NAME, CONDITION_NAME, ORIGINAL_RESOLUTION, true)
		].join('\n')
	};
}

function sourceConditionSql(
	formatName: string,
	conditionName: string,
	source: string,
	negate = false
): string {
	return `INSERT INTO custom_format_conditions
	          (custom_format_name, name, type, arr_type, negate, required)
	        VALUES (
	          ${sqlValue(formatName)},
	          ${sqlValue(conditionName)},
	          'source',
	          'all',
	          ${negate ? 1 : 0},
	          0
	        );

	        INSERT INTO condition_sources
	          (custom_format_name, condition_name, source)
	        VALUES (${sqlValue(formatName)}, ${sqlValue(conditionName)}, ${sqlValue(source)});`;
}

function resolutionConditionSql(
	formatName: string,
	conditionName: string,
	resolution: string,
	negate = false
): string {
	return `INSERT INTO custom_format_conditions
	          (custom_format_name, name, type, arr_type, negate, required)
	        VALUES (
	          ${sqlValue(formatName)},
	          ${sqlValue(conditionName)},
	          'resolution',
	          'all',
	          ${negate ? 1 : 0},
	          0
	        );

	        INSERT INTO condition_resolutions
	          (custom_format_name, condition_name, resolution)
	        VALUES (${sqlValue(formatName)}, ${sqlValue(conditionName)}, ${sqlValue(resolution)});`;
}

function patternSeed(): Array<SeedOperation> {
	return [
		base.regex({ name: REGEX_A, pattern: REGEX_A_PATTERN }),
		base.regex({ name: REGEX_B, pattern: REGEX_B_PATTERN }),
		base.regex({ name: REGEX_C, pattern: REGEX_C_PATTERN }),
		base.customFormatRegexCondition({
			formatName: FORMAT_NAME,
			conditionName: PATTERN_CONDITION,
			regexName: REGEX_A
		})
	];
}

function regexDependencySeed(): Array<SeedOperation> {
	return [
		base.regex({ name: REGEX_DEP, pattern: REGEX_DEP_PATTERN_V1 }),
		base.customFormatRegexCondition({
			formatName: FORMAT_NAME,
			conditionName: REGEX_DEP_CONDITION,
			regexName: REGEX_DEP
		})
	];
}

function languageConditionSeed(conditionName: string, language: string): SeedOperation {
	return {
		sql: [
			`INSERT INTO custom_formats (name, description, include_in_rename)
			 VALUES (${sqlValue(FORMAT_NAME)}, '', 0);`,
			languageSql(BASE_LANGUAGE),
			languageSql(LOCAL_LANGUAGE),
			languageSql(UPSTREAM_LANGUAGE),
			languageConditionSql(FORMAT_NAME, conditionName, language)
		].join('\n')
	};
}

function sizeConditionSeed(conditionName: string, minBytes: number): SeedOperation {
	return {
		sql: [
			`INSERT INTO custom_formats (name, description, include_in_rename)
			 VALUES (${sqlValue(FORMAT_NAME)}, '', 0);`,
			sizeConditionSql(FORMAT_NAME, conditionName, minBytes)
		].join('\n')
	};
}

function yearConditionSeed(conditionName: string, minYear: number): SeedOperation {
	return {
		sql: [
			`INSERT INTO custom_formats (name, description, include_in_rename)
			 VALUES (${sqlValue(FORMAT_NAME)}, '', 0);`,
			yearConditionSql(FORMAT_NAME, conditionName, minYear)
		].join('\n')
	};
}

function languageSql(name: string): string {
	return `INSERT INTO languages (name) VALUES (${sqlValue(name)});`;
}

function languageConditionSql(formatName: string, conditionName: string, language: string): string {
	return `INSERT INTO custom_format_conditions
	          (custom_format_name, name, type, arr_type, negate, required)
	        VALUES (
	          ${sqlValue(formatName)},
	          ${sqlValue(conditionName)},
	          'language',
	          'all',
	          0,
	          0
	        );

	        INSERT INTO condition_languages
	          (custom_format_name, condition_name, language_name, except_language)
	        VALUES (${sqlValue(formatName)}, ${sqlValue(conditionName)}, ${sqlValue(language)}, 0);`;
}

function sizeConditionSql(formatName: string, conditionName: string, minBytes: number): string {
	return `INSERT INTO custom_format_conditions
	          (custom_format_name, name, type, arr_type, negate, required)
	        VALUES (
	          ${sqlValue(formatName)},
	          ${sqlValue(conditionName)},
	          'size',
	          'all',
	          0,
	          0
	        );

	        INSERT INTO condition_sizes
	          (custom_format_name, condition_name, min_bytes, max_bytes)
	        VALUES (${sqlValue(formatName)}, ${sqlValue(conditionName)}, ${minBytes}, NULL);`;
}

function yearConditionSql(formatName: string, conditionName: string, minYear: number): string {
	return `INSERT INTO custom_format_conditions
	          (custom_format_name, name, type, arr_type, negate, required)
	        VALUES (
	          ${sqlValue(formatName)},
	          ${sqlValue(conditionName)},
	          'year',
	          'all',
	          0,
	          0
	        );

	        INSERT INTO condition_years
	          (custom_format_name, condition_name, min_year, max_year)
	        VALUES (${sqlValue(formatName)}, ${sqlValue(conditionName)}, ${minYear}, NULL);`;
}

function conditionMetadata(formatName: string, conditionName: string): Record<string, unknown> {
	return {
		operation: 'update',
		entity: 'custom_format',
		name: formatName,
		stable_key: { key: 'custom_format_name', value: formatName },
		changed_fields: ['conditions', `condition:${conditionName}`]
	};
}

function conditionUpdateDesiredState(
	conditionName: string,
	input: {
		base: Record<string, unknown>;
		from: Record<string, unknown>;
		to: Record<string, unknown>;
	}
): Record<string, unknown> {
	return {
		conditions: {
			updated: [
				{
					name: conditionName,
					base: {
						from: input.base,
						to: input.base
					},
					values: {
						from: input.from,
						to: input.to
					}
				}
			]
		}
	};
}

function sqlValue(value: string | null): string {
	if (value === null) return 'NULL';
	return `'${value.replace(/'/g, "''")}'`;
}

await run();
