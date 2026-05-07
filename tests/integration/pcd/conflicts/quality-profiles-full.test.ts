/**
 * PCD conflict tests: quality profile full-surface specs.
 */

import { assertEquals, assertExists } from '@std/assert';
import { startServer, stopServer } from '$test-harness/server.ts';
import { openDb } from '$test-harness/db.ts';
import { run, setup, teardown, test } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';
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
import { write, type QualityProfileQualityItemInput } from '../harness/write.ts';

const PORT = PORTS.pcd.conflictsQualityProfilesFull;
const ORIGIN = `http://localhost:${PORT}`;
const STRATEGIES: ConflictStrategy[] = ['ask', 'align', 'override'];
const PROFILE_NAME = '1080p Balanced';
const QUALITY_A = 'Quality A';
const QUALITY_B = 'Quality B';
const QUALITY_C = 'Quality C';
const QP_1080P = '1080p Balanced';
const QP_720P = '720p Quality';
const QP_480P = '480p Quality';
const QP_HDTV = 'HDTV-1080p';
const PRERELEASES = 'Prereleases';
const PRERELEASE_MEMBERS = ['CAM', 'DVDSCR', 'REGIONAL', 'TELECINE', 'TELESYNC', 'WORKPRINT'];
const AMZN = 'AMZN';
const MUBI = 'MUBI';
const SHO = 'SHO';
const DRPO = 'DRPO';
const H265 = 'h265';
const X265 = 'x265';
const NF = 'NF';
const ATVP = 'ATVP';

type LatestHistory = {
	status: string;
	conflict_reason: string | null;
};

type QualityProfileRow = {
	name: string;
	description: string | null;
	minimum_custom_format_score: number;
	upgrade_until_score: number;
	upgrade_score_increment: number;
};

type QualityItemRow = {
	quality_profile_name: string;
	type: 'quality' | 'group';
	name: string;
	position: number;
	enabled: number;
	upgrade_until: number;
};

type QualityGroupMemberRow = {
	quality_profile_name: string;
	quality_group_name: string;
	quality_name: string;
	position: number;
};

type QualityProfileCustomFormatScoreRow = {
	quality_profile_name: string;
	custom_format_name: string;
	arr_type: string;
	score: number;
};

type QualityProfileTagRow = {
	quality_profile_name: string;
	tag_name: string;
};

type QualityProfileLanguageRow = {
	quality_profile_name: string;
	language_name: string;
};

let counter = 0;

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

teardown(async () => {
	await stopServer(PORT);
});

/**
 * Migrates old 2.42.
 *
 * Context
 *   Base layer seeded with available qualities only.
 *
 * User
 *   POST create quality profile:
 *     description='Local full payload description'
 *   POST scoring update changes:
 *     minimum_custom_format_score = 50
 *   POST qualities update changes order to:
 *     Quality B, Quality A, Quality C
 *
 * Upstream
 *   Published base create with same name:
 *     description='Upstream full payload description'
 *     minimum_custom_format_score = 100
 *     quality order: Quality B, Quality C, Quality A
 *
 * Expect
 *   - create duplicate conflicts by strategy
 *   - scoring and qualities resolve by strategy
 *   - final full state is local only for override, otherwise upstream
 */
