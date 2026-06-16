/**
 * Integration tests: cross-database entity clone.
 *
 * One server, multiple PCD database contexts created via setupPcd.
 * The clone endpoint resolves source and target from pcdManager within a
 * single running instance, so both databases live in the same profilarr.db.
 */

import { assert, assertEquals } from '@std/assert';
import { startServer, stopServer } from '$test-harness/server.ts';
import { run, setup, teardown, test } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';
import { base } from './harness/fixtures.ts';
import {
	compilePcd,
	opCheckpoint,
	parseMetadata,
	queryOpsSince,
	seedBase,
	setupPcd,
	type OpRow,
	type PcdTestContext
} from './harness/pcd.ts';

const PORT = PORTS.pcd.cloneAcross;
const ORIGIN = `http://localhost:${PORT}`;

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN });
});

teardown(async () => {
	await stopServer(PORT);
});

function userOpsSince(ctx: PcdTestContext, checkpoint: number): OpRow[] {
	return queryOpsSince(ctx, checkpoint, { origin: 'user', state: 'published' });
}

function entityNamesOf(ops: OpRow[]): Record<string, string> {
	const result: Record<string, string> = {};
	for (const op of ops) {
		const meta = parseMetadata(op);
		result[meta.entity as string] = meta.name as string;
	}
	return result;
}

let counter = 0;
function names(label: string) {
	counter++;
	return {
		source: `clone-src-${counter}-${label}`,
		target: `clone-tgt-${counter}-${label}`
	};
}

/**
 * Context
 *   Source: one delay profile "Foo", compiled.
 *   Target: empty, compiled.
 *
 * Submit
 *   POST /databases/{sourceId}/clone-to/{targetId}
 *     entityType = 'delay_profile'
 *     name       = 'Foo'
 *
 * Expect
 *   - response.status === 200
 *   - target has 1 new user op
 *   - op.metadata.entity === 'delay_profile'
 *   - op.metadata.name   === 'Foo'
 */
test('delay_profile is cloned to target database', async () => {
	const { source, target } = names('dp-basic');
	const srcCtx = await setupPcd({ port: PORT, name: source });
	const tgtCtx = await setupPcd({ port: PORT, name: target });

	seedBase(srcCtx, [base.delayProfile({ name: 'Foo' })]);
	await compilePcd(srcCtx);
	await compilePcd(tgtCtx);

	const checkpoint = opCheckpoint(tgtCtx);
	const res = await srcCtx.client.post(`/databases/${srcCtx.dbId}/clone-to/${tgtCtx.dbId}`, {
		entityType: 'delay_profile',
		name: 'Foo'
	});
	assertEquals(res.status, 200);

	const ops = userOpsSince(tgtCtx, checkpoint);
	assertEquals(ops.length, 1);
	const meta = parseMetadata(ops[0]);
	assertEquals(meta.entity, 'delay_profile');
	assertEquals(meta.name, 'Foo');
});

/**
 * Context
 *   Source: one delay profile "Foo", compiled.
 *   Target: empty, compiled.
 *
 * Submit
 *   POST /databases/{sourceId}/clone-to/{targetId}
 *     entityType = 'delay_profile'
 *     name       = 'Foo'
 *     newName    = 'Foo Clone'
 *
 * Expect
 *   - target op has metadata.name === 'Foo Clone'
 */
test('delay_profile is stored under newName in target', async () => {
	const { source, target } = names('dp-rename');
	const srcCtx = await setupPcd({ port: PORT, name: source });
	const tgtCtx = await setupPcd({ port: PORT, name: target });

	seedBase(srcCtx, [base.delayProfile({ name: 'Foo' })]);
	await compilePcd(srcCtx);
	await compilePcd(tgtCtx);

	const checkpoint = opCheckpoint(tgtCtx);
	const res = await srcCtx.client.post(`/databases/${srcCtx.dbId}/clone-to/${tgtCtx.dbId}`, {
		entityType: 'delay_profile',
		name: 'Foo',
		newName: 'Foo Clone'
	});
	assertEquals(res.status, 200);

	const ops = userOpsSince(tgtCtx, checkpoint);
	assertEquals(ops.length, 1);
	assertEquals(parseMetadata(ops[0]).name, 'Foo Clone');
});

