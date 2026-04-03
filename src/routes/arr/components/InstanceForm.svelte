<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { enhance } from '$app/forms';
	import { Save, Wifi, Trash2, Eraser, Loader2 } from 'lucide-svelte';
	import { parseUTC } from '$shared/utils/dates';
	import CleanupModal from './CleanupModal.svelte';
	import { alertStore } from '$alerts/store';
	import { isDirty, initEdit, initCreate, update, current, clear } from '$lib/client/stores/dirty';
	import type { ArrInstancePublic } from '$db/queries/arrInstances.ts';
	import type { CleanupSettings } from '$db/queries/arrCleanupSettings.ts';
	import FormInput from '$ui/form/FormInput.svelte';
	import DropdownSelect from '$ui/dropdown/DropdownSelect.svelte';
	import TagInput from '$ui/form/TagInput.svelte';
	import Toggle from '$ui/toggle/Toggle.svelte';
	import CronInput from '$ui/cron/CronInput.svelte';
	import Modal from '$ui/modal/Modal.svelte';
	import DirtyModal from '$ui/modal/DirtyModal.svelte';
	import Button from '$ui/button/Button.svelte';
	import StickyCard from '$ui/card/StickyCard.svelte';

	// Props
	export let mode: 'create' | 'edit';
	export let instance: ArrInstancePublic | undefined = undefined;
	export let initialType: string = '';
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export let form: any = undefined;
	export let cleanupSettings: CleanupSettings | null = null;

	// Parse tags from JSON string
	const parseTags = (tagsJson: string | null): string[] => {
		if (!tagsJson) return [];
		try {
			return JSON.parse(tagsJson);
		} catch {
			return [];
		}
	};

	// Initialize dirty tracking on mount
	onMount(() => {
		if (mode === 'edit' && instance) {
			initEdit({
				name: instance.name,
				type: instance.type,
				url: instance.url,
				apiKey: '', // Never pre-populate for security
				enabled: instance.enabled ? 'true' : 'false',
				tags: JSON.stringify(parseTags(instance.tags)),
				libraryRefreshInterval: String(instance.library_refresh_interval ?? 0),
				cleanupEnabled: cleanupSettings?.enabled ?? false,
				cleanupCron: cleanupSettings?.cron ?? '0 0 * * 0'
			});
		} else {
			initCreate({
				name: '',
				type: initialType,
				url: '',
				apiKey: '',
				enabled: 'true',
				tags: '[]',
				libraryRefreshInterval: '0',
				cleanupEnabled: false,
				cleanupCron: '0 0 * * 0'
			});
		}
		return () => clear();
	});

	// Read current values from dirty store
	$: name = ($current.name ?? '') as string;
	$: type = ($current.type ?? '') as string;
	$: url = ($current.url ?? '') as string;
	$: apiKey = ($current.apiKey ?? '') as string;
	$: enabled = ($current.enabled ?? 'true') as string;
	$: tags = JSON.parse(($current.tags ?? '[]') as string) as string[];
	$: libraryRefreshInterval = ($current.libraryRefreshInterval ?? '0') as string;
	$: cleanupEnabled = ($current.cleanupEnabled ?? false) as boolean;
	$: cleanupCron = ($current.cleanupCron ?? '0 0 * * 0') as string;

	// CronInput sync pattern (bind:value needs a local variable)
	let cronInputValue = cleanupSettings?.cron ?? '0 0 * * 0';
	$: cronInputValue = cleanupCron;
	$: if (cronInputValue !== cleanupCron) {
		update('cleanupCron', cronInputValue);
	}

	// UI state
	let saving = false;
	let testing = false;
	let deleting = false;
	let showDeleteModal = false;
	let showCleanupModal = false;

	// Options for dropdowns
	const typeOptions = [
		{ value: 'radarr', label: 'Radarr' },
		{ value: 'sonarr', label: 'Sonarr' }
	];

	const enabledOptions = [
		{ value: 'true', label: 'Enabled' },
		{ value: 'false', label: 'Disabled' }
	];

	const libraryRefreshOptions = [
		{ value: '0', label: 'Manual' },
		{ value: '10', label: 'Every 10 minutes' },
		{ value: '30', label: 'Every 30 minutes' },
		{ value: '60', label: 'Every hour' },
		{ value: '360', label: 'Every 6 hours' },
		{ value: '720', label: 'Every 12 hours' },
		{ value: '1440', label: 'Every 24 hours' },
		{ value: '10080', label: 'Weekly' }
	];

	// Manual test connection
	async function testConnection() {
		if (!type || !url || !apiKey) {
			alertStore.add('error', 'Please fill in Type, URL, and API Key');
			return;
		}

		testing = true;
		try {
			const response = await fetch('/arr/test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type, url, apiKey })
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || result.message || 'Connection test failed');
			}

			alertStore.add('success', 'Connection successful!');
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Connection test failed';
			alertStore.add('error', errorMessage);
		} finally {
			testing = false;
		}
	}

	// Save handler
	async function handleSave() {
		saving = true;

		try {
			// Save cleanup settings if they changed from server values
			if (mode === 'edit') {
				const origEnabled = cleanupSettings?.enabled ?? false;
				const origCron = cleanupSettings?.cron ?? '0 0 * * 0';
				if (cleanupEnabled !== origEnabled || cleanupCron !== origCron) {
					await saveCleanupSettings();
				}
			}

			// Only test connection if API key was provided
			if (apiKey) {
				const response = await fetch('/arr/test', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ type, url, apiKey })
				});

				const result = await response.json();

				if (!response.ok) {
					throw new Error(result.error || result.message || 'Connection test failed');
				}
			}

			const saveForm = document.getElementById('save-form');
			if (saveForm instanceof HTMLFormElement) {
				saveForm.requestSubmit();
			}
		} catch (error) {
			saving = false;
			const errorMessage = error instanceof Error ? error.message : 'Connection test failed';
			alertStore.add('error', errorMessage);
		}
	}

	$: canSubmit = $isDirty && !!name && !!url && (mode === 'edit' || (!!apiKey && !!type));

	// Handle form response
	let lastFormId: unknown = null;
	$: if (form && form !== lastFormId) {
		lastFormId = form;
		if (form.success) {
			alertStore.add('success', 'Settings saved successfully');
			// Reset dirty state with new values (keep apiKey empty)
			initEdit({
				name,
				type,
				url,
				apiKey: '',
				enabled,
				tags: JSON.stringify(tags),
				libraryRefreshInterval,
				cleanupEnabled,
				cleanupCron
			});
		}
		if (form.error) {
			alertStore.add('error', form.error);
		}
	}

	// Display text based on mode
	$: title = mode === 'create' ? 'Add Instance' : 'Settings';
	$: description =
		mode === 'create'
			? 'Configure a new Radarr or Sonarr instance.'
			: `Configure connection and sync settings for ${instance?.name || 'this instance'}.`;

	// Save cleanup settings alongside the main save
	async function saveCleanupSettings() {
		const formData = new FormData();
		formData.set('enabled', cleanupEnabled ? '1' : '0');
		formData.set('cron', cleanupCron);
		await fetch('?/updateCleanup', { method: 'POST', body: formData });
	}

	// Cleanup run status
	let now = Date.now();
	let clockInterval: ReturnType<typeof setInterval>;

	onMount(() => {
		clockInterval = setInterval(() => {
			now = Date.now();
		}, 1000);
	});

	onDestroy(() => {
		if (clockInterval) clearInterval(clockInterval);
	});

	$: cleanupNextRunTime = cleanupSettings?.nextRunAt
		? new Date(cleanupSettings.nextRunAt).getTime()
		: null;
	$: cleanupTimeUntilNext = cleanupNextRunTime ? cleanupNextRunTime - now : null;

	function formatTimeRemaining(ms: number): string {
		if (ms <= 0) return 'now';
		const seconds = Math.floor(ms / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		if (hours > 0) {
			const remainingMinutes = minutes % 60;
			return `${hours}h ${remainingMinutes}m`;
		}
		if (minutes > 0) return `${minutes}m`;
		return `${seconds}s`;
	}

	function formatLastRun(isoString: string): string {
		const date = parseUTC(isoString);
		if (!date) return '-';
		const today = new Date();
		const yesterday = new Date(today);
		yesterday.setDate(yesterday.getDate() - 1);

		let dateStr: string;
		if (date.toDateString() === today.toDateString()) {
			dateStr = 'Today';
		} else if (date.toDateString() === yesterday.toDateString()) {
			dateStr = 'Yesterday';
		} else {
			dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		}

		const timeStr = date.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});

		return `${dateStr}, ${timeStr}`;
	}
