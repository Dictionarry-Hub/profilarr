<script lang="ts">
	/**
	 * Displays a numeric score with optional color coding.
	 * - Positive: green with + prefix (when colored=true)
	 * - Negative: red (when colored=true)
	 * - Zero/neutral: neutral gray
	 */
	export let score: number | null = null;
	export let showSign: boolean = true;
	export let size: 'sm' | 'md' = 'md';
	export let colored: boolean = true;

	$: colorClass =
		score === null
			? 'text-text-subtle'
			: !colored
				? 'text-text '
				: score > 0
					? 'text-success-icon '
					: score < 0
						? 'text-danger-icon '
						: 'text-text-muted';

	$: sizeClass = size === 'sm' ? 'text-xs' : 'text-sm';

	$: displayValue =
		score === null
			? null
			: showSign && score > 0
				? `+${score.toLocaleString()}`
				: score.toLocaleString();
</script>

{#if score !== null}
	<span class="font-mono font-medium {colorClass} {sizeClass}">
		{displayValue}
	</span>
{:else}
	<span class="text-text-subtle {sizeClass}">—</span>
{/if}