/**
 * Context
 *   Source: regex "r1", custom format "cf1" with release_title condition → "r1".
 *   Target: empty, compiled.
 *
 * Submit
 *   POST /databases/{sourceId}/clone-to/{targetId}
 *     entityType = 'custom_format'
 *     name       = 'cf1'
 *
 * Expect
 *   - target has 2 new user ops: one regex + one custom_format
 *   - regex op has name 'r1'
 *   - custom_format op has name 'cf1'
 */
test('custom_format regex dependencies are cloned to target', async () => {
	const { source, target } = names('cf-deps');
	const srcCtx = await setupPcd({ port: PORT, name: source });
	const tgtCtx = await setupPcd({ port: PORT, name: target });

	seedBase(srcCtx, [
		base.regex({ name: 'r1', pattern: 'foo' }),
		base.customFormatRegexCondition({ formatName: 'cf1', conditionName: 'c1', regexName: 'r1' })
	]);
	await compilePcd(srcCtx);
	await compilePcd(tgtCtx);

	const checkpoint = opCheckpoint(tgtCtx);
	const res = await srcCtx.client.post(`/databases/${srcCtx.dbId}/clone-to/${tgtCtx.dbId}`, {
		entityType: 'custom_format',
		name: 'cf1'
	});
	assertEquals(res.status, 200);

	const ops = userOpsSince(tgtCtx, checkpoint);
	assertEquals(ops.length, 2);
	const byEntity = entityNamesOf(ops);
	assertEquals(byEntity['regular_expression'], 'r1');
	assertEquals(byEntity['custom_format'], 'cf1');
});

/**
 * Context
 *   Source: regex "r1", custom format "cf1" with release_title condition → "r1".
 *   Target: already has regex "r1" with different content (seeded + compiled).
 *
 * Submit
 *   POST /databases/{sourceId}/clone-to/{targetId}
 *     entityType = 'custom_format'
 *     name       = 'cf1'
 *
 * Expect
 *   - target has 2 new user ops
 *   - regex op has name 'r1 (2)' (numeric suffix, different content)
 *   - custom_format op has name 'cf1'
 */
test('conflicting regex dependency is renamed with numeric suffix', async () => {
	const { source, target } = names('cf-regex-conflict');
	const srcCtx = await setupPcd({ port: PORT, name: source });
	const tgtCtx = await setupPcd({ port: PORT, name: target });

	seedBase(srcCtx, [
		base.regex({ name: 'r1', pattern: 'foo' }),
		base.customFormatRegexCondition({ formatName: 'cf1', conditionName: 'c1', regexName: 'r1' })
	]);
	seedBase(tgtCtx, [base.regex({ name: 'r1', pattern: 'bar' })]);
	await compilePcd(srcCtx);
	await compilePcd(tgtCtx);

	const checkpoint = opCheckpoint(tgtCtx);
	const res = await srcCtx.client.post(`/databases/${srcCtx.dbId}/clone-to/${tgtCtx.dbId}`, {
		entityType: 'custom_format',
		name: 'cf1'
	});
	assertEquals(res.status, 200);

	const ops = userOpsSince(tgtCtx, checkpoint);
	assertEquals(ops.length, 2);
	const byEntity = entityNamesOf(ops);
	assertEquals(byEntity['regular_expression'], 'r1 (2)');
	assertEquals(byEntity['custom_format'], 'cf1');
});

/**
 * Context
 *   Source: regex "r1", CF "cf1" (release_title condition → r1), QP "qp1" and "qp2" both scoring "cf1".
 *   Target: empty.
 *
 * Submit
 *   POST clone qp1 → target
 *   POST clone qp2 → target
 *
 * Expect
 *   - First clone: 5 ops (r1, cf1-create, cf1-conditions, qp1-create, qp1-scoring)
 *   - Second clone: 2 ops (qp2-create, qp2-scoring — r1 and cf1 reused, no new writes)
 *   - No 'cf1 (2)' or 'r1 (2)' ever created
 */
