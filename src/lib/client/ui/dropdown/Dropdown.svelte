<script lang="ts">
	import { onMount } from 'svelte';

	export let position: 'left' | 'right' | 'middle' = 'left';
	export let mobilePosition: 'left' | 'right' | 'middle' | null = null;
	export let minWidth: string = '12rem';
	export let compact: boolean = false;
	// Fixed positioning to escape overflow containers
	export let fixed: boolean = false;
	export let triggerEl: HTMLElement | null = null;

	let dropdownEl: HTMLElement;
	let fixedStyle = '';

	const positionClasses = {
		left: 'left-0',
		right: 'right-0',
		middle: 'left-1/2 -translate-x-1/2'
	};

	const responsivePositionClasses: Record<string, string> = {
		'middle-to-right': 'left-1/2 -translate-x-1/2 md:left-auto md:right-0 md:translate-x-0',
		'middle-to-left': 'left-1/2 -translate-x-1/2 md:left-0 md:translate-x-0',
		'left-to-right': 'left-0 md:left-auto md:right-0',
		'right-to-left': 'right-0 md:right-auto md:left-0'
	};

	$: positionClass = fixed
		? ''
		: mobilePosition && mobilePosition !== position
			? responsivePositionClasses[`${mobilePosition}-to-${position}`] || positionClasses[position]
			: positionClasses[position];

	$: marginClass = compact ? 'mt-1' : 'mt-3';
	$: gap = compact ? 4 : 12; // pixels gap below trigger
	$: roundedClass = compact ? 'rounded-lg' : 'rounded-xl';

	function updateFixedPosition() {
		if (!fixed || !triggerEl) return;

		const rect = triggerEl.getBoundingClientRect();
		let left = rect.left;

		if (position === 'right') {
			left = rect.right;
			// Adjust to align right edge
			if (dropdownEl) {
				left = rect.right - dropdownEl.offsetWidth;
			}
		} else if (position === 'middle') {
			left = rect.left + rect.width / 2;
			if (dropdownEl) {
				left -= dropdownEl.offsetWidth / 2;
			}
		}

		fixedStyle = `top: ${rect.bottom + gap}px; left: ${left}px;`;
	}

	onMount(() => {
		if (fixed && triggerEl) {
			updateFixedPosition();
			window.addEventListener('scroll', updateFixedPosition, true);
			window.addEventListener('resize', updateFixedPosition);
			return () => {
				window.removeEventListener('scroll', updateFixedPosition, true);
				window.removeEventListener('resize', updateFixedPosition);
			};
		}
		return;
	});

	$: if (fixed && triggerEl && dropdownEl) {
		updateFixedPosition();
	}
</script>

<!-- Invisible hover bridge to keep dropdown open when moving mouse down -->
{#if !fixed}
	<div class="absolute top-full z-40 h-3 w-full"></div>
{/if}

<div
	bind:this={dropdownEl}
	class="z-50 overflow-hidden border border-neutral-300 bg-white shadow-lg dark:border-neutral-700/60 dark:bg-neutral-800 {roundedClass} {fixed
		? 'fixed'
		: 'absolute top-full ' + marginClass} {positionClass}"
	style="min-width: {minWidth}; {fixed ? fixedStyle : ''}"
>
	<slot />
</div>
