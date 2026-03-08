/**
 * Tests for upgrade rate limiting: getRunsPerHour, calculateMaxCount, validateCronExpression
 */

import { BaseTest } from '../base/BaseTest.ts';
import { assertEquals } from '@std/assert';
import { getRunsPerHour, calculateMaxCount } from '../../../src/lib/shared/upgrades/filters.ts';
import { validateCronExpression } from '../../../src/lib/server/jobs/scheduleUtils.ts';

class GetRunsPerHourTest extends BaseTest {
	runTests(): void {
		// =====================
		// */N patterns (every N minutes) — fast path: ceil(60/N)
		// =====================

		this.test('every 10 min: 6 runs/hour', () => {
			assertEquals(getRunsPerHour('*/10 * * * *'), 6);
		});

		this.test('every 15 min: 4 runs/hour', () => {
			assertEquals(getRunsPerHour('*/15 * * * *'), 4);
		});

		this.test('every 20 min: 3 runs/hour', () => {
			assertEquals(getRunsPerHour('*/20 * * * *'), 3);
		});

		this.test('every 30 min: 2 runs/hour', () => {
			assertEquals(getRunsPerHour('*/30 * * * *'), 2);
		});

		this.test('every 60 min: 1 run/hour', () => {
			assertEquals(getRunsPerHour('*/60 * * * *'), 1);
		});

		this.test('every 1 min: 60 runs/hour', () => {
			assertEquals(getRunsPerHour('*/1 * * * *'), 60);
		});

		this.test('every 5 min: 12 runs/hour', () => {
			assertEquals(getRunsPerHour('*/5 * * * *'), 12);
		});

		// Non-dividing values: ceil(60/N)
		this.test('every 7 min: ceil(60/7) = 9 runs/hour', () => {
			assertEquals(getRunsPerHour('*/7 * * * *'), 9);
		});

		this.test('every 59 min: ceil(60/59) = 2 runs/hour', () => {
			assertEquals(getRunsPerHour('*/59 * * * *'), 2);
		});

		this.test('every 45 min: ceil(60/45) = 2 runs/hour', () => {
			assertEquals(getRunsPerHour('*/45 * * * *'), 2);
		});

		// =====================
		// Hourly patterns (simulation path)
		// =====================

		this.test('hourly at :00: 1 run/hour', () => {
			assertEquals(getRunsPerHour('0 * * * *'), 1);
		});

		this.test('hourly at :30: 1 run/hour', () => {
			assertEquals(getRunsPerHour('30 * * * *'), 1);
		});

		// =====================
		// Every-N-hours patterns
		// =====================

		this.test('every 2 hours: 0.5 runs/hour', () => {
			const rph = getRunsPerHour('0 */2 * * *');
			// 12 runs/day = 12/24 = 0.5
			assertEquals(rph !== null && rph > 0.49 && rph < 0.51, true);
		});

		this.test('every 6 hours: ~0.17 runs/hour', () => {
			const rph = getRunsPerHour('0 */6 * * *');
			// 4 runs/day = 4/24 = 1/6 ≈ 0.1667
			assertEquals(rph !== null && rph > 0.16 && rph < 0.18, true);
		});

		// =====================
		// Daily/weekly/monthly
		// =====================

		this.test('daily: ~1/24 runs/hour', () => {
			const rph = getRunsPerHour('0 3 * * *');
			// 28 runs in 28 days = 28/672 = 1/24
			assertEquals(rph !== null && Math.abs(rph - 1 / 24) < 0.01, true);
		});

		this.test('weekly: ~1/168 runs/hour', () => {
			const rph = getRunsPerHour('0 3 * * 1');
			// 4 runs in 28 days = 4/672 = 1/168
			assertEquals(rph !== null && Math.abs(rph - 1 / 168) < 0.001, true);
		});

		// =====================
		// Custom: multiple minutes per hour
		// =====================

		this.test('custom: twice per hour (0,30): 2 rph', () => {
			const rph = getRunsPerHour('0,30 * * * *');
			assertEquals(rph !== null && Math.abs(rph - 2) < 0.02, true);
		});

		this.test('custom: 4 times per hour (0,15,30,45): 4 rph', () => {
			const rph = getRunsPerHour('0,15,30,45 * * * *');
			assertEquals(rph !== null && Math.abs(rph - 4) < 0.02, true);
		});

		this.test('custom: 3 times per hour (0,20,40): 3 rph', () => {
			const rph = getRunsPerHour('0,20,40 * * * *');
			assertEquals(rph !== null && Math.abs(rph - 3) < 0.02, true);
		});

		// =====================
		// Custom: every N hours
		// =====================

		this.test('custom: every 3 hours: ~0.33 rph', () => {
			const rph = getRunsPerHour('0 */3 * * *');
			// 8 runs/day = 8/24 = 1/3
			assertEquals(rph !== null && Math.abs(rph - 1 / 3) < 0.02, true);
		});

		this.test('custom: every 4 hours: 0.25 rph', () => {
			const rph = getRunsPerHour('0 */4 * * *');
			// 6 runs/day = 6/24 = 0.25
			assertEquals(rph !== null && Math.abs(rph - 0.25) < 0.02, true);
		});

		this.test('custom: every 8 hours: 0.125 rph', () => {
			const rph = getRunsPerHour('0 */8 * * *');
			// 3 runs/day = 3/24 = 0.125
			assertEquals(rph !== null && Math.abs(rph - 0.125) < 0.02, true);
		});

		this.test('custom: every 12 hours: ~0.083 rph', () => {
			const rph = getRunsPerHour('0 */12 * * *');
			// 2 runs/day = 2/24 = 1/12
			assertEquals(rph !== null && Math.abs(rph - 1 / 12) < 0.02, true);
		});

		// =====================
		// Custom: specific times per day
		// =====================

		this.test('custom: 3 times/day (8,12,18): ~0.125 rph', () => {
			const rph = getRunsPerHour('0 8,12,18 * * *');
			// 3 runs/day = 3/24 = 0.125
			assertEquals(rph !== null && Math.abs(rph - 3 / 24) < 0.02, true);
		});

		this.test('custom: twice daily (8,20): ~0.083 rph', () => {
			const rph = getRunsPerHour('0 8,20 * * *');
			// 2 runs/day = 2/24 = 1/12
			assertEquals(rph !== null && Math.abs(rph - 2 / 24) < 0.02, true);
		});

		// =====================
		// Custom: hourly ranges (business hours)
		// =====================

		this.test('custom: hourly 9am-5pm (9 runs/day): ~0.375 rph', () => {
			const rph = getRunsPerHour('0 9-17 * * *');
			// 9 runs/day = 9/24 = 0.375
			assertEquals(rph !== null && Math.abs(rph - 9 / 24) < 0.02, true);
		});

		this.test('custom: business hours weekdays (9-17 Mon-Fri): ~0.134 rph', () => {
			const rph = getRunsPerHour('0 9-17 * * 1-5');
			// 9 runs/day × 5 days/week = 45 runs/week = 45/168 ≈ 0.268
			assertEquals(rph !== null && Math.abs(rph - 45 / 168) < 0.02, true);
		});

		// =====================
		// Custom: multi-day-of-week
		// =====================

		this.test('custom: Mon/Wed/Fri at 3am: ~3/168 rph', () => {
			const rph = getRunsPerHour('0 3 * * 1,3,5');
			// 3 runs/week = 3/168
			assertEquals(rph !== null && Math.abs(rph - 3 / 168) < 0.01, true);
		});

		this.test('custom: weekends only at noon: ~2/168 rph', () => {
			const rph = getRunsPerHour('0 12 * * 0,6');
			// 2 runs/week = 2/168
			assertEquals(rph !== null && Math.abs(rph - 2 / 168) < 0.01, true);
		});

		// =====================
		// Custom: every N days
		// =====================

		this.test('custom: every 2 days at midnight: ~0.021 rph', () => {
			const rph = getRunsPerHour('0 0 */2 * *');
			// ~14 runs in 28 days = 14/672 ≈ 0.0208
			assertEquals(rph !== null && Math.abs(rph - 14 / 672) < 0.01, true);
		});

		// =====================
		// Edge cases
		// =====================

		this.test('null for empty string', () => {
			assertEquals(getRunsPerHour(''), null);
		});

		this.test('null for invalid cron', () => {
			assertEquals(getRunsPerHour('not a cron'), null);
		});
	}
}