test('shared CF with regex condition is reused when cloning a second quality profile', async () => {
	const { source, target } = names('qp-shared-cf');
	const srcCtx = await setupPcd({ port: PORT, name: source });
	const tgtCtx = await setupPcd({ port: PORT, name: target });

	seedBase(srcCtx, [
		base.regex({ name: 'r1', pattern: 'foo' }),
		base.customFormatRegexCondition({ formatName: 'cf1', conditionName: 'c1', regexName: 'r1' }),
		base.qualityProfile({
			name: 'qp1',
			customFormatScores: [{ customFormatName: 'cf1', score: 100 }]
		}),
		base.qualityProfile({
			name: 'qp2',
			customFormatScores: [{ customFormatName: 'cf1', score: 200 }]
		})
	]);
	await compilePcd(srcCtx);
	await compilePcd(tgtCtx);

	// Clone first profile — expect r1 + cf1-create + cf1-conditions + qp1-create + qp1-scoring
	const checkpoint1 = opCheckpoint(tgtCtx);
	const res1 = await srcCtx.client.post(`/databases/${srcCtx.dbId}/clone-to/${tgtCtx.dbId}`, {
		entityType: 'quality_profile',
		name: 'qp1'
	});
	assertEquals(res1.status, 200);
	const ops1 = userOpsSince(tgtCtx, checkpoint1);
	assertEquals(
		ops1.length,
		5,
		`Expected 5 ops (r1, cf1-create, cf1-conditions, qp1-create, qp1-scoring), got ${ops1.length}: ${ops1.map((o) => o.metadata).join(', ')}`
	);

	// Clone second profile — r1 and cf1 reused (same content); only qp2-create + qp2-scoring written
	const checkpoint2 = opCheckpoint(tgtCtx);
	const res2 = await srcCtx.client.post(`/databases/${srcCtx.dbId}/clone-to/${tgtCtx.dbId}`, {
		entityType: 'quality_profile',
		name: 'qp2'
	});
	assertEquals(res2.status, 200);
	const ops2 = userOpsSince(tgtCtx, checkpoint2);
	assertEquals(
		ops2.length,
		2,
		`Expected 2 ops (qp2-create, qp2-scoring), got ${ops2.length}: ${ops2.map((o) => o.metadata).join(', ')}`
	);
	assertEquals(parseMetadata(ops2[0]).entity, 'quality_profile');
	assertEquals(parseMetadata(ops2[0]).name, 'qp2');
});

/**
 * Context
 *   Source: regex "r1", CF "cf1" (condition → r1), QP "qp1" (score → cf1).
 *   Target: empty, compiled.
 *
 * Submit
 *   POST /databases/{sourceId}/clone-to/{targetId}
 *     entityType = 'quality_profile'
 *     name       = 'qp1'
 *
 * Expect
 *   - target has 5 new user ops: r1, cf1-create, cf1-conditions, qp1-create, qp1-scoring
 */
test('quality_profile full dependency waterfall is cloned to target', async () => {
	const { source, target } = names('qp-waterfall');
	const srcCtx = await setupPcd({ port: PORT, name: source });
	const tgtCtx = await setupPcd({ port: PORT, name: target });

	seedBase(srcCtx, [
		base.regex({ name: 'r1', pattern: 'foo' }),
		base.customFormatRegexCondition({ formatName: 'cf1', conditionName: 'c1', regexName: 'r1' }),
		base.qualityProfile({
			name: 'qp1',
			customFormatScores: [{ customFormatName: 'cf1', score: 100 }]
		})
	]);
	await compilePcd(srcCtx);
	await compilePcd(tgtCtx);

	const checkpoint = opCheckpoint(tgtCtx);
	const res = await srcCtx.client.post(`/databases/${srcCtx.dbId}/clone-to/${tgtCtx.dbId}`, {
		entityType: 'quality_profile',
		name: 'qp1'
	});
	assertEquals(res.status, 200);

	const ops = userOpsSince(tgtCtx, checkpoint);
	assertEquals(
		ops.length,
		5,
		`Expected 5 ops, got ${ops.length}: ${ops.map((o) => o.metadata).join(', ')}`
	);
	const byEntity = entityNamesOf(ops);
	assertEquals(byEntity['regular_expression'], 'r1');
	assertEquals(byEntity['custom_format'], 'cf1');
	assertEquals(byEntity['quality_profile'], 'qp1');
});

