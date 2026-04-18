<script lang="ts">
	import { Loader2, AlertTriangle, Check } from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import { alertStore } from '$lib/client/alerts/store';
	import { jobStatus } from '$lib/client/stores/jobStatus';
	import Modal from '$ui/modal/Modal.svelte';

	export let open = false;
	export let instanceId: number;
	export let instanceType: string = '';

	// --- Scan result types (match the API and server-side scan helpers) ---
	type StaleItem = { id: number; name: string };
	type ConfigScanResult = { staleCustomFormats: StaleItem[]; staleQualityProfiles: StaleItem[] };
	type RemovedEntity = { id: number; title: string; externalId: number };
	type EntityScanResult = { removedEntities: RemovedEntity[] };

	type Phase = 'idle' | 'scanning' | 'preview' | 'submitting';

	let phase: Phase = 'idle';

	let configScan: ConfigScanResult | null = null;
	let configError: string | null = null;
	let entityScan: EntityScanResult | null = null;
	let entityError: string | null = null;

	let cleanupFormRef: HTMLFormElement;

	$: isLoading = phase === 'scanning' || phase === 'submitting';

	$: configEmpty =
		configScan != null &&
		configScan.staleCustomFormats.length === 0 &&
		configScan.staleQualityProfiles.length === 0;

	$: entityEmpty = entityScan != null && entityScan.removedEntities.length === 0;

	$: allEmpty = configEmpty && entityEmpty;

	$: hasAnythingToClean = phase === 'preview' && !allEmpty && !configError && !entityError;

	$: confirmText = (() => {
		if (phase === 'scanning') return 'Scanning...';
		if (phase === 'submitting') return 'Queueing...';
		if (hasAnythingToClean) return 'Clean Up';
		return 'Close';
	})();

	$: confirmDanger = hasAnythingToClean;
	$: confirmDisabled = phase === 'scanning' || phase === 'submitting';

	// Scan data sent to the server as the pre-scanned payload. Only set when both scans
	// succeeded and at least one side has work to do; kept in sync with the form's hidden
	// input via reactivity.
	$: preScannedPayload = (() => {
		if (!configScan || !entityScan) return '';
		return JSON.stringify({
			staleConfigs: configScan,
			removedEntities: entityScan
		});
	})();

	// Auto-scan when modal opens
	$: if (open && phase === 'idle') {
		scanAll();
	}

	function reset() {
		phase = 'idle';
		configScan = null;
		configError = null;
		entityScan = null;
		entityError = null;
	}

	async function scanAll() {
		phase = 'scanning';

		try {
			const res = await fetch(`/arr/${instanceId}/settings/cleanup/preview`);
			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as { error?: string };
				const message = body?.error ?? 'Preview failed';
				configError = message;
				entityError = message;
			} else {
				const body = (await res.json()) as {
					configs: { ok: true; data: ConfigScanResult } | { ok: false; error: string };
					entities: { ok: true; data: EntityScanResult } | { ok: false; error: string };
				};
				if (body.configs.ok) configScan = body.configs.data;
				else configError = body.configs.error;
				if (body.entities.ok) entityScan = body.entities.data;
				else entityError = body.entities.error;
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Preview failed';
			configError = message;
			entityError = message;
		}

		phase = 'preview';
	}

	function handleConfirm() {
		if (hasAnythingToClean) {
			// Open the SSE stream before submitting so the cleanup's job.started event
			// is captured as soon as the dispatcher fires it.
			jobStatus.connect();
			cleanupFormRef?.requestSubmit();
		} else {
			open = false;
			reset();
		}
	}

	function handleCancel() {
		open = false;
		reset();
	}

	$: entityLabel =
		instanceType === 'radarr' ? 'movies' : instanceType === 'sonarr' ? 'series' : 'items';
	$: externalDb =
		instanceType === 'radarr' ? 'TMDB' : instanceType === 'sonarr' ? 'TVDB' : 'external DB';
</script>