class CalculateMaxCountTest extends BaseTest {
	runTests(): void {
		// =====================
		// Radarr (10 searches/hour)
		// =====================

		this.test('radarr: 6 runs/hour (every 10 min) → max 1', () => {
			assertEquals(calculateMaxCount('radarr', 6), 1);
		});

		this.test('radarr: 4 runs/hour (every 15 min) → max 2', () => {
			assertEquals(calculateMaxCount('radarr', 4), 2);
		});

		this.test('radarr: 3 runs/hour (every 20 min) → max 3', () => {
			assertEquals(calculateMaxCount('radarr', 3), 3);
		});

		this.test('radarr: 2 runs/hour (every 30 min) → max 5', () => {
			assertEquals(calculateMaxCount('radarr', 2), 5);
		});

		this.test('radarr: 1 run/hour (hourly) → max 10', () => {
			assertEquals(calculateMaxCount('radarr', 1), 10);
		});

		this.test('radarr: 0.5 runs/hour (every 2 hours) → capped at 10', () => {
			// floor(10/0.5) = 20, but capped at maxPerHour = 10
			assertEquals(calculateMaxCount('radarr', 0.5), 10);
		});

		this.test('radarr: 1/24 runs/hour (daily) → capped at 10', () => {
			// All searches fire in one burst, can't exceed hourly limit
			assertEquals(calculateMaxCount('radarr', 1 / 24), 10);
		});

		// =====================
		// Sonarr (1 search/hour)
		// =====================

		this.test('sonarr: 1 run/hour (hourly) → max 1', () => {
			assertEquals(calculateMaxCount('sonarr', 1), 1);
		});

		this.test('sonarr: 0.5 runs/hour (every 2 hours) → capped at 1', () => {
			// floor(1/0.5) = 2, but capped at maxPerHour = 1
			assertEquals(calculateMaxCount('sonarr', 0.5), 1);
		});

		this.test('sonarr: 1/24 runs/hour (daily) → capped at 1', () => {
			assertEquals(calculateMaxCount('sonarr', 1 / 24), 1);
		});

		// =====================
		// Unknown app type
		// =====================

		this.test('unknown app type returns 5', () => {
			assertEquals(calculateMaxCount('lidarr', 1), 5);
		});

		// =====================
		// Edge: minimum is always 1
		// =====================

		this.test('radarr: 60 runs/hour (every 1 min) → min 1', () => {
			assertEquals(calculateMaxCount('radarr', 60), 1);
		});

		// =====================
		// End-to-end: getRunsPerHour → calculateMaxCount
		// =====================

		this.test('e2e radarr: */10 → 6 rph → count 1, total 6/hr ≤ 10', () => {
			const rph = getRunsPerHour('*/10 * * * *')!;
			const max = calculateMaxCount('radarr', rph);
			assertEquals(max, 1);
			assertEquals(rph * max <= 10, true);
		});

		this.test('e2e radarr: */30 → 2 rph → count 5, total 10/hr ≤ 10', () => {
			const rph = getRunsPerHour('*/30 * * * *')!;
			const max = calculateMaxCount('radarr', rph);
			assertEquals(max, 5);
			assertEquals(rph * max <= 10, true);
		});

		this.test('e2e radarr: hourly → 1 rph → count 10, total 10/hr ≤ 10', () => {
			const rph = getRunsPerHour('0 * * * *')!;
			const max = calculateMaxCount('radarr', rph);
			assertEquals(max, 10);
			assertEquals(rph * max <= 10, true);
		});

		this.test('e2e radarr: every 2 hrs → 0.5 rph → count 10 (capped), total 5/hr ≤ 10', () => {
			const rph = getRunsPerHour('0 */2 * * *')!;
			const max = calculateMaxCount('radarr', rph);
			assertEquals(max, 10);
		});

		this.test('e2e radarr: daily → count 10 (capped)', () => {
			const rph = getRunsPerHour('0 3 * * *')!;
			const max = calculateMaxCount('radarr', rph);
			assertEquals(max, 10);
		});

		this.test('e2e radarr: */59 → 2 rph → count 5, total 10/hr ≤ 10', () => {
			const rph = getRunsPerHour('*/59 * * * *')!;
			const max = calculateMaxCount('radarr', rph);
			assertEquals(rph, 2);
			assertEquals(max, 5);
			assertEquals(rph * max <= 10, true);
		});

		this.test('e2e sonarr: hourly → 1 rph → count 1', () => {
			const rph = getRunsPerHour('0 * * * *')!;
			const max = calculateMaxCount('sonarr', rph);
			assertEquals(max, 1);
			assertEquals(rph * max <= 1, true);
		});

		this.test('e2e sonarr: daily → count 1 (capped)', () => {
			const rph = getRunsPerHour('0 3 * * *')!;
			const max = calculateMaxCount('sonarr', rph);
			assertEquals(max, 1);
		});

		// =====================
		// End-to-end: custom patterns
		// =====================

		this.test('e2e radarr: twice/hour (0,30) → ~2 rph → count 5, ≤ 10/hr', () => {
			const rph = getRunsPerHour('0,30 * * * *')!;
			const max = calculateMaxCount('radarr', rph);
			assertEquals(max, 5);
			assertEquals(rph * max <= 10, true);
		});

		this.test('e2e radarr: 4x/hour (0,15,30,45) → ~4 rph → count 2, ≤ 10/hr', () => {
			const rph = getRunsPerHour('0,15,30,45 * * * *')!;
			const max = calculateMaxCount('radarr', rph);
			assertEquals(max, 2);
			assertEquals(rph * max <= 10, true);
		});

		this.test('e2e radarr: every 3 hours → ~0.33 rph → count 10 (capped)', () => {
			const rph = getRunsPerHour('0 */3 * * *')!;
			const max = calculateMaxCount('radarr', rph);
			assertEquals(max, 10);
		});

		this.test('e2e radarr: every 4 hours → 0.25 rph → count 10 (capped)', () => {
			const rph = getRunsPerHour('0 */4 * * *')!;
			const max = calculateMaxCount('radarr', rph);
			assertEquals(max, 10);
		});

		this.test('e2e radarr: 3 times/day (8,12,18) → count 10 (capped)', () => {
			const rph = getRunsPerHour('0 8,12,18 * * *')!;
			const max = calculateMaxCount('radarr', rph);
			assertEquals(max, 10);
		});

		this.test('e2e radarr: hourly 9-17 → ~0.375 rph → count 10 (capped)', () => {
			const rph = getRunsPerHour('0 9-17 * * *')!;
			const max = calculateMaxCount('radarr', rph);
			assertEquals(max, 10);
		});

		this.test('e2e radarr: business hours weekdays → count 10 (capped)', () => {
			const rph = getRunsPerHour('0 9-17 * * 1-5')!;
			const max = calculateMaxCount('radarr', rph);
			assertEquals(max, 10);
		});

		this.test('e2e radarr: Mon/Wed/Fri → count 10 (capped)', () => {
			const rph = getRunsPerHour('0 3 * * 1,3,5')!;
			const max = calculateMaxCount('radarr', rph);
			assertEquals(max, 10);
		});

		this.test('e2e radarr: every 2 days → count 10 (capped)', () => {
			const rph = getRunsPerHour('0 0 */2 * *')!;
			const max = calculateMaxCount('radarr', rph);
			assertEquals(max, 10);
		});

		this.test('e2e sonarr: twice/hour (0,30) → ~2 rph → count 1 (min), ≤ 1/hr', () => {
			const rph = getRunsPerHour('0,30 * * * *')!;
			const max = calculateMaxCount('sonarr', rph);
			assertEquals(max, 1);
		});

		this.test('e2e sonarr: every 3 hours → ~0.33 rph → count 1 (capped)', () => {
			const rph = getRunsPerHour('0 */3 * * *')!;
			const max = calculateMaxCount('sonarr', rph);
			assertEquals(max, 1);
		});

		this.test('e2e sonarr: business hours weekdays → count 1 (capped)', () => {
			const rph = getRunsPerHour('0 9-17 * * 1-5')!;
			const max = calculateMaxCount('sonarr', rph);
			assertEquals(max, 1);
		});
	}
}

