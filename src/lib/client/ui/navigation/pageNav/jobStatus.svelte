<script lang="ts">
	import { Loader2, CheckCircle2, XCircle } from 'lucide-svelte';
	import { jobStatus } from '$stores/jobStatus';
	import Card from '$ui/card/Card.svelte';

	function formatDuration(ms: number): string {
		if (ms < 1000) return `${ms}ms`;
		if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
		return `${(ms / 60_000).toFixed(1)}m`;
	}
</script>

<Card padding="sm" flush className="mt-2">
	<div class="flex items-center gap-2.5">
		{#if $jobStatus.state === 'running'}
			<Loader2 size={16} class="flex-shrink-0 animate-spin text-blue-500 dark:text-blue-400" />
			<div class="flex-1">
				<div class="text-xs font-semibold text-neutral-900 dark:text-neutral-50">
					{$jobStatus.displayLabel}
				</div>
			</div>
		{:else if $jobStatus.state === 'completed'}
			{#if $jobStatus.status === 'success' || $jobStatus.status === 'skipped'}
				<CheckCircle2 size={16} class="flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
			{:else}
				<XCircle size={16} class="flex-shrink-0 text-red-600 dark:text-red-400" />
			{/if}
			<div class="flex-1">
				<div class="text-xs font-semibold text-neutral-900 dark:text-neutral-50">
					{$jobStatus.displayLabel}
					{$jobStatus.status === 'success' || $jobStatus.status === 'skipped'
						? 'complete'
						: 'failed'}
				</div>
				<div class="font-mono text-[10px] text-neutral-600 dark:text-neutral-400">
					{formatDuration($jobStatus.durationMs)}
				</div>
			</div>
		{/if}
	</div>
</Card>