test('duplicate create with scoring and qualities resolves by strategy', async () => {
	const profileName = 'Duplicate Full Payload';
	const localItems = [
		qualityItem(QUALITY_B, 1),
		qualityItem(QUALITY_A, 2),
		qualityItem(QUALITY_C, 3)
	];
	const upstreamItems = [
		qualityItem(QUALITY_B, 1),
		qualityItem(QUALITY_C, 2),
		qualityItem(QUALITY_A, 3)
	];

	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'duplicate-create-full-payload', [
			base.qualities({
				entries: [
					{ name: QUALITY_A, arrType: 'radarr' },
					{ name: QUALITY_B, arrType: 'radarr' },
					{ name: QUALITY_C, arrType: 'radarr' }
				]
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.create(ctx, {
			name: profileName,
			description: 'Local full payload description'
		});
		await write.qualityProfile.updateScoring(ctx, 1, {
			minimumScore: 50
		});
		await write.qualityProfile.updateQualities(ctx, 1, {
			orderedItems: localItems
		});

		seedUpstream(
			ctx,
			base.qualityProfile({
				name: profileName,
				description: 'Upstream full payload description',
				minimumScore: 100,
				qualityItems: upstreamItems
			})
		);
		await compilePcd(ctx);

		const ops = opsSince(ctx, checkpoint);
		const createOp = firstOpForOperation(ops, 'create');
		assertStrategyOutcome(ctx, createOp, strategy, 'duplicate_key');

		const row = assertQualityProfile(ctx, profileName);
		assertEquals(
			row.description,
			strategy === 'override'
				? 'Local full payload description'
				: 'Upstream full payload description'
		);
		assertEquals(row.minimum_custom_format_score, strategy === 'override' ? 50 : 100);
		assertEquals(
			compiledQualityOrder(ctx, profileName),
			strategy === 'override'
				? [QUALITY_B, QUALITY_A, QUALITY_C]
				: [QUALITY_B, QUALITY_C, QUALITY_A]
		);
	}
});

/**
 * Migrates old 2.46.
 *
 * Context
 *   Base layer seeded with one quality profile across general, scoring, and qualities.
 *
 * User
 *   POST general update changes description, language, and tags.
 *   POST scoring update changes minimum score, upgrade increment, and CF scores.
 *   POST qualities update adds HDTV-1080p to the 1080p group and adds Prereleases.
 *
 * Upstream
 *   Published base ops change description, minimum score, selected CF scores, and qualities.
 *   Published base ops also add non-conflicting tag, upgrade-until score, NF, and ATVP scores.
 *
 * Expect
 *   - conflicting fields resolve by strategy
 *   - current row-based qualities behavior applies cleanly
 *   - non-conflicting local and upstream fields still apply
 */
test('real-world multi-surface conflict resolves by strategy', async () => {
	const baseDescription = '1080p WEB-DLs from 4 to 8gb.';
	const localDescription = 'Chinese 1080p WEB-DLs from 4 to 8gb.';
	const upstreamDescription = '1080p WEB-DLs from 4 to 10gb.';
	const baseItems = realWorldBaseItems();
	const localItems = [
		qualityGroup(QP_1080P, 0, ['Bluray-1080p', 'WEBDL-1080p', QP_HDTV]),
		qualityItem(QP_720P, 1),
		qualityItem(QP_480P, 2),
		qualityGroup(PRERELEASES, 3, PRERELEASE_MEMBERS)
	];
	const upstreamItems = [
		qualityGroup(QP_1080P, 0, ['Bluray-1080p', 'WEBDL-1080p']),
		qualityItem(QP_720P, 1),
		qualityItem(QP_480P, 2),
		qualityGroup(PRERELEASES, 3, PRERELEASE_MEMBERS)
	];

	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'real-world-multi-surface', [
			base.languages(['Chinese']),
			base.qualities({
				entries: [
					...['Bluray-1080p', 'WEBDL-1080p', QP_HDTV, QP_720P, QP_480P],
					...PRERELEASE_MEMBERS
				].map((name) => ({ name, arrType: 'radarr' as const }))
			}),
			...[AMZN, MUBI, SHO, DRPO, H265, X265, NF, ATVP].map((name) => base.customFormat({ name })),
			base.qualityProfile({
				name: PROFILE_NAME,
				description: baseDescription,
				minimumScore: 5000,
				upgradeUntilScore: 0,
				upgradeScoreIncrement: 1,
				customFormatScores: [
					{ customFormatName: AMZN, arrType: 'radarr', score: 1000 },
					{ customFormatName: AMZN, arrType: 'sonarr', score: 2000 },
					{ customFormatName: MUBI, arrType: 'radarr', score: 20 },
					{ customFormatName: MUBI, arrType: 'sonarr', score: 20 },
					{ customFormatName: SHO, arrType: 'radarr', score: 20 },
					{ customFormatName: SHO, arrType: 'sonarr', score: 20 },
					{ customFormatName: DRPO, arrType: 'radarr', score: 20 },
					{ customFormatName: DRPO, arrType: 'sonarr', score: 20 },
					{ customFormatName: H265, arrType: 'radarr', score: 100 },
					{ customFormatName: H265, arrType: 'sonarr', score: 100 },
					{ customFormatName: X265, arrType: 'radarr', score: 100 },
					{ customFormatName: X265, arrType: 'sonarr', score: 100 }
				],
				qualityItems: baseItems
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateGeneral(ctx, 1, {
			name: PROFILE_NAME,
			description: localDescription,
			language: 'Chinese',
			tags: ['Streaming Optimised']
		});
		await write.qualityProfile.updateScoring(ctx, 1, {
			minimumScore: 0,
			upgradeScoreIncrement: 10000,
			customFormatScores: [
				{ customFormatName: MUBI, arrType: 'radarr', score: 1000 },
				{ customFormatName: MUBI, arrType: 'sonarr', score: 2000 },
				{ customFormatName: SHO, arrType: 'radarr', score: 1000 },
				{ customFormatName: SHO, arrType: 'sonarr', score: 2000 },
				{ customFormatName: DRPO, arrType: 'radarr', score: 1000 },
				{ customFormatName: DRPO, arrType: 'sonarr', score: 2000 },
				{ customFormatName: H265, arrType: 'radarr', score: 0 },
				{ customFormatName: H265, arrType: 'sonarr', score: 0 },
				{ customFormatName: X265, arrType: 'radarr', score: 0 },
				{ customFormatName: X265, arrType: 'sonarr', score: 0 }
			]
		});
		await write.qualityProfile.updateQualities(ctx, 1, {
			orderedItems: localItems
		});

		seedUpstream(
			ctx,
			upstreamUpdate(PROFILE_NAME, {
				description: { from: baseDescription, to: upstreamDescription }
			})
		);
		seedUpstream(ctx, upstreamAddTags(PROFILE_NAME, ['Recommended']));
		seedUpstream(
			ctx,
			upstreamProfileScoringUpdate(PROFILE_NAME, {
				minimum_custom_format_score: { from: 5000, to: 10000 },
				upgrade_until_score: { from: 0, to: 50000 }
			})
		);
		seedUpstream(ctx, upstreamUpdateCustomFormatScore(PROFILE_NAME, SHO, 'radarr', 20, -250));
		seedUpstream(ctx, upstreamUpdateCustomFormatScore(PROFILE_NAME, SHO, 'sonarr', 20, -250));
		seedUpstream(ctx, upstreamUpdateCustomFormatScore(PROFILE_NAME, DRPO, 'radarr', 20, 150));
		seedUpstream(ctx, upstreamAddCustomFormatScore(PROFILE_NAME, NF, 'radarr', 500));
		seedUpstream(ctx, upstreamAddCustomFormatScore(PROFILE_NAME, ATVP, 'sonarr', 750));
		seedUpstream(ctx, upstreamReplaceQualityItems(PROFILE_NAME, baseItems, upstreamItems));
		await compilePcd(ctx);

		const ops = opsSince(ctx, checkpoint);
		const descriptionOp = firstOpForChangedFields(ops, ['description']);
		assertStrategyOutcome(ctx, descriptionOp, strategy, 'guard_mismatch');
		const minimumScoreOp = firstOpForChangedFields(ops, ['minimum_custom_format_score']);
		assertStrategyOutcome(ctx, minimumScoreOp, strategy, 'guard_mismatch');
		const shoRadarrOp = firstOpForChangedFields(ops, [`custom_format_score:${SHO}:radarr`]);
		assertStrategyOutcome(ctx, shoRadarrOp, strategy, 'guard_mismatch');
		const shoSonarrOp = firstOpForChangedFields(ops, [`custom_format_score:${SHO}:sonarr`]);
		assertStrategyOutcome(ctx, shoSonarrOp, strategy, 'guard_mismatch');
		const drpoRadarrOp = firstOpForChangedFields(ops, [`custom_format_score:${DRPO}:radarr`]);
		assertStrategyOutcome(ctx, drpoRadarrOp, strategy, 'guard_mismatch');
		const qualitiesOp = firstOpForChangedFields(ops, [
			`quality_item:group:${QP_1080P}`,
			`quality_item:group:${PRERELEASES}`
		]);
		assertEquals(qualitiesOp.state, 'published');
		assertLatestHistory(ctx, qualitiesOp, 'applied');

		if (strategy === 'ask') {
			assertEquals(pendingConflictCountSince(ctx, checkpoint), 5);
		} else {
			assertNoPendingConflicts(ctx);
		}

		const profile = assertQualityProfile(ctx, PROFILE_NAME);
		assertEquals(
			profile.description,
			strategy === 'override' ? localDescription : upstreamDescription
		);
		assertEquals(profile.minimum_custom_format_score, strategy === 'override' ? 0 : 10000);
		assertEquals(profile.upgrade_score_increment, 10000);
		assertEquals(profile.upgrade_until_score, 50000);

		assertEquals(
			compiledCustomFormatScore(ctx, PROFILE_NAME, SHO, 'radarr'),
			strategy === 'override' ? 1000 : -250
		);
		assertEquals(
			compiledCustomFormatScore(ctx, PROFILE_NAME, SHO, 'sonarr'),
			strategy === 'override' ? 2000 : -250
		);
		assertEquals(
			compiledCustomFormatScore(ctx, PROFILE_NAME, DRPO, 'radarr'),
			strategy === 'override' ? 1000 : 150
		);
		assertEquals(compiledCustomFormatScore(ctx, PROFILE_NAME, DRPO, 'sonarr'), 2000);
		assertEquals(compiledCustomFormatScore(ctx, PROFILE_NAME, MUBI, 'radarr'), 1000);
		assertEquals(compiledCustomFormatScore(ctx, PROFILE_NAME, MUBI, 'sonarr'), 2000);
		assertEquals(compiledCustomFormatScore(ctx, PROFILE_NAME, H265, 'radarr'), 0);
		assertEquals(compiledCustomFormatScore(ctx, PROFILE_NAME, X265, 'sonarr'), 0);
		assertEquals(compiledCustomFormatScore(ctx, PROFILE_NAME, NF, 'radarr'), 500);
		assertEquals(compiledCustomFormatScore(ctx, PROFILE_NAME, ATVP, 'sonarr'), 750);

		assertEquals(compiledQualityProfileTags(ctx, PROFILE_NAME), [
			'Recommended',
			'Streaming Optimised'
		]);
		assertEquals(compiledQualityProfileLanguage(ctx, PROFILE_NAME), 'Chinese');
		assertEquals(compiledGroupMembers(ctx, PROFILE_NAME, QP_1080P), [
			'Bluray-1080p',
			'WEBDL-1080p',
			QP_HDTV
		]);
		assertEquals(compiledQualityOrder(ctx, PROFILE_NAME), [
			QP_1080P,
			QP_720P,
			QP_480P,
			PRERELEASES
		]);
		assertEquals(compiledGroupMembers(ctx, PROFILE_NAME, PRERELEASES), PRERELEASE_MEMBERS);
	}
});

async function newScenario(strategy: ConflictStrategy, name: string): Promise<PcdTestContext> {
	counter++;
	return setupPcd({
		port: PORT,
		name: `pcd-conflict-quality-profile-full-${counter}-${strategy}-${name}`,
		conflictStrategy: strategy
	});
}

async function seededScenario(
	strategy: ConflictStrategy,
	name: string,
	operations: Array<string | SeedOperation>
): Promise<PcdTestContext> {
	const ctx = await newScenario(strategy, name);
	seedBase(ctx, operations);
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

function opsSince(ctx: PcdTestContext, checkpoint: number): OpRow[] {
	return queryOpsSince(ctx, checkpoint, { origin: 'user' });
}

function firstOpForChangedFields(ops: OpRow[], fields: string[]): OpRow {
	const expected = [...fields].sort();
	const op = ops.find((candidate) => {
		const actual = changedFields(candidate).sort();
		return (
			actual.length === expected.length && actual.every((field, index) => field === expected[index])
		);
	});
	assertExists(op, `Expected a user op for ${fields.join(', ')}`);
	return op;
}

function firstOpForOperation(ops: OpRow[], operation: string): OpRow {
	const op = ops.find((candidate) => parseMetadata(candidate).operation === operation);
	assertExists(op, `Expected a user op for operation ${operation}`);
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
	const label = JSON.stringify(parseMetadata(op));
	assertEquals(history.status, status, label);
	if (reason !== undefined) {
		assertEquals(history.conflict_reason, reason, label);
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

function pendingConflictCountSince(ctx: PcdTestContext, checkpoint: number): number {
	return opsSince(ctx, checkpoint).filter(
		(op) => latestHistory(ctx, op.id).status === 'conflicted_pending'
	).length;
}

function assertQualityProfile(ctx: PcdTestContext, name: string): QualityProfileRow {
	const row = compiledQualityProfileState(ctx).profiles.find((profile) => profile.name === name);
	assertExists(row, `Expected quality profile ${name}`);
	return row;
}

function compiledCustomFormatScore(
	ctx: PcdTestContext,
	profileName: string,
	customFormatName: string,
	arrType: 'all' | 'radarr' | 'sonarr'
): number | null {
	return (
		compiledQualityProfileState(ctx).customFormatScores.find(
			(score) =>
				score.quality_profile_name === profileName &&
				score.custom_format_name === customFormatName &&
				score.arr_type === arrType
		)?.score ?? null
	);
}

function compiledQualityProfileTags(ctx: PcdTestContext, profileName: string): string[] {
	return compiledQualityProfileState(ctx)
		.tags.filter((tag) => tag.quality_profile_name === profileName)
		.map((tag) => tag.tag_name);
}

function compiledQualityProfileLanguage(ctx: PcdTestContext, profileName: string): string | null {
	return (
		compiledQualityProfileState(ctx).languages.find(
			(language) => language.quality_profile_name === profileName
		)?.language_name ?? null
	);
}

function compiledQualityOrder(ctx: PcdTestContext, profileName: string): string[] {
	return compiledQualityProfileState(ctx)
		.qualityItems.filter((item) => item.quality_profile_name === profileName)
		.sort((a, b) => a.position - b.position)
		.map((item) => item.name);
}

function compiledGroupMembers(
	ctx: PcdTestContext,
	profileName: string,
	groupName: string
): string[] {
	return compiledQualityProfileState(ctx)
		.groupMembers.filter(
			(member) =>
				member.quality_profile_name === profileName && member.quality_group_name === groupName
		)
		.sort((a, b) => a.position - b.position)
		.map((member) => member.quality_name);
}

function qualityItem(
	name: string,
	position: number,
	overrides: Partial<QualityProfileQualityItemInput> = {}
): QualityProfileQualityItemInput {
	return {
		type: 'quality',
		name,
		position,
		enabled: overrides.enabled ?? true,
		upgradeUntil: overrides.upgradeUntil ?? false,
		members: overrides.members
	};
}

function qualityGroup(
	name: string,
	position: number,
	members: string[],
	overrides: Partial<QualityProfileQualityItemInput> = {}
): QualityProfileQualityItemInput {
	return {
		type: 'group',
		name,
		position,
		enabled: overrides.enabled ?? true,
		upgradeUntil: overrides.upgradeUntil ?? false,
		members: members.map((member) => ({ name: member }))
	};
}

function realWorldBaseItems(): QualityProfileQualityItemInput[] {
	return [
		qualityGroup(QP_1080P, 0, ['Bluray-1080p', 'WEBDL-1080p']),
		qualityItem(QP_720P, 1),
		qualityItem(QP_480P, 2)
	];
}

function compiledQualityProfileState(ctx: PcdTestContext): {
	profiles: QualityProfileRow[];
	customFormatScores: QualityProfileCustomFormatScoreRow[];
	tags: QualityProfileTagRow[];
	languages: QualityProfileLanguageRow[];
	qualityItems: QualityItemRow[];
	groupMembers: QualityGroupMemberRow[];
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

		const profiles = replay
			.prepare(
				`SELECT name,
				        description,
				        minimum_custom_format_score,
				        upgrade_until_score,
				        upgrade_score_increment
				 FROM quality_profiles
				 ORDER BY name`
			)
			.all() as QualityProfileRow[];
		const customFormatScores = replay
			.prepare(
				`SELECT quality_profile_name, custom_format_name, arr_type, score
				 FROM quality_profile_custom_formats
				 ORDER BY quality_profile_name, custom_format_name, arr_type`
			)
			.all() as QualityProfileCustomFormatScoreRow[];
		const tags = replay
			.prepare(
				`SELECT quality_profile_name, tag_name
				 FROM quality_profile_tags
				 ORDER BY quality_profile_name, tag_name`
			)
			.all() as QualityProfileTagRow[];
		const languages = replay
			.prepare(
				`SELECT quality_profile_name, language_name
				 FROM quality_profile_languages
				 ORDER BY quality_profile_name, language_name`
			)
			.all() as QualityProfileLanguageRow[];
		const qualityItems = replay
			.prepare(
				`SELECT quality_profile_name,
				        CASE
				          WHEN quality_group_name IS NULL THEN 'quality'
				          ELSE 'group'
				        END AS type,
				        COALESCE(quality_name, quality_group_name) AS name,
				        position,
				        enabled,
				        upgrade_until
				 FROM quality_profile_qualities
				 ORDER BY quality_profile_name, position, name`
			)
			.all() as QualityItemRow[];
		const groupMembers = replay
			.prepare(
				`SELECT quality_profile_name,
				        quality_group_name,
				        quality_name,
				        position
				 FROM quality_group_members
				 ORDER BY quality_profile_name, quality_group_name, position, quality_name`
			)
			.all() as QualityGroupMemberRow[];

		return { profiles, customFormatScores, tags, languages, qualityItems, groupMembers };
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

function upstreamUpdate(
	name: string,
	changes: Record<string, { from: unknown; to: unknown }>
): SeedOperation {
	const fields = Object.keys(changes);
	const setSql = fields.map((field) => `${field} = ${sqlValue(changes[field].to)}`).join(', ');
	return {
		sql: `UPDATE quality_profiles SET ${setSql} WHERE name = ${sqlValue(name)};`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'quality_profile',
			name,
			stable_key: { key: 'quality_profile_name', value: name },
			changed_fields: fields
		}),
		desiredState: JSON.stringify(changes)
	};
}

function upstreamAddTags(name: string, tags: string[]): SeedOperation {
	const tagSql = tags.map((tag) =>
		[
			`INSERT INTO tags (name) VALUES (${sqlValue(tag)}) ON CONFLICT(name) DO NOTHING;`,
			`INSERT INTO quality_profile_tags (quality_profile_name, tag_name) VALUES (${sqlValue(
				name
			)}, ${sqlValue(tag)});`
		].join('\n')
	);
	return {
		sql: tagSql.join('\n'),
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'quality_profile',
			name,
			stable_key: { key: 'quality_profile_name', value: name },
			changed_fields: ['tags']
		}),
		desiredState: JSON.stringify({ tags: { add: tags, remove: [] } })
	};
}

function upstreamProfileScoringUpdate(
	name: string,
	changes: Record<string, { from: unknown; to: unknown }>
): SeedOperation {
	const fields = Object.keys(changes);
	const setSql = fields.map((field) => `${field} = ${sqlValue(changes[field].to)}`).join(', ');
	return {
		sql: `UPDATE quality_profiles SET ${setSql} WHERE name = ${sqlValue(name)};`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'quality_profile',
			name,
			stable_key: { key: 'quality_profile_name', value: name },
			changed_fields: fields
		}),
		desiredState: JSON.stringify(changes)
	};
}

function upstreamUpdateCustomFormatScore(
	profileName: string,
	customFormatName: string,
	arrType: 'all' | 'radarr' | 'sonarr',
	from: number,
	to: number
): SeedOperation {
	return {
		sql: `UPDATE quality_profile_custom_formats
		      SET score = ${sqlValue(to)}
		      WHERE quality_profile_name = ${sqlValue(profileName)}
		        AND custom_format_name = ${sqlValue(customFormatName)}
		        AND arr_type = ${sqlValue(arrType)}
		        AND score = ${sqlValue(from)};`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'quality_profile',
			name: profileName,
			stable_key: { key: 'quality_profile_name', value: profileName },
			changed_fields: [`custom_format_score:${customFormatName}:${arrType}`],
			depends_on: [{ entity: 'custom_format', key: 'custom_format_name', value: customFormatName }]
		}),
		desiredState: JSON.stringify({
			custom_format_scores: [{ custom_format_name: customFormatName, arr_type: arrType, from, to }]
		})
	};
}

