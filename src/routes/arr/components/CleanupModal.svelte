<script lang="ts">
	import { Loader2, AlertTriangle, Check } from 'lucide-svelte';
	import Modal from '$ui/modal/Modal.svelte';

	export let open = false;
	export let instanceId: number;
	export let instanceType: string = '';

	// --- Config cleanup types ---
	type StaleItem = { id: number; name: string };
	type SkippedItem = { item: StaleItem; reason: string };
	type ConfigScanResult = { staleCustomFormats: StaleItem[]; staleQualityProfiles: StaleItem[] };
	type ConfigDeleteResult = {
		deletedCustomFormats: StaleItem[];
		deletedQualityProfiles: StaleItem[];
		skippedQualityProfiles: SkippedItem[];
	};

	// --- Entity cleanup types ---
	type RemovedEntity = { id: number; title: string; externalId: number };
	type EntityScanResult = { removedEntities: RemovedEntity[] };
	type EntityDeleteResult = {
		deletedEntities: RemovedEntity[];
		failedEntities: { entity: RemovedEntity; reason: string }[];
	};

	type Phase = 'idle' | 'scanning' | 'preview' | 'executing' | 'results';

	let phase: Phase = 'idle';

	// Config cleanup state
	let configScan: ConfigScanResult | null = null;
	let configResult: ConfigDeleteResult | null = null;
	let configError: string | null = null;

	// Entity cleanup state
	let entityScan: EntityScanResult | null = null;
	let entityResult: EntityDeleteResult | null = null;
	let entityError: string | null = null;

	// Derived
	$: isLoading = phase === 'scanning' || phase === 'executing';

	$: configEmpty =
		configScan != null &&
		configScan.staleCustomFormats.length === 0 &&
		configScan.staleQualityProfiles.length === 0;

	$: entityEmpty = entityScan != null && entityScan.removedEntities.length === 0;

	$: allEmpty = configEmpty && entityEmpty;

	$: hasAnythingToClean = phase === 'preview' && !allEmpty && !configError && !entityError;

	$: confirmText = (() => {
		if (phase === 'scanning') return 'Scanning...';
		if (phase === 'executing') return 'Cleaning...';
		if (hasAnythingToClean) return 'Clean Up';
		return 'Close';
	})();

	$: confirmDanger = hasAnythingToClean;
	$: confirmDisabled = phase === 'scanning' || phase === 'executing';

	// Auto-scan when modal opens
	$: if (open && phase === 'idle') {
		scanAll();
	}

	function reset() {
		phase = 'idle';
		configScan = null;
		configResult = null;
		configError = null;
		entityScan = null;
		entityResult = null;
		entityError = null;
	}

	async function scanAll() {
		phase = 'scanning';

		const configPromise = fetch('/api/v1/arr/cleanup', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ instanceId, action: 'scan' })
		})
			.then(async (res) => {
				if (!res.ok) {
					const data = await res.json();
					throw new Error(data.error || 'Config scan failed');
				}
				configScan = await res.json();
			})
			.catch((err) => {
				configError = err instanceof Error ? err.message : 'Config scan failed';
			});

		const entityPromise = fetch('/api/v1/arr/cleanup', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ instanceId, action: 'scan-entities' })
		})
			.then(async (res) => {
				if (!res.ok) {
					const data = await res.json();
					throw new Error(data.error || 'Entity scan failed');
				}
				entityScan = await res.json();
			})
			.catch((err) => {
				entityError = err instanceof Error ? err.message : 'Entity scan failed';
			});

		await Promise.all([configPromise, entityPromise]);
		phase = 'preview';
	}

	async function executeAll() {
		phase = 'executing';

		const promises: Promise<void>[] = [];

		if (configScan && !configError && !configEmpty) {
			promises.push(
				fetch('/api/v1/arr/cleanup', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ instanceId, action: 'execute', scanResult: configScan })
				})
					.then(async (res) => {
						if (!res.ok) {
							const data = await res.json();
							throw new Error(data.error || 'Config cleanup failed');
						}
						configResult = await res.json();
					})
					.catch((err) => {
						configError = err instanceof Error ? err.message : 'Config cleanup failed';
					})
			);
		}

		if (entityScan && !entityError && !entityEmpty) {
			promises.push(
				fetch('/api/v1/arr/cleanup', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						instanceId,
						action: 'execute-entities',
						entities: entityScan.removedEntities
					})
				})
					.then(async (res) => {
						if (!res.ok) {
							const data = await res.json();
							throw new Error(data.error || 'Entity cleanup failed');
						}
						entityResult = await res.json();
					})
					.catch((err) => {
						entityError = err instanceof Error ? err.message : 'Entity cleanup failed';
					})
			);
		}

		await Promise.all(promises);
		phase = 'results';
	}

	function handleConfirm() {
		if (hasAnythingToClean) {
			executeAll();
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
		{:else if phase === 'executing'}
			<div class="flex flex-col items-center gap-3 py-8">
				<Loader2 size={32} class="animate-spin text-neutral-400" />
				<p class="text-sm text-neutral-500 dark:text-neutral-400">Cleaning up...</p>
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
		{:else if phase === 'results'}
			<div class="space-y-4">
				<!-- Config cleanup results -->
				{#if configResult}
					{#if configResult.deletedCustomFormats.length > 0 || configResult.deletedQualityProfiles.length > 0}
						<div class="space-y-1">
							{#if configResult.deletedCustomFormats.length > 0}
								<div class="flex items-center gap-2">
									<Check size={16} class="flex-shrink-0 text-emerald-500" />
									<p class="text-sm text-neutral-700 dark:text-neutral-300">
										Deleted <span class="font-medium"
											>{configResult.deletedCustomFormats.length}</span
										>
										custom format{configResult.deletedCustomFormats.length === 1 ? '' : 's'}
									</p>
								</div>
							{/if}
							{#if configResult.deletedQualityProfiles.length > 0}
								<div class="flex items-center gap-2">
									<Check size={16} class="flex-shrink-0 text-emerald-500" />
									<p class="text-sm text-neutral-700 dark:text-neutral-300">
										Deleted <span class="font-medium"
											>{configResult.deletedQualityProfiles.length}</span
										>
										quality profile{configResult.deletedQualityProfiles.length === 1 ? '' : 's'}
									</p>
								</div>
							{/if}
						</div>
					{/if}

					{#if configResult.skippedQualityProfiles.length > 0}
						<div class="space-y-1">
							<div class="flex items-center gap-2">
								<AlertTriangle size={16} class="flex-shrink-0 text-amber-500" />
								<p class="text-sm text-neutral-700 dark:text-neutral-300">
									Skipped {configResult.skippedQualityProfiles.length} profile{configResult
										.skippedQualityProfiles.length === 1
										? ''
										: 's'} assigned to media
								</p>
							</div>
							{#each configResult.skippedQualityProfiles as skipped}
								<p class="pl-6 text-sm text-neutral-500 dark:text-neutral-400">
									{skipped.item.name}
								</p>
							{/each}
						</div>
					{/if}
				{/if}

				{#if configError && phase === 'results'}
					<div
						class="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950"
					>
						<AlertTriangle size={16} class="mt-0.5 flex-shrink-0 text-red-500" />
						<div>
							<p class="text-sm font-medium text-red-800 dark:text-red-200">
								Config cleanup failed
							</p>
							<p class="mt-0.5 text-xs text-red-600 dark:text-red-400">{configError}</p>
						</div>
					</div>
				{/if}

				<!-- Entity cleanup results -->
				{#if entityResult}
					{#if entityResult.deletedEntities.length > 0}
						<div class="flex items-center gap-2">
							<Check size={16} class="flex-shrink-0 text-emerald-500" />
							<p class="text-sm text-neutral-700 dark:text-neutral-300">
								Deleted <span class="font-medium">{entityResult.deletedEntities.length}</span>
								{entityLabel} removed from {externalDb}
							</p>
						</div>
					{/if}

					{#if entityResult.failedEntities.length > 0}
						<div class="space-y-1">
							<div class="flex items-center gap-2">
								<AlertTriangle size={16} class="flex-shrink-0 text-amber-500" />
								<p class="text-sm text-neutral-700 dark:text-neutral-300">
									Failed to delete {entityResult.failedEntities.length}
									{entityLabel}
								</p>
							</div>
							{#each entityResult.failedEntities as failed}
								<p class="pl-6 text-sm text-neutral-500 dark:text-neutral-400">
									{failed.entity.title}
								</p>
							{/each}
						</div>
					{/if}
				{/if}

				{#if entityError && phase === 'results'}
					<div
						class="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950"
					>
						<AlertTriangle size={16} class="mt-0.5 flex-shrink-0 text-red-500" />
						<div>
							<p class="text-sm font-medium text-red-800 dark:text-red-200">
								Entity cleanup failed
							</p>
							<p class="mt-0.5 text-xs text-red-600 dark:text-red-400">{entityError}</p>
						</div>
					</div>
				{/if}

				<!-- Nothing deleted at all -->
				{#if !configResult && !entityResult && !configError && !entityError}
					<p class="text-sm text-neutral-500 dark:text-neutral-400">Nothing was deleted.</p>
				{/if}
			</div>
		{/if}
	</div>
</Modal>
