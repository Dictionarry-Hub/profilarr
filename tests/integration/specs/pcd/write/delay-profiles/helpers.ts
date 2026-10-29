/**
 * Shared scenario factory and op assertions for delay profile write specs.
 */

import { expect } from 'vitest';
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
} from '#integration/specs/pcd/harness/pcd.ts';

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
	expect(op, `Expected a user op for ${field}`).not.toBeOneOf([null, undefined]);
	return op;
}

export function opForChangedFields(ops: OpRow[], fields: string[]): OpRow {
	const expected = [...fields].sort();
	const op = ops.find((candidate) => {
		const actual = changedFields(candidate).sort();
		return (
			actual.length === expected.length && actual.every((field, index) => field === expected[index])
		);
	});
	expect(op, `Expected a user op for ${fields.join(', ')}`).not.toBeOneOf([null, undefined]);
	return op;
}

export function assertOnlyField(ops: OpRow[], field: string): void {
	const op = opForChangedField(ops, field);
	expect(changedFields(op)).toStrictEqual([field]);
	const sql = normalizeSql(op.sql).toLowerCase();
	expect(
		sql.includes(`"${field}"`) || sql.includes(field),
		`Expected ${field} SQL to mention its field, got ${sql}`
	).toBeTruthy();
}

export function assertSameGroup(ops: OpRow[]): void {
	const groupIds = ops.map((op) => parseMetadata(op).group_id);
	expect(groupIds.length > 0).toBeTruthy();
	expect(groupIds[0]).not.toBeOneOf([null, undefined]);
	for (const groupId of groupIds) {
		expect(groupId).toStrictEqual(groupIds[0]);
	}
}

export async function assertActionFailed(response: Response): Promise<void> {
	const body = await response.text();
	expect(
		response.status >= 400 || body.includes('"type":"failure"'),
		`Expected form action failure, got status=${response.status} body=${body}`
	).toBeTruthy();
}
