<script lang="ts">
	import Badge from '$ui/badge/Badge.svelte';
	import DateTime from '$ui/datetime/DateTime.svelte';
	import { AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-svelte';
	import type { DriftCounts, DriftDiff, DriftRunStatus } from '$shared/drift.ts';

	interface DriftStatus {
		status: DriftRunStatus;
		lastCheckedAt: string | null;
		counts: DriftCounts;
		diff: DriftDiff;
		diffHash: string | null;
		lastError: string | null;
	}

	interface MissingCustomFormatDiff {
		name: string;
	}

	interface FieldDiff {
		path: string;
		expected: unknown;
		actual: unknown;
	}

	interface ModifiedCustomFormatDiff {
		name: string;
		fields: FieldDiff[];
	}

	interface CustomFormatDiff {
		missing?: MissingCustomFormatDiff[];
		modified?: ModifiedCustomFormatDiff[];
	}

	export let status: DriftStatus;
	export let nextRunAt: string | null = null;

	const maxMissing = 8;
	const maxModified = 6;
	const maxFields = 4;

	$: customFormatDiff = (status.diff.custom_formats ?? {}) as CustomFormatDiff;
	$: missingCustomFormats = customFormatDiff.missing ?? [];
	$: modifiedCustomFormats = customFormatDiff.modified ?? [];
	$: visibleMissingCustomFormats = missingCustomFormats.slice(0, maxMissing);
	$: visibleModifiedCustomFormats = modifiedCustomFormats.slice(0, maxModified);
	$: totalDriftCount = Object.values(status.counts ?? {}).reduce(
		(sum, count) => sum + (count ?? 0),
		0
	);
	$: hasDriftDetails = missingCustomFormats.length > 0 || modifiedCustomFormats.length > 0;

	function statusLabel(value: DriftRunStatus): string {
		if (value === 'clean') return 'Clean';
		if (value === 'drift_detected') return 'Drift Detected';
		if (value === 'failed') return 'Failed';
		return 'Never Checked';
	}

	function statusVariant(value: DriftRunStatus): 'neutral' | 'success' | 'warning' | 'danger' {
		if (value === 'clean') return 'success';
		if (value === 'drift_detected') return 'warning';
		if (value === 'failed') return 'danger';
		return 'neutral';
	}

	function statusIcon(value: DriftRunStatus) {
		if (value === 'clean') return CheckCircle2;
		if (value === 'drift_detected') return AlertTriangle;
		if (value === 'failed') return XCircle;
		return Clock;
	}

	function sectionLabel(section: string): string {
		if (section === 'custom_formats') return 'Custom Formats';
		if (section === 'quality_profiles') return 'Quality Profiles';
		if (section === 'delay_profiles') return 'Delay Profiles';
		if (section === 'media_management') return 'Media Management';
		return section;
	}

	function valueLabel(value: unknown): string {
		if (value === null || value === undefined) return 'missing';
		if (typeof value === 'string') return value;
		return JSON.stringify(value);
	}
</script>

<div class="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
	<div class="border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
		<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
			<div>
				<h3 class="text-base font-semibold text-neutral-900 dark:text-neutral-50">Status</h3>
				<p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
					Latest stored drift result for this Arr instance.
				</p>
			</div>
			<Badge variant={statusVariant(status.status)} size="md" icon={statusIcon(status.status)}>
				{statusLabel(status.status)}
			</Badge>
		</div>
	</div>

	<div class="space-y-5 p-6">
		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
			<div>
				<div class="text-xs text-neutral-500 dark:text-neutral-400">Last Checked</div>
				<div class="mt-1 text-sm font-medium text-neutral-900 dark:text-neutral-100">
					{#if status.lastCheckedAt}
						<DateTime value={status.lastCheckedAt} />
					{:else}
						Never
					{/if}
				</div>
			</div>
			<div>
				<div class="text-xs text-neutral-500 dark:text-neutral-400">Next Run</div>
				<div class="mt-1 text-sm font-medium text-neutral-900 dark:text-neutral-100">
					{#if nextRunAt}
						<DateTime value={nextRunAt} />
					{:else}
						Not scheduled
					{/if}
				</div>
			</div>
			<div>
				<div class="text-xs text-neutral-500 dark:text-neutral-400">Drift Items</div>
				<div class="mt-1 text-sm font-medium text-neutral-900 dark:text-neutral-100">
					{totalDriftCount}
				</div>
			</div>
			<div>
				<div class="text-xs text-neutral-500 dark:text-neutral-400">Hash</div>
				<div class="mt-1 truncate font-mono text-xs text-neutral-700 dark:text-neutral-300">
					{status.diffHash ?? 'none'}
				</div>
			</div>
		</div>

		{#if status.status === 'failed' && status.lastError}
			<div
				class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
			>
				{status.lastError}
			</div>
		{:else if status.status === 'never_checked'}
			<div
				class="rounded border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400"
			>
				No drift check has run yet.
			</div>
		{:else if status.status === 'clean'}
			<div
				class="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
			>
				No drift detected.
			</div>
		{:else if hasDriftDetails}
			<div class="space-y-4 border-t border-neutral-200 pt-5 dark:border-neutral-800">
				<div class="flex flex-wrap gap-2">
					{#each Object.entries(status.counts ?? {}) as [section, count]}
						{#if count}
							<Badge variant="warning" size="md">
								{sectionLabel(section)}: {count}
							</Badge>
						{/if}
					{/each}
				</div>

				{#if missingCustomFormats.length > 0}
					<div>
						<h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
							Missing Custom Formats
						</h3>
						<div class="mt-2 flex flex-wrap gap-2">
							{#each visibleMissingCustomFormats as item}
								<Badge variant="danger" size="md">{item.name}</Badge>
							{/each}
							{#if missingCustomFormats.length > visibleMissingCustomFormats.length}
								<Badge variant="neutral" size="md">
									+{missingCustomFormats.length - visibleMissingCustomFormats.length} more
								</Badge>
							{/if}
						</div>
					</div>
				{/if}

				{#if modifiedCustomFormats.length > 0}
					<div>
						<h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
							Modified Custom Formats
						</h3>
						<div class="mt-2 space-y-3">
							{#each visibleModifiedCustomFormats as item}
								<div class="rounded border border-neutral-200 dark:border-neutral-800">
									<div
										class="border-b border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-900 dark:border-neutral-800 dark:text-neutral-100"
									>
										{item.name}
									</div>
									<div class="divide-y divide-neutral-200 dark:divide-neutral-800">
										{#each item.fields.slice(0, maxFields) as field}
											<div class="space-y-2 px-3 py-2">
												<div class="font-mono text-xs text-neutral-600 dark:text-neutral-400">
													{field.path}
												</div>
												<div class="grid gap-2 md:grid-cols-2">
													<div>
														<div
															class="text-[10px] font-medium text-neutral-500 uppercase dark:text-neutral-400"
														>
															Expected
														</div>
														<code
															class="mt-1 block rounded bg-neutral-100 p-2 font-mono text-xs break-all whitespace-pre-wrap text-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
															>{valueLabel(field.expected)}</code
														>
													</div>
													<div>
														<div
															class="text-[10px] font-medium text-neutral-500 uppercase dark:text-neutral-400"
														>
															Actual
														</div>
														<code
															class="mt-1 block rounded bg-neutral-100 p-2 font-mono text-xs break-all whitespace-pre-wrap text-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
															>{valueLabel(field.actual)}</code
														>
													</div>
												</div>
											</div>
										{/each}
										{#if item.fields.length > maxFields}
											<div class="px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400">
												+{item.fields.length - maxFields} more field changes
											</div>
										{/if}
									</div>
								</div>
							{/each}
							{#if modifiedCustomFormats.length > visibleModifiedCustomFormats.length}
								<div class="text-sm text-neutral-500 dark:text-neutral-400">
									+{modifiedCustomFormats.length - visibleModifiedCustomFormats.length} more modified
									custom formats
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