function upstreamAddCustomFormatScore(
	profileName: string,
	customFormatName: string,
	arrType: 'all' | 'radarr' | 'sonarr',
	score: number
): SeedOperation {
	return {
		sql: `INSERT INTO quality_profile_custom_formats (quality_profile_name, custom_format_name, arr_type, score)
		      VALUES (${sqlValue(profileName)}, ${sqlValue(customFormatName)}, ${sqlValue(
						arrType
					)}, ${sqlValue(score)});`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'quality_profile',
			name: profileName,
			stable_key: { key: 'quality_profile_name', value: profileName },
			changed_fields: [`custom_format_score:${customFormatName}:${arrType}`],
			depends_on: [{ entity: 'custom_format', key: 'custom_format_name', value: customFormatName }]
		}),
		desiredState: JSON.stringify({
			custom_format_scores: [
				{ custom_format_name: customFormatName, arr_type: arrType, from: null, to: score }
			]
		})
	};
}

function upstreamReplaceQualityItems(
	name: string,
	from: QualityProfileQualityItemInput[],
	to: QualityProfileQualityItemInput[]
): SeedOperation {
	return {
		sql: [
			`DELETE FROM quality_group_members WHERE quality_profile_name = ${sqlValue(name)};`,
			`DELETE FROM quality_profile_qualities WHERE quality_profile_name = ${sqlValue(name)};`,
			`DELETE FROM quality_groups WHERE quality_profile_name = ${sqlValue(name)};`,
			qualityProfileQualityItemsSql(name, to)
		].join('\n'),
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'quality_profile',
			name,
			stable_key: { key: 'quality_profile_name', value: name },
			changed_fields: changedQualityItemFields(from, to)
		}),
		desiredState: JSON.stringify({
			ordered_items: { from, to }
		})
	};
}

