import { expect, test } from 'vitest';
import { dealSpecFiles } from '#flows/harness/specFiles.ts';

const FILES = ['a.spec.ts', 'b.spec.ts', 'c.spec.ts', 'd.spec.ts', 'e.spec.ts'];

/** Every shard's files for a deal of `total` */
const deal = (timings: Record<string, number>, total = 2) =>
	Array.from({ length: total }, (_, index) => dealSpecFiles(FILES, index + 1, total, timings));

test('Spec deal: without timings, files go round like cards', () => {
	expect(deal({})).toStrictEqual([
		['a.spec.ts', 'c.spec.ts', 'e.spec.ts'],
		['b.spec.ts', 'd.spec.ts']
	]);
});

test('Spec deal: the slowest files go to the shard with the least time', () => {
	const timings = {
		'a.spec.ts': 10,
		'b.spec.ts': 9,
		'c.spec.ts': 2,
		'd.spec.ts': 2,
		'e.spec.ts': 1
	};
	// a 10 + d 2 = 12 against b 9 + c 2 + e 1 = 12
	expect(deal(timings)).toStrictEqual([
		['a.spec.ts', 'd.spec.ts'],
		['b.spec.ts', 'c.spec.ts', 'e.spec.ts']
	]);
});

test('Spec deal: a file without a time counts as the average', () => {
	// The average of a and b is 6, so e weighs 6 and joins the shard without a
	const timings = { 'a.spec.ts': 10, 'b.spec.ts': 2 };
	const [first, second] = deal(timings);
	expect(first.includes('a.spec.ts')).toStrictEqual(true);
	expect(second.includes('a.spec.ts')).toStrictEqual(false);
	expect([...first, ...second].sort()).toStrictEqual(FILES);
});

test('Spec deal: every file lands in exactly one shard', () => {
	const timings = { 'a.spec.ts': 3, 'c.spec.ts': 7 };
	const shards = deal(timings, 3);
	expect(shards.flat().sort()).toStrictEqual(FILES);
});