/**
 * Context
 *   Source: regex "r1", CF "cf1" (release_title condition → r1) with a test whose description
 *           is an empty string. When cloning, createTest uses a truthy check so '' → NULL in the
 *           target DB. On the second clone, cfContentMatches compared source description: '' vs
 *           target description: null → JSON mismatch → "cf1 (2)" was created.
 *   Target: empty.
 *
 * Expect
 *   - First clone: 6 ops (r1, cf1-create, cf1-conditions, cf1-test, qp1-create, qp1-scoring)
 *   - Second clone: 2 ops (qp2-create, qp2-scoring — CF reused despite '' vs null description)
 */
test('shared CF with empty-string test description is reused on second clone', async () => {
	const { source, target } = names('qp-test-desc');
	const srcCtx = await setupPcd({ port: PORT, name: source });
	const tgtCtx = await setupPcd({ port: PORT, name: target });

	seedBase(srcCtx, [
		base.regex({ name: 'r1', pattern: 'foo' }),
		base.customFormatRegexCondition({ formatName: 'cf1', conditionName: 'c1', regexName: 'r1' }),
		base.customFormatTest({ formatName: 'cf1', title: 'match-test', description: '' }),
		base.qualityProfile({
			name: 'qp1',
			customFormatScores: [{ customFormatName: 'cf1', score: 100 }]
		}),
		base.qualityProfile({
			name: 'qp2',
			customFormatScores: [{ customFormatName: 'cf1', score: 200 }]
		})
	]);
	await compilePcd(srcCtx);
	await compilePcd(tgtCtx);

	const checkpoint1 = opCheckpoint(tgtCtx);
	const res1 = await srcCtx.client.post(`/databases/${srcCtx.dbId}/clone-to/${tgtCtx.dbId}`, {
		entityType: 'quality_profile',
		name: 'qp1'
	});
	assertEquals(res1.status, 200);
	const ops1 = userOpsSince(tgtCtx, checkpoint1);
	assertEquals(
		ops1.length,
		6,
		`Expected 6 ops (r1, cf1-create, cf1-conditions, cf1-test, qp1-create, qp1-scoring), got ${ops1.length}: ${ops1.map((o) => o.metadata).join(', ')}`
	);

	const checkpoint2 = opCheckpoint(tgtCtx);
	const res2 = await srcCtx.client.post(`/databases/${srcCtx.dbId}/clone-to/${tgtCtx.dbId}`, {
		entityType: 'quality_profile',
		name: 'qp2'
	});
	assertEquals(res2.status, 200);
	const ops2 = userOpsSince(tgtCtx, checkpoint2);
	assertEquals(
		ops2.length,
		2,
		`Expected 2 ops (qp2-create, qp2-scoring; CF reused), got ${ops2.length}: ${ops2.map((o) => o.metadata).join(', ')}`
	);
});

/**
 * Context
 *   Source: regex "r1", CF "cf1" with description that has trailing whitespace ("desc  "),
 *           qp1 and qp2 both scoring "cf1".
 *   Target: empty.
 *
 * Bug being tested
 *   create.ts trims descriptions before writing (normalizedDescription = input.description?.trim()),
 *   so the cloned CF in the target has "desc" (no trailing space). On the second clone,
 *   cfContentMatches compared source "desc  " (untrimmed) vs target "desc" (trimmed) and returned
 *   false — creating "cf1 (2)" instead of reusing "cf1".
 *
 * Expect
 *   - First clone: 5 ops (r1, cf1-create, cf1-conditions, qp1-create, qp1-scoring)
 *   - Second clone: 2 ops (qp2-create, qp2-scoring — CF reused despite source description having trailing space)
 */