function qualityProfileQualityItemsSql(
	profileName: string,
	items: QualityProfileQualityItemInput[]
): string {
	const qualityNames = Array.from(
		new Set(
			items.flatMap((item) => (item.type === 'quality' ? [item.name] : memberNames(item.members)))
		)
	);
	const qualitySql = qualityNames
		.map((name) => `INSERT OR IGNORE INTO qualities (name) VALUES (${sqlValue(name)});`)
		.join('\n');
	const itemSql = items.map((item) => {
		if (item.type === 'quality') {
			return `INSERT INTO quality_profile_qualities
			        (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until)
			        VALUES (${sqlValue(profileName)}, ${sqlValue(item.name)}, NULL, ${item.position}, ${
								item.enabled ? 1 : 0
							}, ${item.upgradeUntil ? 1 : 0});`;
		}

		const members = Array.from(new Set(memberNames(item.members)));
		const memberSql = members
			.map(
				(member, index) =>
					`INSERT INTO quality_group_members
					 (quality_profile_name, quality_group_name, quality_name, position)
					 VALUES (${sqlValue(profileName)}, ${sqlValue(item.name)}, ${sqlValue(member)}, ${index});`
			)
			.join('\n');

		return [
			`INSERT INTO quality_groups (quality_profile_name, name)
			 VALUES (${sqlValue(profileName)}, ${sqlValue(item.name)});`,
			memberSql,
			`INSERT INTO quality_profile_qualities
			 (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until)
			 VALUES (${sqlValue(profileName)}, NULL, ${sqlValue(item.name)}, ${item.position}, ${
					item.enabled ? 1 : 0
				}, ${item.upgradeUntil ? 1 : 0});`
		].join('\n');
	});

	return [qualitySql, ...itemSql].join('\n');
}

