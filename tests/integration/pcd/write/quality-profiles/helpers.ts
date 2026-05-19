/**
 * Shared scenario factory and op assertions for quality profile write specs.
 */

import { assertExists } from '@std/assert';
import {
	compilePcd,
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