test('shared CF with trailing-space description is reused on second clone', async () => {
	const { source, target } = names('qp-trailing-desc');
	const srcCtx = await setupPcd({ port: PORT, name: source });
	const tgtCtx = await setupPcd({ port: PORT, name: target });

	seedBase(srcCtx, [
		base.regex({ name: 'r1', pattern: 'foo' }),
		{
			sql: `INSERT INTO custom_formats (name, description, include_in_rename) VALUES ('cf1', 'my description   ', 0)`
		},
		{
			sql: `INSERT INTO custom_format_conditions (custom_format_name, name, type, arr_type, negate, required) VALUES ('cf1', 'c1', 'release_title', 'all', 0, 1)`
		},
		{
			sql: `INSERT INTO condition_patterns (custom_format_name, condition_name, regular_expression_name) VALUES ('cf1', 'c1', 'r1')`
		},
		base.qualityProfile({
			name: 'qp1',
			customFormatScores: [{ customFormatName: 'cf1', score: 100 }]
		}),
		base.qualityProfile({
			name: 'qp2',
			customFormatScores: [{ customFormatName: 'cf1', score: 200 }]
		})
	]);
	await compilePcd(srcCtx);
	await compilePcd(tgtCtx);

	const checkpoint1 = opCheckpoint(tgtCtx);
	const res1 = await srcCtx.client.post(`/databases/${srcCtx.dbId}/clone-to/${tgtCtx.dbId}`, {
		entityType: 'quality_profile',
		name: 'qp1'
	});
	assertEquals(res1.status, 200);
	const ops1 = userOpsSince(tgtCtx, checkpoint1);
	assertEquals(
		ops1.length,
		5,
		`Expected 5 ops (r1, cf1-create, cf1-conditions, qp1-create, qp1-scoring), got ${ops1.length}: ${ops1.map((o) => o.metadata).join(', ')}`
	);

	const checkpoint2 = opCheckpoint(tgtCtx);
	const res2 = await srcCtx.client.post(`/databases/${srcCtx.dbId}/clone-to/${tgtCtx.dbId}`, {
		entityType: 'quality_profile',
		name: 'qp2'
	});
	assertEquals(res2.status, 200);
	const ops2 = userOpsSince(tgtCtx, checkpoint2);
	assertEquals(
		ops2.length,
		2,
		`Expected 2 ops (qp2-create, qp2-scoring; CF reused), got ${ops2.length}: ${ops2.map((o) => o.metadata).join(', ')}`
	);
});

/**
 * Context
 *   Source: QP with quality item "Bluray-2160p Remux" (Radarr-specific name).
 *   Target: only has "Bluray-2160p" in its qualities table (Sonarr-style).
 *
 * Without Fix #2, orderedItems is passed as-is to qpQueries.create, which
 * INSERTs into quality_profile_qualities.  "Bluray-2160p Remux" doesn't
 * exist in the target's qualities table → FK violation → clone fails.
 *
 * With the fix, orderedItems is filtered against the target's quality set.
 *
 * Expect
 *   - response.status === 200
 *   - the QP exists in the target (at least one quality_profile op)
 */
test('cloned quality profile filters out qualities absent from target database', async () => {
	const { source, target } = names('qp-quality-filter');
	const srcCtx = await setupPcd({ port: PORT, name: source });
	const tgtCtx = await setupPcd({ port: PORT, name: target });

	// Source has a quality name that doesn't exist in the target
	seedBase(srcCtx, [
		base.qualities({ entries: [{ name: 'Bluray-2160p Remux', arrType: 'radarr' }] }),
		base.qualityProfile({
			name: 'qp1',
			qualityItems: [
				{
					type: 'quality',
					name: 'Bluray-2160p Remux',
					position: 1,
					enabled: true,
					upgradeUntil: true
				}
			]
		})
	]);

	seedBase(tgtCtx, [base.qualities({ entries: [{ name: 'Bluray-2160p', arrType: 'sonarr' }] })]);

	await compilePcd(srcCtx);
	await compilePcd(tgtCtx);

	const checkpoint = opCheckpoint(tgtCtx);
	const res = await srcCtx.client.post(`/databases/${srcCtx.dbId}/clone-to/${tgtCtx.dbId}`, {
		entityType: 'quality_profile',
		name: 'qp1'
	});
	assertEquals(res.status, 200);

	const ops = userOpsSince(tgtCtx, checkpoint);
	const qpOps = ops.filter((o) => parseMetadata(o).entity === 'quality_profile');
	assert(qpOps.length >= 1, 'Expected at least one quality_profile op');
});

/**
 * Context
 *   Source: CF "F1" (desc a), CF "F1 (2)" (desc b), QP scoring both.
 *   Target: CF "F1" (desc c — different content, forces rename).
 *
 * Without Fix #4, resolveDep picks "F1 (2)" for the renamed "F1", then
 * the source's real "F1 (2)" checks the DB (not yet written), finds no
 * conflict, and also keeps "F1 (2)" — two entities colliding on the same
 * target name.  With the fix, "F1 (2)" is tracked as reserved so the
 * second CF gets "F1 (2) (2)".
 *
 * Expect
 *   - response.status === 200
 *   - two CF user ops with unique names: "F1 (2)" and "F1 (2) (2)"
 */
