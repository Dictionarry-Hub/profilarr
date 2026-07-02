<script context="module" lang="ts">
	export type MarkerColor = 'accent' | 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'neutral';

	export interface Marker {
		id: string;
		label: string;
		color: MarkerColor;
		value: number;
	}
</script>

<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	// Props
	export let orientation: 'horizontal' | 'vertical' = 'horizontal';
	export let direction: 'start' | 'end' = 'start'; // start = min at left/top
	export let min: number = 0;
	export let max: number = 100;
	export let step: number = 1;
	export let minSeparation: number = 20; // minimum px between markers
	export let markers: Marker[] = [];
	export let unit: string = ''; // optional unit suffix for badge display
	export let unlimitedValue: number | null = null; // value that should display as "Unlimited"
	export let displayTransform: ((value: number) => number) | null = null; // optional transform for display values
	export let disabled: boolean = false;

	const dispatch = createEventDispatcher();

	// Track container and dragging state
	let container: HTMLDivElement;
	let draggingIndex: number | null = null;

	// Color classes for markers
	const colorClasses: Record<MarkerColor, { dot: string; badge: string }> = {
		accent: {
			dot: 'bg-accent-solid',
			badge: 'bg-surface-hover text-accent-solid'
		},
		blue: {
			dot: 'bg-info-bg',
			badge: 'bg-info-bg text-info-text'
		},
		green: {
			dot: 'bg-success-bg',
			badge: 'bg-success-bg text-success-text'
		},
		orange: {
			dot: 'bg-warning-bg',
			badge: 'bg-warning-bg text-warning-text'
		},
		red: {
			dot: 'bg-danger-bg',
			badge: 'bg-danger-bg text-danger-text'
		},
		purple: {
			dot: 'bg-accent-solid',
			badge: 'bg-surface-hover text-accent-solid'
		},
		neutral: {
			dot: 'bg-surface-hover',
			badge: 'bg-surface-hover text-text-soft'
		}
	};

	// Convert value to position percentage
	function valueToPercent(value: number): number {
		const percent = ((value - min) / (max - min)) * 100;
		return direction === 'start' ? percent : 100 - percent;
	}

	// Convert position to value
	function positionToValue(position: number, containerSize: number): number {
		let percent = (position / containerSize) * 100;
		if (direction === 'end') {
			percent = 100 - percent;
		}
		const rawValue = min + (percent / 100) * (max - min);
		// Round to step
		const stepped = Math.round(rawValue / step) * step;
		// Clamp to min/max
		return Math.max(min, Math.min(max, stepped));
	}

	// Get container size based on orientation
	function getContainerSize(): number {
		if (!container) return 0;
		return orientation === 'horizontal' ? container.offsetWidth : container.offsetHeight;
	}

	// Calculate min/max allowed value for a marker based on neighbors and minSeparation
	function getMarkerBounds(index: number): { minVal: number; maxVal: number } {
		const containerSize = getContainerSize();
		const range = max - min;
		// Convert minSeparation pixels to value units
		const separationValue = containerSize > 0 ? (minSeparation / containerSize) * range : 0;

		let minVal = min;
		let maxVal = max;

		// Constrain by previous marker
		if (index > 0) {
			minVal = markers[index - 1].value + separationValue;
		}

		// Constrain by next marker
		if (index < markers.length - 1) {
			maxVal = markers[index + 1].value - separationValue;
		}

		return { minVal, maxVal };
	}

	// Handle drag start
	function handleDragStart(index: number, event: MouseEvent | TouchEvent) {
		if (disabled) return;
		event.preventDefault();
		draggingIndex = index;

		const moveHandler = (e: MouseEvent | TouchEvent) => handleDragMove(e);
		const upHandler = () => {
			draggingIndex = null;
			window.removeEventListener('mousemove', moveHandler);
			window.removeEventListener('mouseup', upHandler);
			window.removeEventListener('touchmove', moveHandler);
			window.removeEventListener('touchend', upHandler);
		};

		window.addEventListener('mousemove', moveHandler);
		window.addEventListener('mouseup', upHandler);
		window.addEventListener('touchmove', moveHandler);
		window.addEventListener('touchend', upHandler);
	}

	// Handle drag move
	function handleDragMove(event: MouseEvent | TouchEvent) {
		if (disabled) return;
		if (draggingIndex === null || !container) return;

		const rect = container.getBoundingClientRect();
		const clientPos = 'touches' in event ? event.touches[0] : event;

		let position: number;
		if (orientation === 'horizontal') {
			position = clientPos.clientX - rect.left;
		} else {
			position = clientPos.clientY - rect.top;
		}

		const containerSize = getContainerSize();
		position = Math.max(0, Math.min(containerSize, position));

		let newValue = positionToValue(position, containerSize);

		// Apply ordering constraints
		const bounds = getMarkerBounds(draggingIndex);
		newValue = Math.max(bounds.minVal, Math.min(bounds.maxVal, newValue));

		// Round to step again after constraints
		newValue = Math.round(newValue / step) * step;

		// Update the marker value
		if (markers[draggingIndex].value !== newValue) {
			markers[draggingIndex].value = newValue;
			markers = markers; // trigger reactivity
			dispatch('change', { index: draggingIndex, value: newValue, markers });
		}
	}

	// Reactive: ensure markers stay within bounds when values change externally
	$: {
		let needsUpdate = false;
		const updatedMarkers = markers.map((marker, index) => {
			const bounds = getMarkerBounds(index);
			let value = marker.value;

			// Clamp to scale bounds
			value = Math.max(min, Math.min(max, value));

			// Note: We don't enforce neighbor constraints here to allow external updates
			// The constraints are only enforced during drag

			if (value !== marker.value) {
				needsUpdate = true;
				return { ...marker, value };
			}
			return marker;
		});

		if (needsUpdate) {
			markers = updatedMarkers;
		}
	}