function changedQualityItemFields(
	from: QualityProfileQualityItemInput[],
	to: QualityProfileQualityItemInput[]
): string[] {
	const fromByKey = new Map(from.map((item) => [qualityItemKey(item), item]));
	const toByKey = new Map(to.map((item) => [qualityItemKey(item), item]));
	const keys = new Set([...fromByKey.keys(), ...toByKey.keys()]);
	const changed: string[] = [];
	for (const key of keys) {
		const before = fromByKey.get(key);
		const after = toByKey.get(key);
		if (!before || !after || !qualityItemsEqual(before, after)) {
			changed.push(`quality_item:${key}`);
		}
	}
	return changed;
}

function qualityItemsEqual(
	a: QualityProfileQualityItemInput,
	b: QualityProfileQualityItemInput
): boolean {
	return (
		a.type === b.type &&
		a.name === b.name &&
		a.position === b.position &&
		a.enabled === b.enabled &&
		a.upgradeUntil === b.upgradeUntil &&
		stringArraysEqual(memberNames(a.members), memberNames(b.members))
	);
}

function qualityItemKey(item: QualityProfileQualityItemInput): string {
	return `${item.type}:${item.name}`;
}

function memberNames(members: QualityProfileQualityItemInput['members'] | undefined): string[] {
	return (members ?? []).map((member) => member.name);
}

function stringArraysEqual(a: string[], b: string[]): boolean {
	return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sqlValue(value: unknown): string {
	if (value === null || value === undefined) return 'NULL';
	if (typeof value === 'number') return String(value);
	if (typeof value === 'boolean') return value ? '1' : '0';
	return `'${String(value).replace(/'/g, "''")}'`;
}

await run();