class ValidateCronExpressionTest extends BaseTest {
	runTests(): void {
		// =====================
		// Valid expressions
		// =====================

		this.test('valid: every 10 min with 10 min minimum', () => {
			assertEquals(validateCronExpression('*/10 * * * *', 10), null);
		});

		this.test('valid: every 30 min with 10 min minimum', () => {
			assertEquals(validateCronExpression('*/30 * * * *', 10), null);
		});

		this.test('valid: every 60 min with 60 min minimum (sonarr)', () => {
			assertEquals(validateCronExpression('*/60 * * * *', 60), null);
		});

		this.test('valid: hourly with 10 min minimum', () => {
			assertEquals(validateCronExpression('0 * * * *', 10), null);
		});

		this.test('valid: hourly with 60 min minimum', () => {
			assertEquals(validateCronExpression('0 * * * *', 60), null);
		});

		this.test('valid: daily with any minimum', () => {
			assertEquals(validateCronExpression('0 3 * * *', 60), null);
		});

		// =====================
		// */N pattern: validates against N directly (not cron gaps)
		// =====================

		this.test('valid: */59 with 10 min minimum (59 >= 10)', () => {
			assertEquals(validateCronExpression('*/59 * * * *', 10), null);
		});

		this.test('valid: */26 with 10 min minimum (26 >= 10)', () => {
			assertEquals(validateCronExpression('*/26 * * * *', 10), null);
		});

		this.test('valid: */29 with 10 min minimum (29 >= 10)', () => {
			assertEquals(validateCronExpression('*/29 * * * *', 10), null);
		});

		// =====================
		// Too frequent
		// =====================

		this.test('invalid: every 5 min with 10 min minimum', () => {
			const result = validateCronExpression('*/5 * * * *', 10);
			assertEquals(result !== null, true);
		});

		this.test('invalid: every 30 min with 60 min minimum (sonarr)', () => {
			const result = validateCronExpression('*/30 * * * *', 60);
			assertEquals(result !== null, true);
		});

		// =====================
		// Invalid cron
		// =====================

		this.test('invalid: bad cron expression', () => {
			assertEquals(validateCronExpression('not valid', 10), 'Invalid cron expression');
		});

		// =====================
		// Custom patterns: gap-based validation
		// =====================

		this.test('valid: twice/hour (0,30) with 10 min minimum (30 min gap)', () => {
			assertEquals(validateCronExpression('0,30 * * * *', 10), null);
		});

		this.test('invalid: twice/hour (0,30) with 60 min minimum (30 min gap < 60)', () => {
			const result = validateCronExpression('0,30 * * * *', 60);
			assertEquals(result !== null, true);
		});

		this.test('valid: 4x/hour (0,15,30,45) with 10 min minimum (15 min gap)', () => {
			assertEquals(validateCronExpression('0,15,30,45 * * * *', 10), null);
		});

		this.test('invalid: 4x/hour (0,15,30,45) with 60 min minimum (15 min gap < 60)', () => {
			const result = validateCronExpression('0,15,30,45 * * * *', 60);
			assertEquals(result !== null, true);
		});

		this.test('invalid: 0,5 * * * * with 10 min minimum (5 min gap < 10)', () => {
			const result = validateCronExpression('0,5 * * * *', 10);
			assertEquals(result !== null, true);
		});

		this.test('invalid: every minute in range 0-5 with 10 min minimum (1 min gap)', () => {
			const result = validateCronExpression('0-5 * * * *', 10);
			assertEquals(result !== null, true);
		});

		this.test('valid: every 3 hours with 60 min minimum (180 min gap)', () => {
			assertEquals(validateCronExpression('0 */3 * * *', 60), null);
		});

		this.test('valid: every 4 hours with 60 min minimum (240 min gap)', () => {
			assertEquals(validateCronExpression('0 */4 * * *', 60), null);
		});

		this.test('valid: 3 times/day (8,12,18) with 60 min minimum (4 hr min gap)', () => {
			assertEquals(validateCronExpression('0 8,12,18 * * *', 60), null);
		});

		this.test('invalid: back-to-back hours (8,9) with 120 min minimum (60 min gap < 120)', () => {
			const result = validateCronExpression('0 8,9 * * *', 120);
			assertEquals(result !== null, true);
		});

		this.test('valid: back-to-back hours (8,9) with 60 min minimum (60 min gap = 60)', () => {
			assertEquals(validateCronExpression('0 8,9 * * *', 60), null);
		});

		this.test('valid: business hours 9-17 with 10 min minimum (60 min gap)', () => {
			assertEquals(validateCronExpression('0 9-17 * * *', 10), null);
		});

		this.test('valid: business hours 9-17 with 60 min minimum (60 min gap)', () => {
			assertEquals(validateCronExpression('0 9-17 * * *', 60), null);
		});

		this.test('valid: weekends only with 60 min minimum', () => {
			assertEquals(validateCronExpression('0 12 * * 0,6', 60), null);
		});

		this.test('valid: Mon/Wed/Fri with 60 min minimum', () => {
			assertEquals(validateCronExpression('0 3 * * 1,3,5', 60), null);
		});

		this.test('valid: every 2 days with 60 min minimum', () => {
			assertEquals(validateCronExpression('0 0 */2 * *', 60), null);
		});

		this.test('valid: business hours weekdays with 60 min minimum', () => {
			assertEquals(validateCronExpression('0 9-17 * * 1-5', 60), null);
		});

		// =====================
		// Custom: edge cases that could trick gap analysis
		// =====================

		this.test('invalid: * * * * * (every minute) with 10 min minimum', () => {
			const result = validateCronExpression('* * * * *', 10);
			assertEquals(result !== null, true);
		});

		this.test('invalid: 0,1 * * * * with 10 min minimum (1 min gap)', () => {
			const result = validateCronExpression('0,1 * * * *', 10);
			assertEquals(result !== null, true);
		});

		this.test('valid: 0 0,12 * * * with 60 min minimum (12 hr gap)', () => {
			assertEquals(validateCronExpression('0 0,12 * * *', 60), null);
		});

		// =====================
		// No minimum (always valid)
		// =====================

		this.test('no minimum: always valid', () => {
			assertEquals(validateCronExpression('*/1 * * * *', 0), null);
		});
	}
}

// Run all test suites
const runsPerHourTests = new GetRunsPerHourTest();
runsPerHourTests.runTests();

const maxCountTests = new CalculateMaxCountTest();
maxCountTests.runTests();

const validateTests = new ValidateCronExpressionTest();
validateTests.runTests();