<form
	bind:this={cleanupFormRef}
	method="POST"
	action="?/runCleanupNow"
	class="hidden"
	use:enhance={() => {
		phase = 'submitting';
		return async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') {
				alertStore.add('success', 'Cleanup queued');
				open = false;
				reset();
			} else {
				const message =
					result.type === 'failure' && typeof result.data?.error === 'string'
						? result.data.error
						: 'Failed to queue cleanup';
				alertStore.add('error', message);
				phase = 'preview';
			}
		};
	}}
>
	<input type="hidden" name="preScanned" value={preScannedPayload} />
</form>

<Modal
	{open}
	header="Cleanup"
	{confirmText}
	{confirmDanger}
	{confirmDisabled}
	loading={isLoading}
	on:confirm={handleConfirm}
	on:cancel={handleCancel}
>
	<div slot="body">
		{#if phase === 'scanning'}
			<div class="flex flex-col items-center gap-3 py-8">
				<Loader2 size={32} class="animate-spin text-neutral-400" />
				<p class="text-sm text-neutral-500 dark:text-neutral-400">
					Scanning for stale configs and removed media...
				</p>
			</div>
		{:else if phase === 'submitting'}
			<div class="flex flex-col items-center gap-3 py-8">
				<Loader2 size={32} class="animate-spin text-neutral-400" />
				<p class="text-sm text-neutral-500 dark:text-neutral-400">Queueing cleanup job...</p>
			</div>
		{:else if phase === 'preview'}
			{#if allEmpty && !configError && !entityError}
				<div class="flex flex-col items-center gap-3 py-8">
					<Check size={32} class="text-emerald-500" />
					<p class="text-sm text-neutral-600 dark:text-neutral-400">
						Nothing to clean up. Everything looks good.
					</p>
				</div>
			{:else}
				<div class="space-y-4">
					<!-- Config cleanup preview -->
					{#if configError}
						<div
							class="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950"
						>
							<AlertTriangle size={16} class="mt-0.5 flex-shrink-0 text-red-500" />
							<div>
								<p class="text-sm font-medium text-red-800 dark:text-red-200">Config scan failed</p>
								<p class="mt-0.5 text-xs text-red-600 dark:text-red-400">{configError}</p>
							</div>
						</div>
					{:else if !configEmpty && configScan}
						<div class="space-y-2">
							<p
								class="text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400"
							>
								Stale Configs
							</p>
							<div class="space-y-1">
								{#if configScan.staleCustomFormats.length > 0}
									<p class="text-sm text-neutral-700 dark:text-neutral-300">
										<span class="font-medium">{configScan.staleCustomFormats.length}</span> custom
										format{configScan.staleCustomFormats.length === 1 ? '' : 's'}
									</p>
								{/if}
								{#if configScan.staleQualityProfiles.length > 0}
									<p class="text-sm text-neutral-700 dark:text-neutral-300">
										<span class="font-medium">{configScan.staleQualityProfiles.length}</span>
										quality profile{configScan.staleQualityProfiles.length === 1 ? '' : 's'}
									</p>
								{/if}
							</div>
						</div>
					{/if}

					<!-- Entity cleanup preview -->
					{#if entityError}
						<div
							class="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950"
						>
							<AlertTriangle size={16} class="mt-0.5 flex-shrink-0 text-red-500" />
							<div>
								<p class="text-sm font-medium text-red-800 dark:text-red-200">Entity scan failed</p>
								<p class="mt-0.5 text-xs text-red-600 dark:text-red-400">{entityError}</p>
							</div>
						</div>
					{:else if !entityEmpty && entityScan}
						<div class="space-y-2">
							<p
								class="text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400"
							>
								Removed Media
							</p>
							<p class="text-sm text-neutral-700 dark:text-neutral-300">
								<span class="font-medium">{entityScan.removedEntities.length}</span>
								{entityLabel} removed from {externalDb}
							</p>
							<div class="max-h-40 overflow-y-auto">
								{#each entityScan.removedEntities as entity}
									<p class="text-sm text-neutral-500 dark:text-neutral-400">{entity.title}</p>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/if}
		{/if}
	</div>
</Modal>
