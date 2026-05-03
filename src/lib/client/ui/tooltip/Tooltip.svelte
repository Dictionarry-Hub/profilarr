<script lang="ts">
	import { tick } from 'svelte';

	export let text: string = '';
	export let position: 'top' | 'bottom' | 'left' | 'right' = 'bottom';
	export let align: 'left' | 'middle' | 'right' = 'middle';
	export let fullWidth: boolean = false;
	export let mono: boolean = false;

	const PADDING = 8;

	let visible = false;
	let style = '';
	let wrapperEl: HTMLDivElement;
	let tooltipEl: HTMLDivElement;

	async function show() {
		if (!text || !wrapperEl) return;
		const rect = wrapperEl.getBoundingClientRect();
		const centerX = rect.left + rect.width / 2;

		// Initial position centered on trigger
		if (position === 'top') {
			if (align === 'left') {
				style = `left:${rect.left}px;top:${rect.top}px;transform:translateY(-100%) translateY(-8px)`;
			} else if (align === 'right') {
				style = `right:${window.innerWidth - rect.right}px;top:${rect.top}px;transform:translateY(-100%) translateY(-8px)`;
			} else {
				style = `left:${centerX}px;top:${rect.top}px;transform:translate(-50%,-100%) translateY(-8px)`;
			}
		} else if (position === 'right') {
			style = `left:${rect.right}px;top:${rect.top + rect.height / 2}px;transform:translate(8px,-50%)`;
		} else if (position === 'left') {
			style = `right:${window.innerWidth - rect.left + 8}px;top:${rect.top + rect.height / 2}px;transform:translateY(-50%)`;
		} else {
			if (align === 'left') {
				style = `left:${rect.left}px;top:${rect.bottom}px;transform:translateY(8px)`;
			} else if (align === 'right') {
				style = `right:${window.innerWidth - rect.right}px;top:${rect.bottom}px;transform:translateY(8px)`;
			} else {
				style = `left:${centerX}px;top:${rect.bottom}px;transform:translate(-50%,0) translateY(8px)`;
			}
		}
		visible = true;

		// Wait for render, then clamp to viewport
		await tick();
		if (!tooltipEl) return;
		const tip = tooltipEl.getBoundingClientRect();
		const vw = window.innerWidth;
		const vh = window.innerHeight;

		let left: number;
		if (position === 'right') {
			left = rect.right + 8;
			if (left + tip.width > vw - PADDING) left = rect.left - tip.width - 8;
			left = Math.max(PADDING, Math.min(left, vw - tip.width - PADDING));
		} else if (position === 'left') {
			left = rect.left - tip.width - 8;
			if (left < PADDING) left = rect.right + 8;
			left = Math.max(PADDING, Math.min(left, vw - tip.width - PADDING));
		} else {
			if (align === 'left') {
				left = rect.left;
			} else if (align === 'right') {
				left = rect.right - tip.width;
			} else {
				left = centerX - tip.width / 2;
			}
			left = Math.max(PADDING, Math.min(left, vw - tip.width - PADDING));
		}

		let top: number;
		if (position === 'right' || position === 'left') {
			top = rect.top + rect.height / 2 - tip.height / 2;
			top = Math.max(PADDING, Math.min(top, vh - tip.height - PADDING));
		} else if (position === 'top') {
			top = rect.top - tip.height - 8;
			if (top < PADDING) top = rect.bottom + 8;
		} else {
			top = rect.bottom + 8;
			if (top + tip.height > vh - PADDING) top = rect.top - tip.height - 8;
		}

		style = `left:${left}px;top:${top}px;width:${tip.width}px`;
	}

	function hide() {
		visible = false;
	}
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
	class={fullWidth ? 'flex w-full' : 'inline-flex'}
	bind:this={wrapperEl}
	on:mouseenter={show}
	on:mouseleave={hide}
>
	<slot />
	{#if text && visible}
		<div
			bind:this={tooltipEl}
			class="pointer-events-none fixed z-50"
			style="{style};border-radius:0.75rem !important"
		>
			<div
				class="border border-neutral-300 bg-white px-2 py-1 text-xs font-medium whitespace-pre-wrap text-neutral-900 shadow-lg dark:border-neutral-700/60 dark:bg-neutral-800 dark:text-neutral-50 {mono
					? 'font-mono'
					: ''}"
				style="border-radius:0.75rem !important"
			>
				{text}
			</div>
		</div>
	{/if}
</div>
