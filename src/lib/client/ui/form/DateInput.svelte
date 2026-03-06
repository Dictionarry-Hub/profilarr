<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import SearchDropdown from '$ui/form/SearchDropdown.svelte';

	export let label: string;
	export let description: string = '';
	export let value: string = '';
	export let required: boolean = false;
	export let hideLabel: boolean = false;
	export let name: string = '';
	export let readonly: boolean = false;
	export let disabled: boolean = false;
	export let size: 'sm' | 'md' | 'lg' = 'md';
	export let minYear: number | undefined = undefined;
	export let maxYear: number | undefined = undefined;

	const dispatch = createEventDispatcher<{ input: string; change: string }>();

	const now = new Date();
	const currentYear = now.getFullYear();
	const defaultMinYear = currentYear - 10;
	const defaultMaxYear = currentYear + 10;

	let year = String(currentYear);
	let month = String(now.getMonth() + 1).padStart(2, '0');
	let day = String(now.getDate()).padStart(2, '0');
	let lastValue = '';

	const monthOptions = [
		{ value: '01', label: 'Jan' },
		{ value: '02', label: 'Feb' },
		{ value: '03', label: 'Mar' },
		{ value: '04', label: 'Apr' },
		{ value: '05', label: 'May' },
		{ value: '06', label: 'Jun' },
		{ value: '07', label: 'Jul' },
		{ value: '08', label: 'Aug' },
		{ value: '09', label: 'Sep' },
		{ value: '10', label: 'Oct' },
		{ value: '11', label: 'Nov' },
		{ value: '12', label: 'Dec' }
	];

	$: effectiveMinYear = Math.min(minYear ?? defaultMinYear, maxYear ?? defaultMaxYear);
	$: effectiveMaxYear = Math.max(maxYear ?? defaultMaxYear, minYear ?? defaultMinYear);
	$: yearOptions = Array.from({ length: effectiveMaxYear - effectiveMinYear + 1 }, (_, idx) => {
		const nextYear = effectiveMinYear + idx;
		return { value: String(nextYear), label: String(nextYear) };
	});

	function daysInMonth(yearNumber: number, monthNumber: number): number {
		if (!Number.isFinite(yearNumber) || !Number.isFinite(monthNumber)) return 31;
		return new Date(yearNumber, monthNumber, 0).getDate();
	}

	$: maxDay = daysInMonth(Number(year), Number(month));
	$: dayOptions = Array.from({ length: maxDay }, (_, idx) => {
		const value = String(idx + 1).padStart(2, '0');
		return { value, label: value };
	});

	$: containerClass = hideLabel && !description ? 'space-y-0' : 'space-y-2';
	$: effectiveDisabled = disabled || readonly;

	function parseValue(nextValue: string) {
		if (/^\d{4}-\d{2}-\d{2}$/.test(nextValue)) {
			const [nextYear, nextMonth, nextDay] = nextValue.split('-');
			year = nextYear;
			month = nextMonth;
			day = nextDay;
			return;
		}
		year = String(currentYear);
		month = String(now.getMonth() + 1).padStart(2, '0');
		day = String(now.getDate()).padStart(2, '0');
	}

	function updateValue(nextYear = year, nextMonth = month, nextDay = day) {
		const maxForMonth = daysInMonth(Number(nextYear), Number(nextMonth));
		const safeDay = Math.min(Math.max(parseInt(nextDay, 10), 1), maxForMonth);
		const safeDayValue = String(safeDay).padStart(2, '0');

		year = nextYear;
		month = nextMonth;
		day = safeDayValue;

		const nextValue = `${year}-${month}-${day}`;
		if (nextValue === value) {
			lastValue = nextValue;
			return;
		}
		value = nextValue;
		lastValue = nextValue;
		dispatch('input', nextValue);
		dispatch('change', nextValue);
	}

	function onYearChange(nextYear: string) {
		updateValue(nextYear, month, day);
	}

	function onMonthChange(nextMonth: string) {
		updateValue(year, nextMonth, day);
	}

	function onDayChange(nextDay: string) {
		updateValue(year, month, nextDay);
	}

	$: if (value !== lastValue) {
		parseValue(value);
		lastValue = value;
	}

	$: if (value === '' && lastValue === '') {
		updateValue(year, month, day);
	}
</script>

<div class={containerClass}>
	{#if !hideLabel}
		<label for={name} class="block text-sm font-medium text-neutral-900 dark:text-neutral-100">
			{label}{#if required}<span class="text-red-500">*</span>{/if}
		</label>
	{/if}

	{#if description}
		<p class="text-xs text-neutral-600 dark:text-neutral-400">
			{description}
		</p>
	{/if}

	<div class="flex items-center gap-2">
		<SearchDropdown
			value={month}
			options={monthOptions}
			label="Month"
			hideLabel
			name={`${name}-month`}
			{size}
			disabled={effectiveDisabled}
			fullWidth={false}
			on:change={(event) => onMonthChange(event.detail)}
		/>
		<SearchDropdown
			value={day}
			options={dayOptions}
			label="Day"
			hideLabel
			name={`${name}-day`}
			{size}
			disabled={effectiveDisabled}
			fullWidth={false}
			on:change={(event) => onDayChange(event.detail)}
		/>
		<SearchDropdown
			value={year}
			options={yearOptions}
			label="Year"
			hideLabel
			name={`${name}-year`}
			{size}
			disabled={effectiveDisabled}
			fullWidth={false}
			on:change={(event) => onYearChange(event.detail)}
		/>
	</div>
</div>
