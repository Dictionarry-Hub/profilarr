<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { alertStore } from '$alerts/store';
	import Modal from './Modal.svelte';
	import FormInput from '$ui/form/FormInput.svelte';
	import type { components } from '$api/v1.d.ts';

	type EntityType = components['schemas']['EntityType'];
	type BundledDependency = components['schemas']['BundledDependency'];
	type ImportConflict = components['schemas']['ImportConflict'];
	type ConflictResolution = components['schemas']['ConflictResolution'];

	export let open = false;
	export let databaseId: number;
	export let canWriteToBase: boolean = false;

	// Internal state
	let step: 'paste' | 'resolve' | 'importing' = 'paste';
	let rawJson = '';
	let parseError = '';
	let loading = false;

	// Parsed data
	let entityType: EntityType | null = null;
	let entityName = '';
	let parsedData: Record<string, unknown> | null = null;
	let dependencies: BundledDependency[] = [];

	// Preflight results
	let toCreate: BundledDependency[] = [];
	let toSkip: BundledDependency[] = [];
	let toResolve: ImportConflict[] = [];

	// User resolutions
	let resolutions: Map<string, ConflictResolution> = new Map();

	// Reset state when modal opens/closes
	$: if (open) {
		step = 'paste';
		rawJson = '';
		parseError = '';
		loading = false;
		entityType = null;
		entityName = '';
		parsedData = null;
		dependencies = [];
		toCreate = [];
		toSkip = [];
		toResolve = [];
		resolutions = new Map();
	}

	// Dependency summary
	$: depCounts = (() => {
		const counts: Record<string, number> = {};
		for (const dep of dependencies) {
			counts[dep.entityType] = (counts[dep.entityType] || 0) + 1;
		}
		return counts;
	})();

	// Validation
	$: canProceed =
		step === 'paste'
			? entityType !== null && parsedData !== null && !parseError
			: step === 'resolve'
				? toResolve.every((c) => {
						const res = resolutions.get(`${c.entityType}:${c.name}`);
						if (!res) return false;
						if (res.action === 'rename') return !!res.newName?.trim();
						return true;
					})
				: false;

	$: confirmText =
		step === 'paste'
			? dependencies.length > 0
				? 'Check Dependencies'
				: 'Import'
			: step === 'resolve'
				? 'Import'
				: 'Importing...';

	function handlePaste(value: string) {
		rawJson = value;
		parseError = '';
		entityType = null;
		entityName = '';
		parsedData = null;
		dependencies = [];

		if (!value.trim()) return;

		try {
			const parsed = JSON.parse(value);

			if (!parsed.entityType || !parsed.data) {
				parseError = 'Invalid format: missing entityType or data';
				return;
			}

			if (!parsed.data.name) {
				parseError = 'Invalid format: entity data missing name';
				return;
			}

			entityType = parsed.entityType as EntityType;
			entityName = parsed.data.name;
			parsedData = parsed.data;
			dependencies = parsed.dependencies ?? [];
		} catch {
			parseError = 'Invalid JSON';
		}
	}

	async function handleConfirm() {
		if (step === 'paste') {
			if (dependencies.length > 0) {
				await runPreflight();
			} else {
				await runImport();
			}
		} else if (step === 'resolve') {
			await runImport();
		}
	}

	async function runPreflight() {
		loading = true;
		try {
			const res = await fetch('/api/v1/pcd/import/preflight', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					databaseId,
					entityType,
					data: parsedData,
					dependencies
				})
			});
			const result = await res.json();
			if (!res.ok) {
				alertStore.add('error', result.error || 'Preflight check failed');
				return;
			}

			toCreate = result.toCreate ?? [];
			toSkip = result.toSkip ?? [];
			toResolve = result.toResolve ?? [];

			if (toResolve.length === 0) {
				// No conflicts — import directly
				await runImport();
			} else {
				// Initialize default resolutions (skip)
				resolutions = new Map();
				for (const conflict of toResolve) {
					resolutions.set(`${conflict.entityType}:${conflict.name}`, {
						entityType: conflict.entityType,
						originalName: conflict.name,
						action: 'skip'
					});
				}
				step = 'resolve';
			}
		} catch {
			alertStore.add('error', 'Preflight check failed');
		} finally {
			loading = false;
		}
	}

	async function runImport() {
		loading = true;
		step = 'importing';
		try {
			const layer = canWriteToBase ? 'base' : 'user';
			const body: Record<string, unknown> = {
				databaseId,
				layer,
				entityType,
				data: parsedData
			};

			if (dependencies.length > 0) {
				body.dependencies = dependencies;
				body.resolutions = [...resolutions.values()];
			}

			const res = await fetch('/api/v1/pcd/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			const result = await res.json();
			if (!res.ok) {
				alertStore.add('error', result.error || 'Import failed');
				step = 'resolve';
				return;
			}

			open = false;
			alertStore.add('success', `Imported "${entityName}"`);
			await invalidateAll();
		} catch {
			alertStore.add('error', 'Import failed');
			step = 'resolve';
		} finally {
			loading = false;
		}
	}

	function handleCancel() {
		open = false;
	}

	function setResolution(key: string, action: 'skip' | 'rename', newName?: string) {
		const conflict = toResolve.find((c) => `${c.entityType}:${c.name}` === key);
		if (!conflict) return;

		const updated = new Map(resolutions);
		updated.set(key, {
			entityType: conflict.entityType,
			originalName: conflict.name,
			action,
			newName
		});
		resolutions = updated;
	}

	function formatEntityType(type: string): string {
		return type
			.split('_')
			.map((w) => w[0].toUpperCase() + w.slice(1))
			.join(' ');
	}
</script>

<Modal
	{open}
	header="Import"
	{confirmText}
	confirmDisabled={!canProceed}
	{loading}
	size="lg"
	height={step === 'resolve' ? 'lg' : 'auto'}
	on:confirm={handleConfirm}
	on:cancel={handleCancel}
>
	<div slot="body">
		{#if step === 'paste'}
			<div class="space-y-4">
				<div class="space-y-2">
					<label
						class="block text-sm font-medium text-neutral-900 dark:text-neutral-100"
						for="import-json"
					>
						Paste exported JSON
					</label>
					<textarea
						id="import-json"
						class="h-48 w-full resize-y rounded-lg border border-neutral-300 bg-white p-3 font-mono text-xs text-neutral-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
						placeholder={'{"entityType": "...", "data": {...}, "dependencies": [...]}'}
						value={rawJson}
						on:input={(e) => handlePaste(e.currentTarget.value)}
					></textarea>
				</div>

				{#if parseError}
					<p class="text-xs text-red-600 dark:text-red-400">{parseError}</p>
				{/if}

				{#if entityType && entityName}
					<div
						class="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800"
					>
						<div class="flex items-center gap-2">
							<span
								class="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
							>
								{formatEntityType(entityType)}
							</span>
							<span class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
								{entityName}
							</span>
						</div>
						{#if dependencies.length > 0}
							<p class="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
								Dependencies:
								{#each Object.entries(depCounts) as [type, count], i}
									{count}
									{formatEntityType(type).toLowerCase()}{count > 1 ? 's' : ''}{i <
									Object.entries(depCounts).length - 1
										? ', '
										: ''}
								{/each}
							</p>
						{/if}
					</div>
				{/if}
			</div>
		{:else if step === 'resolve'}
			<div class="space-y-4">
				<p class="text-sm text-neutral-600 dark:text-neutral-400">
					Some dependencies already exist with different content. Choose how to handle each
					conflict.
				</p>

				{#if toCreate.length > 0}
					<div class="space-y-1">
						<h3 class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
							Will be created ({toCreate.length})
						</h3>
						{#each toCreate as dep}
							<div
								class="flex items-center gap-2 rounded px-3 py-1.5 text-sm text-neutral-700 dark:text-neutral-300"
							>
								<span
									class="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-300"
								>
									New
								</span>
								<span>{dep.data.name}</span>
								<span class="text-xs text-neutral-400">
									({formatEntityType(dep.entityType)})
								</span>
							</div>
						{/each}
					</div>
				{/if}

				{#if toSkip.length > 0}
					<div class="space-y-1">
						<h3 class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
							Already exists, identical ({toSkip.length})
						</h3>
						{#each toSkip as dep}
							<div
								class="flex items-center gap-2 rounded px-3 py-1.5 text-sm text-neutral-500 dark:text-neutral-400"
							>
								<span
									class="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400"
								>
									Skip
								</span>
								<span>{dep.data.name}</span>
								<span class="text-xs text-neutral-400">
									({formatEntityType(dep.entityType)})
								</span>
							</div>
						{/each}
					</div>
				{/if}

				{#if toResolve.length > 0}
					<div class="space-y-2">
						<h3 class="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
							Conflicts ({toResolve.length})
						</h3>
						{#each toResolve as conflict}
							{@const key = `${conflict.entityType}:${conflict.name}`}
							{@const resolution = resolutions.get(key)}
							<div
								class="space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800/50 dark:bg-amber-900/10"
							>
								<div class="flex items-center gap-2">
									<span
										class="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
									>
										Conflict
									</span>
									<span class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
										{conflict.name}
									</span>
									<span class="text-xs text-neutral-400">
										({formatEntityType(conflict.entityType)})
									</span>
								</div>

								<div class="flex gap-3 text-sm">
									<label class="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300">
										<input
											type="radio"
											checked={resolution?.action === 'skip'}
											on:change={() => setResolution(key, 'skip')}
										/>
										Use existing
									</label>
									<label class="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300">
										<input
											type="radio"
											checked={resolution?.action === 'rename'}
											on:change={() => setResolution(key, 'rename', `${conflict.name} (imported)`)}
										/>
										Rename and import
									</label>
								</div>

								{#if resolution?.action === 'rename'}
									<FormInput
										label=""
										value={resolution.newName ?? ''}
										placeholder="New name"
										on:input={(e) => setResolution(key, 'rename', e.detail)}
									/>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{:else if step === 'importing'}
			<div class="flex items-center justify-center py-8">
				<p class="text-sm text-neutral-500 dark:text-neutral-400">Importing...</p>
			</div>
		{/if}
	</div>
</Modal>
