import { assertEquals } from '@std/assert';
import { BaseTest } from '../base/BaseTest.ts';
import {
	changeUnit,
	clearOriginals,
	enterValue,
	formatDuration,
	fromMinutes,
	largestEvenUnit,
	switchUnit,
	toMinutes,
	type DurationField,
	type DurationFieldInfo
} from '$shared/utils/duration.ts';

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
			assertEquals(toMinutes(14, 'days'), 20160);
			assertEquals(toMinutes(2, 'hours'), 120);
			assertEquals(toMinutes(45, 'minutes'), 45);
			assertEquals(toMinutes(0, 'days'), 0);
		});

		this.test('converts minutes to unit values', () => {
			assertEquals(fromMinutes(20160, 'days'), 14);
			assertEquals(fromMinutes(120, 'hours'), 2);
			assertEquals(fromMinutes(45, 'minutes'), 45);
		});

		this.test('picks the largest unit every value divides into', () => {
			assertEquals(largestEvenUnit([20160]), 'days');
			assertEquals(largestEvenUnit([120]), 'hours');
			assertEquals(largestEvenUnit([90]), 'minutes');
			assertEquals(largestEvenUnit([1440, 60]), 'hours');
			assertEquals(largestEvenUnit([1440, 30]), 'minutes');
			assertEquals(largestEvenUnit([0, 0]), 'days');
		});

		this.test('switches units without rounding when the value divides evenly', () => {
			assertEquals(switchUnit({ minutes: 20160, originalMinutes: null }, 'days'), {
				minutes: 20160,
				value: 14,
				rounded: false,
				originalMinutes: null
			});
			assertEquals(switchUnit({ minutes: 0, originalMinutes: null }, 'days'), {
				minutes: 0,
				value: 0,
				rounded: false,
				originalMinutes: null
			});
		});

		this.test('rounds up when switching to a unit the value does not divide into', () => {
			assertEquals(switchUnit({ minutes: 30, originalMinutes: null }, 'days'), {
				minutes: 1440,
				value: 1,
				rounded: true,
				originalMinutes: 30
			});
			assertEquals(switchUnit({ minutes: 61, originalMinutes: null }, 'hours'), {
				minutes: 120,
				value: 2,
				rounded: true,
				originalMinutes: 61
			});
		});

		this.test('restores the original value when switching back', () => {
			const days = switchUnit({ minutes: 30, originalMinutes: null }, 'days');
			assertEquals(switchUnit(days, 'minutes'), {
				minutes: 30,
				value: 30,
				rounded: false,
				originalMinutes: null
			});
		});

		this.test('rounds from the original value when moving between rounded units', () => {
			const days = switchUnit({ minutes: 30, originalMinutes: null }, 'days');
			assertEquals(switchUnit(days, 'hours'), {
				minutes: 60,
				value: 1,
				rounded: true,
				originalMinutes: 30
			});
		});

		this.test('rounds up to a larger unit and restores when switching back', () => {
			const days = changeUnit(fields(360, 0), enabled, 'days');
			assertEquals(minutes(days.state), { usenet: 1440, torrent: 0 });
			assertEquals(days.message, 'Usenet delay rounded up from 6 hours to 1 day.');

			const hours = changeUnit(days.state, enabled, 'hours');
			assertEquals(minutes(hours.state), { usenet: 360, torrent: 0 });
			assertEquals(hours.message, null);
			assertEquals(hours.state.usenet.originalMinutes, null);
		});

		this.test('rounds from the original value across several switches', () => {
			const hours = changeUnit(fields(90, 0), enabled, 'hours');
			assertEquals(hours.state.usenet.minutes, 120);
			assertEquals(hours.message, 'Usenet delay rounded up from 90 minutes to 2 hours.');

			const days = changeUnit(hours.state, enabled, 'days');
			assertEquals(days.state.usenet.minutes, 1440);
			assertEquals(days.message, 'Usenet delay rounded up from 90 minutes to 1 day.');

			const backToHours = changeUnit(days.state, enabled, 'hours');
			assertEquals(backToHours.state.usenet.minutes, 120);

			const backToMinutes = changeUnit(backToHours.state, enabled, 'minutes');
			assertEquals(backToMinutes.state.usenet, { minutes: 90, originalMinutes: null });
			assertEquals(backToMinutes.message, null);
		});

		this.test('converts exact values to smaller units without rounding', () => {
			const hours = changeUnit(fields(1440, 20160), enabled, 'hours');
			assertEquals(minutes(hours.state), { usenet: 1440, torrent: 20160 });
			assertEquals(fromMinutes(hours.state.usenet.minutes, 'hours'), 24);
			assertEquals(hours.message, null);

			const mins = changeUnit(hours.state, enabled, 'minutes');
			assertEquals(minutes(mins.state), { usenet: 1440, torrent: 20160 });
			assertEquals(mins.message, null);
		});

		this.test('typing a value replaces the remembered original', () => {
			const days = changeUnit(fields(360, 0), enabled, 'days');
			const typed = enterValue(days.state, 'usenet', 2, 'days');
			assertEquals(typed.usenet, { minutes: 2880, originalMinutes: null });

			const hours = changeUnit(typed, enabled, 'hours');
			assertEquals(hours.state.usenet.minutes, 2880);
			assertEquals(fromMinutes(hours.state.usenet.minutes, 'hours'), 48);
			assertEquals(hours.message, null);
		});

		this.test('typing one field leaves the other field untouched', () => {
			const days = changeUnit(fields(30, 30), enabled, 'days');
			const typed = enterValue(days.state, 'usenet', 3, 'days');
			assertEquals(typed.torrent, { minutes: 1440, originalMinutes: 30 });
		});

		this.test('only names fields that were rounded', () => {
			const days = changeUnit(fields(30, 2880), enabled, 'days');
			assertEquals(minutes(days.state), { usenet: 1440, torrent: 2880 });
			assertEquals(days.message, 'Usenet delay rounded up from 30 minutes to 1 day.');
		});

		this.test('names every rounded field in field order', () => {
			const hours = changeUnit(fields(30, 61), enabled, 'hours');
			assertEquals(minutes(hours.state), { usenet: 60, torrent: 120 });
			assertEquals(
				hours.message,
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
			assertEquals(days.state.usenet, { minutes: 1440, originalMinutes: 30 });
			assertEquals(days.message, null);
		});

		this.test('clearing originals keeps rounded values when switching back', () => {
			const days = changeUnit(fields(360, 30), enabled, 'days');
			const saved = clearOriginals(days.state);
			assertEquals(saved, fields(1440, 1440));

			const hours = changeUnit(saved, enabled, 'hours');
			assertEquals(minutes(hours.state), { usenet: 1440, torrent: 1440 });
			assertEquals(hours.message, null);
		});

		this.test('formats durations with singular and plural labels', () => {
			assertEquals(formatDuration(1, 'days'), '1 day');
			assertEquals(formatDuration(2, 'hours'), '2 hours');
			assertEquals(formatDuration(30, 'minutes'), '30 minutes');
			assertEquals(formatDuration(0, 'days'), '0 days');
		});
	}
}

const test = new DurationTest();
test.runTests();
