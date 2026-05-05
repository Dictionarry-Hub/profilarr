/**
 * Shared scenario factory and op assertions for regex write specs.
 */

import { assert, assertEquals, assertExists } from '@std/assert';
import {
	compilePcd,
	normalizeSql,
	parseMetadata,
	queryOpsSince,
	seedBase,
	setupPcd,
	type OpRow,
	type PcdTestContext,
	type SetupPcdOptions
} from '../../harness/pcd.ts';

export function createScenarioFactory(port: number, prefix: string) {
	let counter = 0;

	async function newPcd(
		name: string,
		options: Partial<SetupPcdOptions> = {}
	): Promise<PcdTestContext> {
		counter++;
		return setupPcd({
			port,
			name: `${prefix}-${counter}-${name}`,
			conflictStrategy: 'ask',
			...options
		});
	}

	async function seededPcd(
		name: string,
		operations: Parameters<typeof seedBase>[1],
		options: Partial<SetupPcdOptions> = {}
	): Promise<PcdTestContext> {
		const ctx = await newPcd(name, options);
		seedBase(ctx, operations);
		await compilePcd(ctx);
		return ctx;
	}

	return { newPcd, seededPcd };
}

export function userOpsSince(ctx: PcdTestContext, checkpoint: number): OpRow[] {
	return queryOpsSince(ctx, checkpoint, { origin: 'user', state: 'published' });
}

export function changedFields(op: OpRow): string[] {
	const fields = parseMetadata(op).changed_fields;
	if (!Array.isArray(fields)) return [];
	return fields.filter((field): field is string => typeof field === 'string');
}

export function opForChangedField(ops: OpRow[], field: string): OpRow {
	const op = ops.find((candidate) => {
		const fields = changedFields(candidate);
		return fields.length === 1 && fields[0] === field;
	});
	assertExists(op, `Expected a user op for ${field}`);
	return op;
}

export function assertOnlyField(ops: OpRow[], field: string): void {
	const op = opForChangedField(ops, field);
	assertEquals(changedFields(op), [field]);
	const sql = normalizeSql(op.sql).toLowerCase();
	assert(
		sql.includes(`"${field}"`) || sql.includes(field),
		`Expected ${field} SQL to mention its field, got ${sql}`
	);
}

export function assertSameGroup(ops: OpRow[]): void {
	const groupIds = ops.map((op) => parseMetadata(op).group_id);
	assert(groupIds.length > 0);
	assertExists(groupIds[0]);
	for (const groupId of groupIds) {
		assertEquals(groupId, groupIds[0]);
	}
}

export function generatedCustomFormatOp(ops: OpRow[]): OpRow {
	const op = ops.find((candidate) => {
		const metadata = parseMetadata(candidate);
		return metadata.entity === 'custom_format' && metadata.generated === true;
	});
	assertExists(op, 'Expected a generated custom format op');
	return op;
}

export async function assertActionFailed(response: Response): Promise<void> {
	const body = await response.text();
	assert(
		response.status >= 400 || body.includes('"type":"failure"'),
		`Expected form action failure, got status=${response.status} body=${body}`
	);
}
