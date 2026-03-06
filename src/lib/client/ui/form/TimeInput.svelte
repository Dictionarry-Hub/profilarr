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
	export let fieldWidthRem: number = 5;

	const dispatch = createEventDispatcher<{ input: string }>();

	let hour = '00';
	let minute = '00';
	let lastValue = '';

	const hourOptions = Array.from({ length: 24 }, (_, idx) => {
		const value = String(idx).padStart(2, '0');
		return { value, label: value };
	});
	const minuteOptions = Array.from({ length: 60 }, (_, idx) => {
		const value = String(idx).padStart(2, '0');
		return { value, label: value };
	});

	$: containerClass = hideLabel && !description ? 'space-y-0' : 'space-y-2';
	$: fieldStyle = `width: ${fieldWidthRem}rem;`;

	function parseValue(nextValue: string) {
		const [h, m] = nextValue.split(':');
		if (h && m && /^\d+$/.test(h) && /^\d+$/.test(m)) {
			hour = String(Math.min(Math.max(parseInt(h, 10), 0), 23)).padStart(2, '0');
			minute = String(Math.min(Math.max(parseInt(m, 10), 0), 59)).padStart(2, '0');
			return;
		}
		hour = '00';
		minute = '00';
	}

	function updateValue(nextHour: string, nextMinute: string) {
		const next = `${nextHour}:${nextMinute}`;
		if (next === value) {
			lastValue = next;
			return;
		}
		value = next;
		lastValue = next;
		dispatch('input', next);
	}

	function onHourChange(nextHour: string) {
		hour = nextHour;
		updateValue(hour, minute);
	}

	function onMinuteChange(nextMinute: string) {
		minute = nextMinute;
		updateValue(hour, minute);
	}

	$: if (value !== lastValue) {
		parseValue(value);
		lastValue = value;
	}
</script>

<div class={`${containerClass} inline-flex flex-col`}>
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

	<div class="flex items-center gap-1.5">
		<div class="shrink-0" style={fieldStyle}>
			<SearchDropdown
				value={hour}
				options={hourOptions}
				label="Hour"
				hideLabel
				name={`${name}-hour`}
				{size}
				disabled={disabled || readonly}
				fullWidth
				on:change={(event) => onHourChange(event.detail)}
			/>
		</div>
		<span class="text-sm text-neutral-500 dark:text-neutral-400">:</span>
		<div class="shrink-0" style={fieldStyle}>
			<SearchDropdown
				value={minute}
				options={minuteOptions}
				label="Minute"
				hideLabel
				name={`${name}-minute`}
				{size}
				disabled={disabled || readonly}
				fullWidth
				on:change={(event) => onMinuteChange(event.detail)}
			/>
		</div>
	</div>
</div>
