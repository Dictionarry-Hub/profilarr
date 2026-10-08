/**
 * Whole-number durations stored as minutes and displayed in a chosen unit.
 * Arr delay profiles only accept integer minutes, so every value converts
 * back to whole minutes.
 */

export type DurationUnit = 'minutes' | 'hours' | 'days';

export const DURATION_UNITS: DurationUnit[] = ['minutes', 'hours', 'days'];

export const MINUTES_PER_UNIT: Record<DurationUnit, number> = {
	minutes: 1,
	hours: 60,
	days: 1440
};

export function toMinutes(value: number, unit: DurationUnit): number {
	return value * MINUTES_PER_UNIT[unit];
}

export function fromMinutes(minutes: number, unit: DurationUnit): number {
	return minutes / MINUTES_PER_UNIT[unit];
}

function fitsUnit(minutes: number[], unit: DurationUnit): boolean {
	return minutes.every((value) => value % MINUTES_PER_UNIT[unit] === 0);
}

export function largestEvenUnit(minutes: number[]): DurationUnit {
	for (const unit of [...DURATION_UNITS].reverse()) {
		if (fitsUnit(minutes, unit)) return unit;
	}
	return 'minutes';
}

export interface DurationField {
	minutes: number;
	/** Pre-rounding minutes, kept so switching back restores the value. */
	originalMinutes: number | null;
}

export interface UnitSwitchResult extends DurationField {
	value: number;
	rounded: boolean;
}

/**
 * Convert a field to a new unit, rounding up when the original minutes don't
 * divide evenly into it.
 */
export function switchUnit(field: DurationField, unit: DurationUnit): UnitSwitchResult {
	const source = field.originalMinutes ?? field.minutes;
	const value = Math.ceil(source / MINUTES_PER_UNIT[unit]);
	const minutes = toMinutes(value, unit);
	const rounded = minutes !== source;
	return { minutes, value, rounded, originalMinutes: rounded ? source : null };
}

export function formatDuration(value: number, unit: DurationUnit): string {
	return `${value} ${value === 1 ? unit.slice(0, -1) : unit}`;
}

export interface DurationFieldInfo {
	label: string;
	/** Disabled fields still convert but are left out of the rounding message. */
	enabled: boolean;
}

export interface UnitChangeResult<K extends string> {
	state: Record<K, DurationField>;
	/** Describes every enabled field that was rounded, or null if none were. */
	message: string | null;
}

/**
 * Switch every field to a new unit. Fields are processed in the order of
 * `info`, which also sets the order of the rounding message.
 */
export function changeUnit<K extends string>(
	state: Record<K, DurationField>,
	info: Record<K, DurationFieldInfo>,
	unit: DurationUnit
): UnitChangeResult<K> {
	const next = { ...state };
	const messages: string[] = [];

	for (const key of Object.keys(info) as K[]) {
		const result = switchUnit(state[key], unit);
		next[key] = { minutes: result.minutes, originalMinutes: result.originalMinutes };

		if (result.rounded && info[key].enabled && result.originalMinutes !== null) {
			const fromUnit = largestEvenUnit([result.originalMinutes]);
			const from = formatDuration(fromMinutes(result.originalMinutes, fromUnit), fromUnit);
			messages.push(
				`${info[key].label} rounded up from ${from} to ${formatDuration(result.value, unit)}.`
			);
		}
	}

	return { state: next, message: messages.length > 0 ? messages.join(' ') : null };
}

/** Set a field from a typed value, dropping its remembered original. */
export function enterValue<K extends string>(
	state: Record<K, DurationField>,
	key: NoInfer<K>,
	value: number,
	unit: DurationUnit
): Record<K, DurationField> {
	return { ...state, [key]: { minutes: toMinutes(value, unit), originalMinutes: null } };
}

/** Forget every remembered original, e.g. after the rounded values are saved. */
export function clearOriginals<K extends string>(
	state: Record<K, DurationField>
): Record<K, DurationField> {
	const next = { ...state };
	for (const key of Object.keys(state) as K[]) {
		next[key] = { minutes: state[key].minutes, originalMinutes: null };
	}
	return next;
}
