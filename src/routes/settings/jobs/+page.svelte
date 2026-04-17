<script lang="ts">
	import type { PageData } from './$types';
	import { parseUTC } from '$shared/utils/dates';
	import type { Column } from '$lib/client/ui/table/types';
	import ExpandableTable from '$lib/client/ui/table/ExpandableTable.svelte';
	import Badge from '$lib/client/ui/badge/Badge.svelte';
	import JobHistory from './components/JobHistory.svelte';
	import { CheckCircle, XCircle, AlertCircle, MinusCircle } from 'lucide-svelte';

	export let data: PageData;

	type Job = (typeof data.jobs)[0];

	const columns: Column<Job>[] = [
		{ key: 'name', header: 'Job', sortable: true },
		{ key: 'status', header: 'Status', sortable: true, width: 'w-28' },
		{ key: 'last_run_at', header: 'Last Run', sortable: true },
		{ key: 'next_run_at', header: 'Next Run', sortable: true }
	];

	// Format job name: arr.sync -> Arr Sync
	function formatJobName(name: string): string {
		return name
			.replace(/\./g, ' ')
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	function getJobLabel(job: Job): string {
		return job.displayName ?? formatJobName(job.name);
	}

	// Format duration in ms to human readable
	function formatDuration(ms: number | null): string {
		if (!ms) return '-';
		if (ms < 1000) return `${ms}ms`;
		if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
		return `${(ms / 60000).toFixed(1)}m`;
	}

	// Format date/time
	function formatDateTime(dateStr: string | null): string {
		const parsed = parseUTC(dateStr);
		if (!parsed) return 'Never';
		return parsed.toLocaleString();
	}

	// Get relative time (e.g., "in 5 minutes", "2 hours ago")
	function getRelativeTime(dateStr: string | null): string {
		const date = parseUTC(dateStr);
		if (!date) return '-';

		const now = new Date();
		const diff = date.getTime() - now.getTime();
		const absDiff = Math.abs(diff);

		const seconds = Math.floor(absDiff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		const isPast = diff < 0;

		if (days > 0) {
			return isPast ? `${days}d ago` : `in ${days}d`;
		}
		if (hours > 0) {
			return isPast ? `${hours}h ago` : `in ${hours}h`;
		}
		if (minutes > 0) {
			return isPast ? `${minutes}m ago` : `in ${minutes}m`;
		}
		return isPast ? `${seconds}s ago` : `in ${seconds}s`;
	}
</script>

<div class="p-4 md:p-8">
	<!-- Header -->
	<div class="mb-8">
		<h1 class="text-2xl font-bold text-neutral-900 md:text-3xl dark:text-neutral-50">
			Background Jobs
		</h1>
		<p class="mt-3 text-base text-neutral-600 md:text-lg dark:text-neutral-400">
			Manage scheduled tasks and automation workflows
		</p>
	</div>

	<!-- Jobs Table -->
	<div class="mb-8" data-onboarding="jobs-table">
		<ExpandableTable
			{columns}
			data={data.jobs}
			getRowId={(job) => job.id}
			emptyMessage="No background jobs configured"
			flushExpanded
			chevronPosition="right"
			responsive
		>
			<svelte:fragment slot="cell" let:row let:column>
				{#if column.key === 'name'}
					<span class="font-medium">{getJobLabel(row)}</span>
				{:else if column.key === 'status'}
					{#if row.status === 'running'}
						<Badge variant="accent">Running</Badge>
					{:else if row.status === 'queued'}
						<Badge variant="neutral">Queued</Badge>
					{:else if row.status === 'cancelled'}
						<Badge variant="danger">Cancelled</Badge>
					{:else}
						<Badge variant="neutral">{row.status}</Badge>
					{/if}
				{:else if column.key === 'last_run_at'}
					<div class="flex items-center gap-2">
						<Badge variant="neutral" mono>{getRelativeTime(row.last_run_at)}</Badge>
						{#if row.last_run_status === 'success'}
							<Badge variant="success" icon={CheckCircle}>Success</Badge>
						{:else if row.last_run_status === 'skipped'}
							<Badge variant="neutral" icon={MinusCircle}>Skipped</Badge>
						{:else if row.last_run_status === 'failure'}
							<Badge variant="danger" icon={XCircle}>Failed</Badge>
						{/if}
					</div>
				{:else if column.key === 'next_run_at'}
					{#if row.enabled}
						<Badge variant="neutral" mono>{getRelativeTime(row.next_run_at)}</Badge>
					{:else}
						<span class="text-neutral-400 dark:text-neutral-600">-</span>
					{/if}
				{/if}
			</svelte:fragment>

			<svelte:fragment slot="expanded" let:row>
				<div class="space-y-3 px-6 py-4 text-sm">
					<!-- Description -->
					{#if row.description}
						<p class="text-neutral-600 dark:text-neutral-400">{row.description}</p>
					{/if}

					<div class="grid grid-cols-3 gap-4">
						<!-- Last Run Details -->
						<div>
							<div
								class="text-xs font-medium tracking-wider text-neutral-500 uppercase dark:text-neutral-500"
							>
								Last Run
							</div>
							<div class="mt-1">
								<Badge variant="neutral" mono>{formatDateTime(row.last_run_at)}</Badge>
							</div>
						</div>

						<!-- Duration -->
						<div>
							<div
								class="text-xs font-medium tracking-wider text-neutral-500 uppercase dark:text-neutral-500"
							>
								Duration
							</div>
							<div class="mt-1">
								<Badge variant="neutral" mono>{formatDuration(row.last_run_duration)}</Badge>
							</div>
						</div>

						<!-- Next Run Details -->
						<div>
							<div
								class="text-xs font-medium tracking-wider text-neutral-500 uppercase dark:text-neutral-500"
							>
								Next Run
							</div>
							<div class="mt-1">
								{#if row.enabled}
									<Badge variant="neutral" mono>{formatDateTime(row.next_run_at)}</Badge>
								{:else}
									<Badge variant="neutral">Disabled</Badge>
								{/if}
							</div>
						</div>
					</div>

					<!-- Error Message -->
					{#if row.last_run_error}
						<div
							class="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20"
						>
							<AlertCircle size={16} class="mt-0.5 flex-shrink-0 text-red-600 dark:text-red-400" />
							<div>
								<div class="text-xs font-medium text-red-800 dark:text-red-200">Last Run Error</div>
								<div class="mt-1 text-sm text-red-700 dark:text-red-300">{row.last_run_error}</div>
							</div>
						</div>
					{/if}
				</div>
			</svelte:fragment>
		</ExpandableTable>
	</div>

	<!-- Job History -->
	<div data-onboarding="jobs-history">
		<JobHistory jobRuns={data.jobRuns} />
	</div>
</div>
