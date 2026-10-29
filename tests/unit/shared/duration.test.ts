import { expect } from 'vitest';
import { BaseTest } from '#tests/unit/base/BaseTest.ts';
import {
	changeUnit,
	clearOriginals,
	enterValue,
	formatDelay,
	formatDuration,
	formatMinutes,
	fromMinutes,
	largestEvenUnit,
	switchUnit,
	toMinutes,
	type DurationField,
	type DurationFieldInfo
} from '#shared/utils/duration.ts';

type Field = 'usenet' | 'torrent';

const enabled: Record<Field, DurationFieldInfo> = {
	usenet: { label: 'Usenet delay', enabled: true },
	torrent: { label: 'Torrent delay', enabled: true }
};

function fields(usenet: number, torrent: number): Record<Field, DurationField> {
	return {
		usenet: { minutes: usenet, originalMinutes: null },
		torrent: { minutes: torrent, originalMinutes: null }
	};
}

function minutes(state: Record<Field, DurationField>): Record<Field, number> {
	return { usenet: state.usenet.minutes, torrent: state.torrent.minutes };
}

class DurationTest extends BaseTest {
	runTests(): void {
		this.test('converts unit values to minutes', () => {
			expect(toMinutes(14, 'days')).toStrictEqual(20160);
			expect(toMinutes(2, 'hours')).toStrictEqual(120);
			expect(toMinutes(45, 'minutes')).toStrictEqual(45);
			expect(toMinutes(0, 'days')).toStrictEqual(0);
		});

		this.test('converts minutes to unit values', () => {
			expect(fromMinutes(20160, 'days')).toStrictEqual(14);
			expect(fromMinutes(120, 'hours')).toStrictEqual(2);
			expect(fromMinutes(45, 'minutes')).toStrictEqual(45);
		});

		this.test('picks the largest unit every value divides into', () => {
			expect(largestEvenUnit([20160])).toStrictEqual('days');
			expect(largestEvenUnit([120])).toStrictEqual('hours');
			expect(largestEvenUnit([90])).toStrictEqual('minutes');
			expect(largestEvenUnit([1440, 60])).toStrictEqual('hours');
			expect(largestEvenUnit([1440, 30])).toStrictEqual('minutes');
			expect(largestEvenUnit([0, 0])).toStrictEqual('days');
		});

		this.test('switches units without rounding when the value divides evenly', () => {
			expect(switchUnit({ minutes: 20160, originalMinutes: null }, 'days')).toStrictEqual({
				minutes: 20160,
				value: 14,
				rounded: false,
				originalMinutes: null
			});
			expect(switchUnit({ minutes: 0, originalMinutes: null }, 'days')).toStrictEqual({
				minutes: 0,
				value: 0,
				rounded: false,
				originalMinutes: null
			});
		});

		this.test('rounds up when switching to a unit the value does not divide into', () => {
			expect(switchUnit({ minutes: 30, originalMinutes: null }, 'days')).toStrictEqual({
				minutes: 1440,
				value: 1,
				rounded: true,
				originalMinutes: 30
			});
			expect(switchUnit({ minutes: 61, originalMinutes: null }, 'hours')).toStrictEqual({
				minutes: 120,
				value: 2,
				rounded: true,
				originalMinutes: 61
			});
		});

		this.test('restores the original value when switching back', () => {
			const days = switchUnit({ minutes: 30, originalMinutes: null }, 'days');
			expect(switchUnit(days, 'minutes')).toStrictEqual({
				minutes: 30,
				value: 30,
				rounded: false,
				originalMinutes: null
			});
		});

		this.test('rounds from the original value when moving between rounded units', () => {
			const days = switchUnit({ minutes: 30, originalMinutes: null }, 'days');
			expect(switchUnit(days, 'hours')).toStrictEqual({
				minutes: 60,
				value: 1,
				rounded: true,
				originalMinutes: 30
			});
		});

		this.test('rounds up to a larger unit and restores when switching back', () => {
			const days = changeUnit(fields(360, 0), enabled, 'days');
			expect(minutes(days.state)).toStrictEqual({ usenet: 1440, torrent: 0 });
			expect(days.message).toStrictEqual('Usenet delay rounded up from 6 hours to 1 day.');

			const hours = changeUnit(days.state, enabled, 'hours');
			expect(minutes(hours.state)).toStrictEqual({ usenet: 360, torrent: 0 });
			expect(hours.message).toStrictEqual(null);
			expect(hours.state.usenet.originalMinutes).toStrictEqual(null);
		});

		this.test('rounds from the original value across several switches', () => {
			const hours = changeUnit(fields(90, 0), enabled, 'hours');
			expect(hours.state.usenet.minutes).toStrictEqual(120);
			expect(hours.message).toStrictEqual('Usenet delay rounded up from 90 minutes to 2 hours.');

			const days = changeUnit(hours.state, enabled, 'days');
			expect(days.state.usenet.minutes).toStrictEqual(1440);
			expect(days.message).toStrictEqual('Usenet delay rounded up from 90 minutes to 1 day.');

			const backToHours = changeUnit(days.state, enabled, 'hours');
			expect(backToHours.state.usenet.minutes).toStrictEqual(120);

			const backToMinutes = changeUnit(backToHours.state, enabled, 'minutes');
			expect(backToMinutes.state.usenet).toStrictEqual({ minutes: 90, originalMinutes: null });
			expect(backToMinutes.message).toStrictEqual(null);
		});

		this.test('converts exact values to smaller units without rounding', () => {
			const hours = changeUnit(fields(1440, 20160), enabled, 'hours');
			expect(minutes(hours.state)).toStrictEqual({ usenet: 1440, torrent: 20160 });
			expect(fromMinutes(hours.state.usenet.minutes, 'hours')).toStrictEqual(24);
			expect(hours.message).toStrictEqual(null);

			const mins = changeUnit(hours.state, enabled, 'minutes');
			expect(minutes(mins.state)).toStrictEqual({ usenet: 1440, torrent: 20160 });
			expect(mins.message).toStrictEqual(null);
		});

		this.test('typing a value replaces the remembered original', () => {
			const days = changeUnit(fields(360, 0), enabled, 'days');
			const typed = enterValue(days.state, 'usenet', 2, 'days');
			expect(typed.usenet).toStrictEqual({ minutes: 2880, originalMinutes: null });

			const hours = changeUnit(typed, enabled, 'hours');
			expect(hours.state.usenet.minutes).toStrictEqual(2880);
			expect(fromMinutes(hours.state.usenet.minutes, 'hours')).toStrictEqual(48);
			expect(hours.message).toStrictEqual(null);
		});

		this.test('typing one field leaves the other field untouched', () => {
			const days = changeUnit(fields(30, 30), enabled, 'days');
			const typed = enterValue(days.state, 'usenet', 3, 'days');
			expect(typed.torrent).toStrictEqual({ minutes: 1440, originalMinutes: 30 });
		});

		this.test('only names fields that were rounded', () => {
			const days = changeUnit(fields(30, 2880), enabled, 'days');
			expect(minutes(days.state)).toStrictEqual({ usenet: 1440, torrent: 2880 });
			expect(days.message).toStrictEqual('Usenet delay rounded up from 30 minutes to 1 day.');
		});

		this.test('names every rounded field in field order', () => {
			const hours = changeUnit(fields(30, 61), enabled, 'hours');
			expect(minutes(hours.state)).toStrictEqual({ usenet: 60, torrent: 120 });
			expect(hours.message).toStrictEqual(
				'Usenet delay rounded up from 30 minutes to 1 hour. ' +
					'Torrent delay rounded up from 61 minutes to 2 hours.'
			);
		});

		this.test('converts disabled fields without mentioning them', () => {
			const info: Record<Field, DurationFieldInfo> = {
				usenet: { label: 'Usenet delay', enabled: false },
				torrent: { label: 'Torrent delay', enabled: true }
			};
			const days = changeUnit(fields(30, 0), info, 'days');
			expect(days.state.usenet).toStrictEqual({ minutes: 1440, originalMinutes: 30 });
			expect(days.message).toStrictEqual(null);
		});

		this.test('clearing originals keeps rounded values when switching back', () => {
			const days = changeUnit(fields(360, 30), enabled, 'days');
			const saved = clearOriginals(days.state);
			expect(saved).toStrictEqual(fields(1440, 1440));

			const hours = changeUnit(saved, enabled, 'hours');
			expect(minutes(hours.state)).toStrictEqual({ usenet: 1440, torrent: 1440 });
			expect(hours.message).toStrictEqual(null);
		});

		this.test('formats durations with singular and plural labels', () => {
			expect(formatDuration(1, 'days')).toStrictEqual('1 day');
			expect(formatDuration(2, 'hours')).toStrictEqual('2 hours');
			expect(formatDuration(30, 'minutes')).toStrictEqual('30 minutes');
			expect(formatDuration(0, 'days')).toStrictEqual('0 days');
		});

		this.test('formats minutes as days, hours, and minutes', () => {
			expect(formatMinutes(20160)).toStrictEqual('14 days');
			expect(formatMinutes(1440)).toStrictEqual('1 day');
			expect(formatMinutes(1800)).toStrictEqual('1 day 6 hours');
			expect(formatMinutes(1501)).toStrictEqual('1 day 1 hour 1 minute');
			expect(formatMinutes(1450)).toStrictEqual('1 day 10 minutes');
			expect(formatMinutes(90)).toStrictEqual('1 hour 30 minutes');
			expect(formatMinutes(45)).toStrictEqual('45 minutes');
			expect(formatMinutes(0)).toStrictEqual('0 minutes');
		});

		this.test('formats minutes in short form', () => {
			expect(formatMinutes(20160, 'short')).toStrictEqual('14d');
			expect(formatMinutes(1800, 'short')).toStrictEqual('1d 6h');
			expect(formatMinutes(1501, 'short')).toStrictEqual('1d 1h 1m');
			expect(formatMinutes(1450, 'short')).toStrictEqual('1d 10m');
			expect(formatMinutes(90, 'short')).toStrictEqual('1h 30m');
			expect(formatMinutes(60, 'short')).toStrictEqual('1h');
			expect(formatMinutes(45, 'short')).toStrictEqual('45m');
			expect(formatMinutes(0, 'short')).toStrictEqual('0m');
		});

		this.test('formats delays for list views', () => {
			expect(formatDelay(null)).toStrictEqual('-');
			expect(formatDelay(0)).toStrictEqual('No delay');
			expect(formatDelay(30)).toStrictEqual('30m');
			expect(formatDelay(1800)).toStrictEqual('1d 6h');
			expect(formatDelay(20160)).toStrictEqual('14d');
		});
	}
}

const test = new DurationTest();
test.runTests();
