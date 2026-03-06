import { Cron } from 'croner';
import { parseUTC } from '$shared/utils/dates.ts';

/**
 * Validate a cron expression and check minimum interval.
 *
 * For `*\/N * * * *` patterns, validates against N directly (the intended
 * interval) since cron gap analysis gives misleading results when N doesn't
 * evenly divide 60.
 *
 * For all other patterns, computes actual gaps between consecutive runs.
 *
 * Returns error string or null if valid.
 */
export function validateCronExpression(
	cronExpr: string,
	minIntervalMinutes: number = 0
): string | null {
	try {
		new Cron(cronExpr);
	} catch {
		return 'Invalid cron expression';
	}

	if (minIntervalMinutes <= 0) return null;

	// Fast path for */N * * * * — validate against the intended interval
	const everyMatch = cronExpr.trim().match(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/);
	if (everyMatch) {
		const n = parseInt(everyMatch[1], 10);
		if (n < minIntervalMinutes) {
			return `Schedule too frequent. Minimum interval is ${minIntervalMinutes} minutes.`;
		}
		return null;
	}

	// For all other patterns: compute actual run gaps
	const cron = new Cron(cronExpr);
	const now = new Date();
	const runs: Date[] = [];
	let cursor = now;
	for (let i = 0; i < 3; i++) {
		const next = cron.nextRun(cursor);
		if (!next) break;
		runs.push(next);
		cursor = new Date(next.getTime() + 1000);
	}

	if (runs.length < 2) return null;

	for (let i = 1; i < runs.length; i++) {
		const gapMin = (runs[i].getTime() - runs[i - 1].getTime()) / 60000;
		if (gapMin < minIntervalMinutes) {
			return `Schedule too frequent. Minimum interval is ${minIntervalMinutes} minutes.`;
		}
	}

	return null;
}

/**
 * Calculate the next run time from a cron expression
 */
export function calculateNextRun(cronExpr: string | null): string | null {
	if (!cronExpr) return null;
	try {
		const cron = new Cron(cronExpr);
		const nextRun = cron.nextRun();
		return nextRun?.toISOString() ?? null;
	} catch {
		return null;
	}
}

export function calculateNextRunFromMinutes(
	lastRunAt: string | null,
	scheduleMinutes: number
): string {
	if (!lastRunAt) {
		return new Date().toISOString();
	}
	const base = parseUTC(lastRunAt);
	if (!base) {
		return new Date().toISOString();
	}
	const next = new Date(base);
	next.setMinutes(next.getMinutes() + scheduleMinutes);
	return next.toISOString();
}

export function calculateCooldownUntil(
	lastRunAt: string | null,
	scheduleMinutes: number
): string | null {
	if (!lastRunAt) return null;
	const base = parseUTC(lastRunAt);
	if (!base) return null;
	const next = new Date(base);
	next.setMinutes(next.getMinutes() + scheduleMinutes);
	return next.toISOString();
}

export function calculateNextRunFromSchedule(schedule: string): string {
	const now = new Date();

	if (schedule === 'daily') {
		const next = new Date(now);
		next.setDate(next.getDate() + 1);
		next.setHours(0, 0, 0, 0);
		return next.toISOString();
	}
	if (schedule === 'hourly') {
		const next = new Date(now);
		next.setHours(next.getHours() + 1, 0, 0, 0);
		return next.toISOString();
	}
	if (schedule === 'weekly') {
		const next = new Date(now);
		next.setDate(next.getDate() + 7);
		next.setHours(0, 0, 0, 0);
		return next.toISOString();
	}
	if (schedule === 'monthly') {
		const next = new Date(now);
		next.setMonth(next.getMonth() + 1, 1);
		next.setHours(0, 0, 0, 0);
		return next.toISOString();
	}

	try {
		const cron = new Cron(schedule);
		const nextRun = cron.nextRun();
		if (nextRun) return nextRun.toISOString();
	} catch {
		// fall through
	}

	const fallback = new Date(now);
	fallback.setHours(fallback.getHours() + 1);
	return fallback.toISOString();
}
