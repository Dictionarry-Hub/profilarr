<script lang="ts">
	export let name: string;
	export let score: number;

	$: scoreClass =
		score > 0 ? 'text-success-icon ' : score < 0 ? 'text-danger-icon ' : 'text-text-muted';

	$: displayScore = score > 0 ? `+${score.toLocaleString()}` : score.toLocaleString();
</script>

<span
	class="inline-flex items-center gap-1.5 rounded-card border border-border bg-surface px-2 py-1 text-xs"
>
	<span class="text-text-muted">{name}</span>
	<span class="font-mono font-medium {scoreClass}">{displayScore}</span>
</span>