test('two CFs that would collide on a renamed target name are both uniquely renamed', async () => {
	const { source, target } = names('resolve-dep-collision');
	const srcCtx = await setupPcd({ port: PORT, name: source });
	const tgtCtx = await setupPcd({ port: PORT, name: target });

	seedBase(srcCtx, [
		base.customFormat({ name: 'F1', description: 'a' }),
		base.customFormat({ name: 'F1 (2)', description: 'b' }),
		base.qualityProfile({
			name: 'qp1',
			customFormatScores: [
				{ customFormatName: 'F1', score: 100 },
				{ customFormatName: 'F1 (2)', score: 200 }
			]
		})
	]);

	// Target has "F1" with different content → source's "F1" must rename
	seedBase(tgtCtx, [base.customFormat({ name: 'F1', description: 'c' })]);

	await compilePcd(srcCtx);
	await compilePcd(tgtCtx);

	const checkpoint = opCheckpoint(tgtCtx);
	const res = await srcCtx.client.post(`/databases/${srcCtx.dbId}/clone-to/${tgtCtx.dbId}`, {
		entityType: 'quality_profile',
		name: 'qp1'
	});
	assertEquals(res.status, 200);

	const ops = userOpsSince(tgtCtx, checkpoint);
	const cfOps = ops.filter((o) => parseMetadata(o).entity === 'custom_format');
	const cfNames = cfOps.map((o) => parseMetadata(o).name).sort();

	assertEquals(
		cfNames.length,
		2,
		`Expected 2 CFs, got ${cfNames.length}: ${JSON.stringify(cfNames)}`
	);
	assertEquals(cfNames[0], 'F1 (2)');
	assertEquals(cfNames[1], 'F1 (2) (2)');
});

/**
 * Context
 *   Source: delay_profile "Foo" (content A).
 *   Target: delay_profile "Foo" (content B, different name? no — same name, clone should error).
 *
 * Without Fix #5, the generic clone path calls deserializeFn → create(), which
 * throws a plain Error (not ConflictError), so the API returns 400.  With the
 * fix, a pre-flight ConflictError check turns it into 409.
 *
 * Expect
 *   - response.status === 409
 */
test('generic entity clone with conflicting existing name returns 409', async () => {
	const { source, target } = names('generic-409');
	const srcCtx = await setupPcd({ port: PORT, name: source });
	const tgtCtx = await setupPcd({ port: PORT, name: target });

	seedBase(srcCtx, [base.delayProfile({ name: 'Foo' })]);
	seedBase(tgtCtx, [base.delayProfile({ name: 'Foo', usenetDelay: 10 })]);

	await compilePcd(srcCtx);
	await compilePcd(tgtCtx);

	const res = await srcCtx.client.post(`/databases/${srcCtx.dbId}/clone-to/${tgtCtx.dbId}`, {
		entityType: 'delay_profile',
		name: 'Foo'
	});
	assertEquals(res.status, 409);
});

/**
 * Context
 *   Source: CF "cf1", QP "qp1" scoring cf1 at 100 points.
 *   Target: empty.
 *
 * Issue #1 in the original review: updateScoring result was silently discarded.
 * If scoring failed, clone returned the successful create result anyway.
 *
 * This test verifies that scoring data is written by checking that the target
 * has at least one update (scoring) op for the quality profile, and that the
 * score value appears in the op metadata.
 *
 * Expect
 *   - response.status === 200
 *   - at least one quality_profile update op (scoring)
 *   - op metadata contains the score value
 */
