import { assertEquals } from '@std/assert';
import { dealSpecFiles } from '../../flows/harness/specFiles.ts';

const FILES = ['a.spec.ts', 'b.spec.ts', 'c.spec.ts', 'd.spec.ts', 'e.spec.ts'];

/** Every shard's files for a deal of `total` */
const deal = (timings: Record<string, number>, total = 2) =>
	Array.from({ length: total }, (_, index) => dealSpecFiles(FILES, index + 1, total, timings));

Deno.test('Spec deal: without timings, files go round like cards', () => {
	assertEquals(deal({}), [
		['a.spec.ts', 'c.spec.ts', 'e.spec.ts'],
		['b.spec.ts', 'd.spec.ts']
	]);
});

Deno.test('Spec deal: the slowest files go to the shard with the least time', () => {
	const timings = {
		'a.spec.ts': 10,
		'b.spec.ts': 9,
		'c.spec.ts': 2,
		'd.spec.ts': 2,
		'e.spec.ts': 1
	};
	// a 10 + d 2 = 12 against b 9 + c 2 + e 1 = 12
	assertEquals(deal(timings), [
		['a.spec.ts', 'd.spec.ts'],
		['b.spec.ts', 'c.spec.ts', 'e.spec.ts']
	]);
});

Deno.test('Spec deal: a file without a time counts as the average', () => {
	// The average of a and b is 6, so e weighs 6 and joins the shard without a
	const timings = { 'a.spec.ts': 10, 'b.spec.ts': 2 };
	const [first, second] = deal(timings);
	assertEquals(first.includes('a.spec.ts'), true);
	assertEquals(second.includes('a.spec.ts'), false);
	assertEquals([...first, ...second].sort(), FILES);
});

Deno.test('Spec deal: every file lands in exactly one shard', () => {
	const timings = { 'a.spec.ts': 3, 'c.spec.ts': 7 };
	const shards = deal(timings, 3);
	assertEquals(shards.flat().sort(), FILES);
});
