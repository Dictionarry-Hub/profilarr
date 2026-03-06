<script lang="ts">
	import { Cron } from 'croner';
	import DropdownSelect from '$ui/dropdown/DropdownSelect.svelte';
	import FormInput from '$ui/form/FormInput.svelte';
	import NumberInput from '$ui/form/NumberInput.svelte';
	import TimeInput from '$ui/form/TimeInput.svelte';

	export let value: string = '0 * * * *';
	export let disabled: boolean = false;
	export let minIntervalMinutes: number = 0;
	export let onWarning: ((message: string) => void) | undefined = undefined;

	type ScheduleType = 'every' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';

	let scheduleType: ScheduleType = 'hourly';
	let intervalMinutes = 30;
	let hourlyMinute = 0;
	let dailyTime = '03:00';
	let weeklyDay = 1;
	let weeklyTime = '03:00';
	let monthlyDay = 1;
	let monthlyTime = '03:00';
	let customCron = value;

	let lastParsedValue = '';
	let cronError: string | null = null;

	const dayOptions = [
		{ value: 0, label: 'Sun' },
		{ value: 1, label: 'Mon' },
		{ value: 2, label: 'Tue' },
		{ value: 3, label: 'Wed' },
		{ value: 4, label: 'Thu' },
		{ value: 5, label: 'Fri' },
		{ value: 6, label: 'Sat' }
	];

	const scheduleOptions: { value: ScheduleType; label: string }[] = [
		{ value: 'every', label: 'Every' },
		{ value: 'hourly', label: 'Hourly' },
		{ value: 'daily', label: 'Daily' },
		{ value: 'weekly', label: 'Weekly' },
		{ value: 'monthly', label: 'Monthly' },
		{ value: 'custom', label: 'Custom' }
	];

	const weekdayOptions = dayOptions.map((day) => ({
		value: String(day.value),
		label: day.label
	}));

	function parseTime(value: string): { hour: number; minute: number } {
		const [h, m] = value.split(':').map((part) => parseInt(part, 10));
		return {
			hour: Number.isFinite(h) ? Math.min(Math.max(h, 0), 23) : 0,
			minute: Number.isFinite(m) ? Math.min(Math.max(m, 0), 59) : 0
		};
	}

	function formatTime(hour: number, minute: number): string {
		const h = String(Math.min(Math.max(hour, 0), 23)).padStart(2, '0');
		const m = String(Math.min(Math.max(minute, 0), 59)).padStart(2, '0');
		return `${h}:${m}`;
	}

	function buildCronFromSimple(): string {
		if (scheduleType === 'every') {
			const interval = Math.max(1, Math.min(intervalMinutes, 60));
			return `*/${interval} * * * *`;
		}

		if (scheduleType === 'hourly') {
			const minute = Math.max(0, Math.min(hourlyMinute, 59));
			return `${minute} * * * *`;
		}

		if (scheduleType === 'daily') {
			const { hour, minute } = parseTime(dailyTime);
			return `${minute} ${hour} * * *`;
		}

		if (scheduleType === 'weekly') {
			const { hour, minute } = parseTime(weeklyTime);
			return `${minute} ${hour} * * ${weeklyDay}`;
		}

		const { hour, minute } = parseTime(monthlyTime);
		const day = Math.max(1, Math.min(monthlyDay, 31));
		return `${minute} ${hour} ${day} * *`;
	}

	function parseSimple(cron: string): boolean {
		const parts = cron.trim().split(/\s+/);
		if (parts.length === 6) parts.shift();
		if (parts.length !== 5) return false;

		const [minute, hour, dom, month, dow] = parts;
		if (month !== '*') return false;

		if (dom === '*' && dow === '*') {
			if (hour === '*' && minute.startsWith('*/')) {
				const interval = parseInt(minute.slice(2), 10);
				if (!Number.isFinite(interval) || interval <= 0) return false;
				scheduleType = 'every';
				intervalMinutes = interval;
				return true;
			}
			if (hour === '*' && /^\d+$/.test(minute)) {
				scheduleType = 'hourly';
				hourlyMinute = parseInt(minute, 10);
				return true;
			}
			if (/^\d+$/.test(minute) && /^\d+$/.test(hour)) {
				scheduleType = 'daily';
				dailyTime = formatTime(parseInt(hour, 10), parseInt(minute, 10));
				return true;
			}
		}

		if (dom === '*' && dow !== '*') {
			if (!/^\d+$/.test(minute) || !/^\d+$/.test(hour)) return false;
			const days = dow
				.split(',')
				.map((part) => parseInt(part, 10))
				.filter((day) => Number.isFinite(day) && day >= 0 && day <= 6);
			if (days.length !== 1) return false;
			scheduleType = 'weekly';
			weeklyDay = days[0];
			weeklyTime = formatTime(parseInt(hour, 10), parseInt(minute, 10));
			return true;
		}

		if (dow === '*' && dom !== '*') {
			if (!/^\d+$/.test(minute) || !/^\d+$/.test(hour) || !/^\d+$/.test(dom)) return false;
			scheduleType = 'monthly';
			monthlyTime = formatTime(parseInt(hour, 10), parseInt(minute, 10));
			monthlyDay = parseInt(dom, 10);
			return true;
		}

		return false;
	}

	function validateMinInterval(expr: string): string | null {
		if (minIntervalMinutes <= 0) return null;
		try {
			const cron = new Cron(expr);
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
					return `Minimum interval is ${minIntervalMinutes} minutes`;
				}
			}
			return null;
		} catch {
			return null;
		}
	}

	function setValue(nextValue: string) {
		if (nextValue === value) return;
		value = nextValue;
		lastParsedValue = nextValue;
	}

	function syncFromValue() {
		if (value === lastParsedValue) return;
		if (parseSimple(value)) {
			customCron = value;
			lastParsedValue = value;
			return;
		}
		scheduleType = 'custom';
		customCron = value;
		lastParsedValue = value;
	}

	function updateCron() {
		if (scheduleType === 'custom') {
			setValue(customCron);
			return;
		}
		setValue(buildCronFromSimple());
	}

	function onCustomInput(nextValue: string) {
		customCron = nextValue.trim();
		updateCron();
	}

	function selectScheduleType(next: ScheduleType) {
		scheduleType = next;
		if (scheduleType === 'custom') {
			customCron = value;
			return;
		}
		updateCron();
	}

	$: if (value !== lastParsedValue) {
		syncFromValue();
	}

	$: if (scheduleType !== 'custom') {
		updateCron();
	}

	$: cronError = (() => {
		if (scheduleType === 'custom') {
			try {
				new Cron(customCron);
			} catch (error) {
				return error instanceof Error ? error.message : 'Invalid cron expression';
			}
			return validateMinInterval(value);
		}
		if (scheduleType === 'every') {
			if (minIntervalMinutes <= 0) return null;
			if (intervalMinutes < minIntervalMinutes) {
				return `Minimum interval is ${minIntervalMinutes} minutes`;
			}
			return null;
		}
		// hourly, daily, weekly, monthly — always well above any minimum
		return null;
	})();

	$: everyMin = minIntervalMinutes > 0 ? Math.max(1, minIntervalMinutes) : 1;

	$: if (scheduleType === 'every' && intervalMinutes < everyMin) {
		intervalMinutes = everyMin;
		updateCron();
	}
