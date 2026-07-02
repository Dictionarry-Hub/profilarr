<script lang="ts">
	import { Check } from 'lucide-svelte';
	import Tooltip from '$ui/tooltip/Tooltip.svelte';

	export let current: number = 0;
	export let target: number = 0;
	export let met: boolean = false;
	export let mode: 'compact' | 'inline' = 'compact';
	/**
	 * How the bar's color is derived.
	 * - `threshold` (default): red <50%, yellow 50-74%, green 75%+. Suited
	 * for "good enough" semantics like CF score.
	 * - `completion`: green when met, yellow otherwise (regardless of how
	 * close to met). Suited for "anything less than 100% is a problem"
	 * semantics like drift.
	 */
	export let colorMode: 'threshold' | 'completion' = 'threshold';
	/**
	 * Optional tooltip text shown on hover. When set, the indicator is
	 * wrapped in a Tooltip; when empty/undefined, no tooltip is rendered.
	 */
	export let tooltip: string = '';
	export let tooltipPosition: 'top' | 'bottom' | 'left' | 'right' = 'bottom';
	export let tooltipAlign: 'left' | 'middle' | 'right' = 'middle';

	$: progress = target > 0 ? Math.max(0, Math.min(current / target, 1)) : 0;
	$: progressPercent = Math.round(progress * 100);

	function getBarColor(p: number, done: boolean, mode: 'threshold' | 'completion'): string {
		if (done) return 'bg-success-bg';
		if (mode === 'completion') return 'bg-warning-bg ';
		if (p >= 0.75) return 'bg-success-bg';
		if (p >= 0.5) return 'bg-warning-bg';
		return 'bg-danger-bg';
	}

	$: barColor = getBarColor(progress, met, colorMode);
</script>

{#if tooltip}
	<Tooltip
		text={tooltip}
		position={tooltipPosition}
		align={tooltipAlign}
		fullWidth={mode === 'compact'}
	>
		{#if mode === 'compact'}
			<!-- Card view: vertical stack -->
			<div class="flex w-full flex-col gap-1">
				<div class="flex items-center justify-between gap-2">
					<span class="font-mono text-xs text-text-soft">
						{current.toLocaleString()}
						<span class="text-text-subtle">
							/ {target.toLocaleString()}
						</span>
					</span>
					{#if met}
						<Check size={14} class="flex-shrink-0 text-success-icon" />
					{:else}
						<span class="font-mono text-xs text-text-subtle">
							{progressPercent}%
						</span>
					{/if}
				</div>
				<div class="h-1.5 w-full overflow-hidden rounded-pill bg-surface-hover">
					<div
						class="h-full rounded-pill transition-all {barColor}"
						style="width: {progressPercent}%"
					></div>
				</div>
			</div>
		{:else}
			<!-- Table view: horizontal inline -->
			<div class="flex items-center gap-2 whitespace-nowrap">
				<div class="h-1.5 w-12 flex-shrink-0 overflow-hidden rounded-pill bg-surface-hover">
					<div
						class="h-full rounded-pill transition-all {barColor}"
						style="width: {progressPercent}%"
					></div>
				</div>
				<span class="font-mono text-xs text-text-muted">
					{current.toLocaleString()} / {target.toLocaleString()}
				</span>
				{#if met}
					<Check size={12} class="flex-shrink-0 text-success-icon" />
				{/if}
			</div>
		{/if}
	</Tooltip>
{:else if mode === 'compact'}
	<!-- Card view: vertical stack -->
	<div class="flex flex-col gap-1">
		<div class="flex items-center justify-between gap-2">
			<span class="font-mono text-xs text-text-soft">
				{current.toLocaleString()}
				<span class="text-text-subtle">/ {target.toLocaleString()}</span>
			</span>
			{#if met}
				<Check size={14} class="flex-shrink-0 text-success-icon" />
			{:else}
				<span class="font-mono text-xs text-text-subtle">
					{progressPercent}%
				</span>
			{/if}
		</div>
		<div class="h-1.5 w-full overflow-hidden rounded-pill bg-surface-hover">
			<div
				class="h-full rounded-pill transition-all {barColor}"
				style="width: {progressPercent}%"
			></div>
		</div>
	</div>
{:else}
	<!-- Table view: horizontal inline -->
	<div class="flex items-center gap-2 whitespace-nowrap">
		<div class="h-1.5 w-12 flex-shrink-0 overflow-hidden rounded-pill bg-surface-hover">
			<div
				class="h-full rounded-pill transition-all {barColor}"
				style="width: {progressPercent}%"
			></div>
		</div>
		<span class="font-mono text-xs text-text-muted">
			{current.toLocaleString()} / {target.toLocaleString()}
		</span>
		{#if met}
			<Check size={12} class="flex-shrink-0 text-success-icon" />
		{/if}
	</div>
{/if}