test('cloned quality profile includes scoring data in the target', async () => {
	const { source, target } = names('qp-scoring');
	const srcCtx = await setupPcd({ port: PORT, name: source });
	const tgtCtx = await setupPcd({ port: PORT, name: target });

	seedBase(srcCtx, [
		base.customFormat({ name: 'cf1', description: 'score test' }),
		base.qualityProfile({
			name: 'qp1',
			customFormatScores: [{ customFormatName: 'cf1', score: 100 }]
		})
	]);

	await compilePcd(srcCtx);
	await compilePcd(tgtCtx);

	const checkpoint = opCheckpoint(tgtCtx);
	const res = await srcCtx.client.post(`/databases/${srcCtx.dbId}/clone-to/${tgtCtx.dbId}`, {
		entityType: 'quality_profile',
		name: 'qp1'
	});
	assertEquals(res.status, 200);

	const ops = userOpsSince(tgtCtx, checkpoint);
	const scoringOps = ops.filter((o) => {
		const meta = parseMetadata(o);
		return meta.entity === 'quality_profile' && meta.operation === 'update';
	});
	assert(
		scoringOps.length >= 1,
		`Expected at least one scoring op, got ${scoringOps.length}: ${ops.map((o) => o.metadata).join(', ')}`
	);

	// At least one scoring op should reference the CF
	const hasCfScore = scoringOps.some((o) => {
		const meta = parseMetadata(o);
		return JSON.stringify(meta).includes('cf1');
	});
	assert(hasCfScore, 'Expected at least one scoring op to reference "cf1"');
});

/**
 * Context
 *   Source: CFs "A", "B", "C" (all new to target), QP scoring all three.
 *   Target: empty.
 *
 * Issue #3 in the original review: the CF creation loop could leave orphan
 * CFs if a later CF's creation failed. This test exercises the happy path
 * for multiple new CFs to verify the creation loop completes correctly.
 *
 * Expect
 *   - response.status === 200
 *   - exactly 3 custom_format user ops (one per CF)
 *   - each CF name appears in the ops
 */
test('multiple new custom formats are all created when cloning a quality profile', async () => {
	const { source, target } = names('multi-cf');
	const srcCtx = await setupPcd({ port: PORT, name: source });
	const tgtCtx = await setupPcd({ port: PORT, name: target });

	seedBase(srcCtx, [
		base.customFormat({ name: 'A', description: 'first' }),
		base.customFormat({ name: 'B', description: 'second' }),
		base.customFormat({ name: 'C', description: 'third' }),
		base.qualityProfile({
			name: 'qp1',
			customFormatScores: [
				{ customFormatName: 'A', score: 10 },
				{ customFormatName: 'B', score: 20 },
				{ customFormatName: 'C', score: 30 }
			]
		})
	]);

	await compilePcd(srcCtx);
	await compilePcd(tgtCtx);

	const checkpoint = opCheckpoint(tgtCtx);
	const res = await srcCtx.client.post(`/databases/${srcCtx.dbId}/clone-to/${tgtCtx.dbId}`, {
		entityType: 'quality_profile',
		name: 'qp1'
	});
	assertEquals(res.status, 200);

	const ops = userOpsSince(tgtCtx, checkpoint);
	const cfOps = ops.filter((o) => parseMetadata(o).entity === 'custom_format');
	const cfNames = cfOps.map((o) => parseMetadata(o).name).sort();

	assertEquals(
		cfNames.length,
		3,
		`Expected 3 CF ops, got ${cfNames.length}: ${JSON.stringify(cfNames)}`
	);
	assertEquals(cfNames[0], 'A');
	assertEquals(cfNames[1], 'B');
	assertEquals(cfNames[2], 'C');
});

/**
 * Submit
 *   POST /databases/{id}/clone-to/{id}  (source === target)
 *
 * Expect
 *   - response.status === 400
 */
test('cloning to the same database is rejected with 400', async () => {
	const { source } = names('same-db');
	const srcCtx = await setupPcd({ port: PORT, name: source });
	await compilePcd(srcCtx);

	const res = await srcCtx.client.post(`/databases/${srcCtx.dbId}/clone-to/${srcCtx.dbId}`, {
		entityType: 'delay_profile',
		name: 'Anything'
	});
	assertEquals(res.status, 400);
});

/**
 * Submit
 *   POST /databases/99999/clone-to/{targetId}  (non-existent source)
 *
 * Expect
 *   - response.status === 404
 */
test('non-existent source database is rejected with 404', async () => {
	const { target } = names('bad-src');
	const tgtCtx = await setupPcd({ port: PORT, name: target });
	await compilePcd(tgtCtx);

	const res = await tgtCtx.client.post(`/databases/99999/clone-to/${tgtCtx.dbId}`, {
		entityType: 'delay_profile',
		name: 'Anything'
	});
	assertEquals(res.status, 404);
});

await run();