</script>

<div class="space-y-6" class:mt-6={mode === 'edit'}>
	<!-- Header -->
	<StickyCard position="top">
		<svelte:fragment slot="left">
			<h1 class="text-neutral-900 dark:text-neutral-50">{title}</h1>
			<p class="text-neutral-600 dark:text-neutral-400">{description}</p>
		</svelte:fragment>
		<svelte:fragment slot="right">
			{#if mode === 'edit'}
				<Button
					text="Delete"
					icon={Trash2}
					iconColor="text-red-600 dark:text-red-400"
					disabled={saving || deleting}
					on:click={() => (showDeleteModal = true)}
				/>
			{/if}
			<div data-onboarding="arr-save">
				<Button
					text={saving ? 'Saving...' : 'Save'}
					icon={Save}
					iconColor="text-blue-600 dark:text-blue-400"
					disabled={saving || !canSubmit}
					on:click={handleSave}
				/>
			</div>
		</svelte:fragment>
	</StickyCard>

	<div
		class="space-y-4 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
	>
		<!-- Type Row -->
		<div class="space-y-2" data-onboarding="arr-type">
			<span class="block text-sm font-medium text-neutral-900 dark:text-neutral-100">
				Type{#if mode === 'create'}<span class="text-red-500">*</span>{/if}
			</span>
			{#if mode === 'edit'}
				<p class="text-xs text-neutral-500 dark:text-neutral-400">
					Type cannot be changed after creation
				</p>
			{/if}
			<DropdownSelect
				value={type}
				options={typeOptions}
				placeholder="Select type..."
				disabled={mode === 'edit'}
				on:change={(e) => update('type', e.detail)}
			/>
		</div>
		<!-- Name, URL, API Key -->
		<div data-onboarding="arr-connection" class="space-y-4">
			<!-- Name + Status Row -->
			<div class="flex flex-col gap-4 md:flex-row md:items-end">
				<div class="flex-1">
					<FormInput
						label="Name"
						name="name"
						value={name}
						placeholder="e.g., Main Radarr, 4K Sonarr"
						required
						on:input={(e) => update('name', e.detail)}
					/>
				</div>
				<div class="space-y-1">
					<span class="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
						>Status</span
					>
					<DropdownSelect
						value={enabled}
						options={enabledOptions}
						on:change={(e) => update('enabled', e.detail)}
					/>
				</div>
			</div>
			{#if enabled === 'false'}
				<p class="text-xs text-amber-600 dark:text-amber-400">
					Disabled instances are excluded from sync operations
				</p>
			{/if}
			<!-- URL Row -->
			<FormInput
				label="URL"
				name="url"
				type="url"
				value={url}
				placeholder="http://localhost:7878"
				description="Use container name if on the same Docker network, e.g. http://radarr:7878"
				required
				on:input={(e) => update('url', e.detail)}
			/>
			<!-- API Key + Test Connection Row -->
			<div class="flex flex-col gap-4 md:flex-row md:items-end">
				<div class="flex-1">
					<FormInput
						label="API Key"
						name="api_key"
						value={apiKey}
						placeholder={mode === 'edit' ? '••••••••••••••••' : 'Enter API key'}
						description={mode === 'edit' ? 'Leave blank to keep existing key' : ''}
						required
						private_
						on:input={(e) => update('apiKey', e.detail)}
					/>
				</div>
				<Button
					text={testing ? 'Testing...' : 'Test Connection'}
					icon={testing ? Loader2 : Wifi}
					disabled={testing || !apiKey || !url || (mode === 'create' && !type)}
					on:click={testConnection}
				/>
			</div>
		</div>
		<!-- Tags Row -->
		<div class="space-y-2">
			<span class="block text-sm font-medium text-neutral-900 dark:text-neutral-100"> Tags </span>
			<p class="text-xs text-neutral-500 dark:text-neutral-400">
				Press Enter to add a tag, Backspace to remove
			</p>
			<TagInput {tags} on:change={(e) => update('tags', JSON.stringify(e.detail))} />
		</div>
		<!-- Library Refresh (edit mode only) -->
		{#if mode === 'edit' && instance}
			<div class="space-y-2">
				<span class="block text-sm font-medium text-neutral-900 dark:text-neutral-100">
					Library Refresh
				</span>
				<p class="text-xs text-neutral-500 dark:text-neutral-400">
					How often to refresh cached library data in the background
				</p>
				<DropdownSelect
					value={libraryRefreshInterval}
					options={libraryRefreshOptions}
					fullWidth
					on:change={(e) => update('libraryRefreshInterval', e.detail)}
				/>
			</div>
		{/if}
		<!-- Cleanup (edit mode only) -->
		{#if mode === 'edit' && instance}
			<div class="space-y-2">
				<span class="block text-sm font-medium text-neutral-900 dark:text-neutral-100">
					Cleanup
				</span>
				<p class="text-xs text-neutral-500 dark:text-neutral-400">
					Remove unused quality profiles, custom formats, and media flagged as removed from
					TMDB/TVDB
				</p>
				<div
					class="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 md:flex md:flex-wrap md:gap-x-6"
				>
					<div class="md:flex md:items-center md:gap-2">
						<Toggle
							checked={cleanupEnabled}
							label={cleanupEnabled ? 'Enabled' : 'Disabled'}
							color={cleanupEnabled ? 'green' : 'red'}
							on:change={(e) => update('cleanupEnabled', e.detail)}
						/>
					</div>

					{#if cleanupEnabled}
						<!-- Schedule -->
						<div class="col-span-2 md:col-span-1 md:flex md:items-center md:gap-2">
							<span class="mb-1 block text-sm text-neutral-500 md:hidden dark:text-neutral-400"
								>Schedule</span
							>
							<span class="hidden text-sm text-neutral-500 md:inline dark:text-neutral-400"
								>Schedule:</span
							>
							<CronInput
								bind:value={cronInputValue}
								fixed={true}
								minIntervalMinutes={60}
								onWarning={(msg) => alertStore.add('warning', msg)}
							/>
						</div>

						<!-- Run status + Run Now (right-aligned together) -->
						<div class="col-span-2 flex flex-wrap items-center gap-3 md:ml-auto">
							{#if cleanupSettings?.lastRunAt}
								<div
									class="flex flex-wrap items-center gap-3 border-t border-neutral-200 pt-3 text-xs text-neutral-500 md:border-0 md:pt-0 dark:border-neutral-700 dark:text-neutral-400"
								>
									{#if cleanupTimeUntilNext !== null && cleanupTimeUntilNext <= 0}
										<span
											class="rounded bg-green-100 px-1.5 py-0.5 font-medium text-green-700 dark:bg-green-900/50 dark:text-green-400"
											>Ready</span
										>
									{:else if cleanupTimeUntilNext !== null}
										<span>
											Next: <span
												class="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
												>{formatTimeRemaining(cleanupTimeUntilNext)}</span
											>
										</span>
									{/if}
									<span>
										Last: <span
											class="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
											>{formatLastRun(cleanupSettings.lastRunAt)}</span
										>
									</span>
								</div>
							{/if}
							<Button
								text="Run Now"
								icon={Eraser}
								iconColor="text-amber-600 dark:text-amber-400"
								on:click={() => (showCleanupModal = true)}
							/>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Hidden save form -->
<form
	id="save-form"
	method="POST"
	action={mode === 'edit' ? '?/update' : undefined}
	class="hidden"
	use:enhance={() => {
		saving = true;
		return async ({ result, update: formUpdate }) => {
			if (result.type === 'redirect') {
				// For create mode, clear dirty state before redirect
				clear();
				alertStore.add(
					'success',
					'Arr instance configured! Visit the Settings tab to adjust library refresh intervals, cleanup, and more.'
				);
			}
			await formUpdate({ reset: false });
			saving = false;
		};
	}}
>
	<input type="hidden" name="name" value={name} />
	<input type="hidden" name="type" value={type} />
	<input type="hidden" name="url" value={url} />
	<input type="hidden" name="api_key" value={apiKey} />
	<input type="hidden" name="enabled" value={enabled === 'true' ? '1' : '0'} />
	<input type="hidden" name="tags" value={JSON.stringify(tags)} />
	<input type="hidden" name="library_refresh_interval" value={libraryRefreshInterval} />
</form>

<!-- Hidden delete form (edit mode only) -->
{#if mode === 'edit'}
	<form
		id="delete-form"
		method="POST"
		action="?/delete"
		class="hidden"
		use:enhance={() => {
			deleting = true;
			return async ({ result, update }) => {
				if (result.type === 'failure' && result.data) {
					alertStore.add('error', (result.data as { error?: string }).error || 'Failed to delete');
				} else if (result.type === 'redirect') {
					alertStore.add('success', 'Instance deleted successfully');
				}
				await update();
				deleting = false;
			};
		}}
	></form>
{/if}

<!-- Delete Confirmation Modal -->
{#if mode === 'edit'}
	<Modal
		open={showDeleteModal}
		header="Delete Instance"
		bodyMessage={`Are you sure you want to delete "${instance?.name}"? This action cannot be undone.`}
		confirmText="Delete"
		cancelText="Cancel"
		confirmDanger={true}
		on:confirm={() => {
			showDeleteModal = false;
			const deleteForm = document.getElementById('delete-form');
			if (deleteForm instanceof HTMLFormElement) {
				deleteForm.requestSubmit();
			}
		}}
		on:cancel={() => (showDeleteModal = false)}
	/>
{/if}

<DirtyModal />

<!-- Cleanup Modal (edit mode only) -->
{#if mode === 'edit' && instance}
	<CleanupModal bind:open={showCleanupModal} instanceId={instance.id} instanceType={type} />
{/if}