</script>

<div class="flex items-center gap-1.5" class:flex-wrap={scheduleType === 'monthly'}>
	<DropdownSelect
		value={scheduleType}
		options={scheduleOptions}
		{disabled}
		buttonSize="sm"
		width="w-24"
		justify="center"
		on:change={(event) => selectScheduleType(event.detail as ScheduleType)}
	/>

	{#if scheduleType === 'every'}
		<div class="w-24">
			<NumberInput
				name="cron-interval-minutes"
				value={intervalMinutes}
				min={everyMin}
				max={60}
				step={1}
				{disabled}
				onMinBlocked={() => onWarning?.(`Minimum interval is ${everyMin} minutes`)}
				onMaxBlocked={() => onWarning?.('Maximum interval is 60 minutes')}
				on:change={(event) => {
					const next = event.detail;
					if (next !== undefined) {
						intervalMinutes = next;
						updateCron();
					}
				}}
			/>
		</div>
		<span class="text-sm text-neutral-500 dark:text-neutral-400">minutes</span>
	{:else if scheduleType === 'hourly'}
		<span class="text-sm text-neutral-500 dark:text-neutral-400">at</span>
		<div class="w-24">
			<NumberInput
				name="cron-hourly-minute"
				value={hourlyMinute}
				min={0}
				max={59}
				step={1}
				{disabled}
				on:change={(event) => {
					const next = event.detail;
					if (next !== undefined) {
						hourlyMinute = next;
						updateCron();
					}
				}}
			/>
		</div>
		<span class="text-sm text-neutral-500 dark:text-neutral-400">min</span>
	{:else if scheduleType === 'daily'}
		<TimeInput
			label="Time"
			hideLabel
			name="cron-daily-time"
			fieldWidthRem={5}
			value={dailyTime}
			{disabled}
			on:input={(event) => {
				dailyTime = event.detail;
				updateCron();
			}}
		/>
	{:else if scheduleType === 'weekly'}
		<DropdownSelect
			value={String(weeklyDay)}
			options={weekdayOptions}
			{disabled}
			buttonSize="sm"
			width="w-20"
			justify="center"
			on:change={(event) => {
				weeklyDay = Number(event.detail);
				updateCron();
			}}
		/>
		<TimeInput
			label="Time"
			hideLabel
			name="cron-weekly-time"
			fieldWidthRem={5}
			value={weeklyTime}
			{disabled}
			on:input={(event) => {
				weeklyTime = event.detail;
				updateCron();
			}}
		/>
	{:else if scheduleType === 'monthly'}
		<div class="basis-full"></div>
		<span class="text-sm text-neutral-500 dark:text-neutral-400">day</span>
		<div class="w-24">
			<NumberInput
				name="cron-monthly-day"
				value={monthlyDay}
				min={1}
				max={31}
				step={1}
				{disabled}
				on:change={(event) => {
					const next = event.detail;
					if (next !== undefined) {
						monthlyDay = next;
						updateCron();
					}
				}}
			/>
		</div>
		<TimeInput
			label="Time"
			hideLabel
			name="cron-monthly-time"
			fieldWidthRem={5}
			value={monthlyTime}
			{disabled}
			on:input={(event) => {
				monthlyTime = event.detail;
				updateCron();
			}}
		/>
	{:else}
		<div class="w-56">
			<FormInput
				label="Custom cron"
				hideLabel
				name="cron-custom"
				value={customCron}
				placeholder="0 * * * *"
				mono
				{disabled}
				inputClass={cronError ? 'border-red-500 focus:border-red-500' : ''}
				on:input={(event) => onCustomInput(event.detail)}
			/>
		</div>
	{/if}
	{#if cronError && scheduleType !== 'custom'}
		<span class="text-xs text-red-500">{cronError}</span>
	{/if}
</div>