</script>

<div
	class="relative select-none"
	class:w-full={orientation === 'horizontal'}
	class:h-full={orientation === 'vertical'}
	class:opacity-50={disabled}
>
	<!-- Track container -->
	<div
		bind:this={container}
		class="relative"
		class:h-2={orientation === 'horizontal'}
		class:w-2={orientation === 'vertical'}
		class:w-full={orientation === 'horizontal'}
		class:h-full={orientation === 'vertical'}
	>
		<!-- Track line -->
		<div
			class="absolute rounded-pill bg-surface-hover {orientation === 'horizontal'
				? 'top-1/2 h-1 w-full -translate-y-1/2'
				: 'left-1/2 h-full w-1 -translate-x-1/2'}"
		></div>

		<!-- Markers -->
		{#each markers as marker, index}
			{@const percent = valueToPercent(marker.value)}
			{@const colors = colorClasses[marker.color]}
			<div
				class="absolute {orientation === 'horizontal'
					? 'top-1/2 -translate-y-1/2'
					: 'left-1/2 -translate-x-1/2'}"
				style="{orientation === 'horizontal' ? 'left' : 'top'}: {percent}%;"
			>
				<!-- Dot -->
				<button
					type="button"
					{disabled}
					on:mousedown={(e) => handleDragStart(index, e)}
					on:touchstart={(e) => handleDragStart(index, e)}
					class="relative h-4 w-4 -translate-x-1/2 rounded-pill shadow-card transition-transform disabled:cursor-not-allowed {disabled
						? ''
						: 'cursor-grab hover:scale-125'} {colors.dot} {orientation === 'vertical'
						? '-translate-y-1/2'
						: ''} {draggingIndex === index && !disabled ? 'scale-150 cursor-grabbing' : ''}"
					aria-label="Drag to adjust {marker.label}"
				></button>

				<!-- Badge label (alternate above/below) -->
				<div
					class="absolute whitespace-nowrap {orientation === 'horizontal'
						? `left-0 -translate-x-1/2 ${index % 2 === 0 ? 'top-6' : 'bottom-6'}`
						: 'left-6 translate-x-0'}"
				>
					<span
						class="inline-block rounded-control-sm px-1.5 py-0.5 text-xs font-medium {colors.badge}"
					>
						{marker.label}: {unlimitedValue !== null && marker.value >= unlimitedValue
							? 'Unlimited'
							: `${displayTransform ? displayTransform(marker.value).toFixed(1) : Math.round(marker.value)}${unit ? ` ${unit}` : ''}`}
					</span>
				</div>
			</div>
		{/each}
	</div>
</div>
