<script lang="ts">
	import type { Column } from '$lib/client/ui/table/types';
	import Table from '$lib/client/ui/table/Table.svelte';
	import Badge from '$lib/client/ui/badge/Badge.svelte';
	import Toggle from '$lib/client/ui/toggle/Toggle.svelte';
	import { CheckCircle, XCircle, Clock, MinusCircle } from 'lucide-svelte';
	import { parseUTC } from '$shared/utils/dates';

	type JobRun = {
		id: number;
		jobName: string;
		displayName?: string;
		status: 'success' | 'failure' | 'skipped' | 'cancelled';
		startedAt: string;
		finishedAt: string;
		durationMs: number;
		error: string | null;
		output: string | null;
	};

	export let jobRuns: JobRun[];

	// Filter state - hide skipped by default
	let showSkipped = false;

	// Filtered runs based on toggle
	$: filteredRuns = showSkipped ? jobRuns : jobRuns.filter((run) => run.status !== 'skipped');

	// Count of hidden skipped runs
	$: skippedCount = jobRuns.filter((run) => run.status === 'skipped').length;

	const columns: Column<JobRun>[] = [
		{ key: 'jobName', header: 'Job', sortable: true },
		{ key: 'status', header: 'Status', sortable: true, width: 'w-28' },
		{ key: 'startedAt', header: 'Started', sortable: true },
		{ key: 'durationMs', header: 'Duration', sortable: true, width: 'w-28' },
		{ key: 'output', header: 'Output' }
	];

	// Format duration in ms to human readable
	function formatDuration(ms: number): string {
		if (ms < 1000) return `${ms}ms`;
		if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
		return `${(ms / 60000).toFixed(1)}m`;
	}

	// Format job name: arr.sync -> Arr Sync
	function formatJobName(name: string): string {
		return name
			.replace(/\./g, ' ')
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	// Get relative time (e.g., "5m ago", "2h ago")
	function getRelativeTime(dateStr: string): string {
		const date = parseUTC(dateStr);
		if (!date) return '-';

		const now = new Date();
		const diff = now.getTime() - date.getTime();

		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) return `${days}d ago`;
		if (hours > 0) return `${hours}h ago`;
		if (minutes > 0) return `${minutes}m ago`;
		return `${seconds}s ago`;
	}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2">
			<Clock size={18} class="text-neutral-600 dark:text-neutral-400" />
			<h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Recent Job Runs</h2>
		</div>

		{#if skippedCount > 0}
			<div class="flex items-center gap-2">
				<span class="text-sm text-neutral-500 dark:text-neutral-400">
					{skippedCount} skipped
				</span>
				<Toggle bind:checked={showSkipped} label="Show skipped runs" />
			</div>
		{/if}
	</div>

	<Table {columns} data={filteredRuns} emptyMessage="No job runs yet" compact responsive>
		<svelte:fragment slot="cell" let:row let:column>
			{#if column.key === 'jobName'}
				<span class="text-xs font-medium">{row.displayName ?? formatJobName(row.jobName)}</span>
			{:else if column.key === 'status'}
				{#if row.status === 'success'}
					<Badge variant="success" icon={CheckCircle}>Success</Badge>
				{:else if row.status === 'skipped'}
					<Badge variant="neutral" icon={MinusCircle}>Skipped</Badge>
				{:else if row.status === 'cancelled'}
					<Badge variant="neutral" icon={MinusCircle}>Cancelled</Badge>
				{:else}
					<Badge variant="danger" icon={XCircle}>Failed</Badge>
				{/if}
			{:else if column.key === 'startedAt'}
				<Badge variant="neutral" mono>{getRelativeTime(row.startedAt)}</Badge>
			{:else if column.key === 'durationMs'}
				<Badge variant="neutral" mono>{formatDuration(row.durationMs)}</Badge>
			{:else if column.key === 'output'}
				{#if row.error}
					<span class="line-clamp-1 font-mono text-xs text-red-600 dark:text-red-400"
						>{row.error}</span
					>
				{:else if row.output}
					<span class="line-clamp-1 font-mono text-xs text-neutral-600 dark:text-neutral-400"
						>{row.output}</span
					>
				{:else}
					<span class="text-neutral-400 dark:text-neutral-600">-</span>
				{/if}
			{/if}
		</svelte:fragment>
	</Table>
</div>
