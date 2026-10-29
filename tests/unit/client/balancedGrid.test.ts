/**
 * Column choice for the sync page grids: as many columns as fit, but a count
 * whose last row is fullest wins, within the allowed slack.
 */

import { describe, expect, test } from 'vitest';
import { chooseColumns } from '#client/utils/balancedGrid.ts';

const opts = (count: number) => ({ count, minWidth: 224, gap: 8 });

describe('chooseColumns', () => {
	test('everything on one row shares the width when it fits', () => {
		expect(chooseColumns(2000, opts(3))).toStrictEqual(3);
		expect(chooseColumns(2000, opts(8))).toStrictEqual(8);
	});

	test('a full last row keeps the maximum column count', () => {
		// 2000px fits 8 columns of 224 + 8 gap
		expect(chooseColumns(2000, opts(16))).toStrictEqual(8);
	});

	test('an orphaned last row drops columns to fill it, within the slack', () => {
		// 8 columns would leave 1 on the last row; 7 leaves 3 of 7; 6 leaves 5 of 6
		expect(chooseColumns(2000, opts(17))).toStrictEqual(6);
		// 8 leaves 2; 7 leaves 4; 6 leaves 6, a full row
		expect(chooseColumns(2000, opts(18))).toStrictEqual(6);
	});

	test('never collapses past the slack', () => {
		// 8 leaves 1 of 8, 7 leaves 4 of 7, 6 leaves 1 of 6; 5 would be a full row but is out of reach
		expect(chooseColumns(2000, opts(25))).toStrictEqual(7);
		expect(chooseColumns(2000, { ...opts(25), slack: 3 })).toStrictEqual(5);
	});

	test('narrow containers fall back to one column', () => {
		expect(chooseColumns(200, opts(10))).toStrictEqual(1);
		expect(chooseColumns(0, opts(10))).toStrictEqual(1);
	});
});
