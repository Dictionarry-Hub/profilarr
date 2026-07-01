<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { enhance } from '$app/forms';
	import { Save, Wifi, Trash2, Eraser, Loader2 } from 'lucide-svelte';
	import { formatSmartDateTime } from '$shared/utils/dates';
	import { dateFormat } from '$lib/client/stores/dateFormat';
	import { serverTimezone } from '$lib/client/stores/timezone';
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
				externalUrl: instance.external_url ?? '',
				apiKey: '', // Never pre-populate for security
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
				externalUrl: '',
				apiKey: '',
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
	$: externalUrl = ($current.externalUrl ?? '') as string;
	$: apiKey = ($current.apiKey ?? '') as string;
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
			const response = await fetch('/arr/validate', {
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
				const response = await fetch('/arr/validate', {
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
				externalUrl,
				apiKey: '',
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
</script>

<StickyCard position="top">
	<svelte:fragment slot="left">
		<h1 class="text-text">{title}</h1>
		<p class="text-text-soft">{description}</p>
	</svelte:fragment>
	<svelte:fragment slot="right">
		{#if mode === 'edit'}
			<Button
				text="Delete"
				icon={Trash2}
				iconColor="text-danger-icon "
				disabled={saving || deleting}
				on:click={() => (showDeleteModal = true)}
			/>
		{/if}
		<div data-onboarding="arr-save">
			<Button
				text={saving ? 'Saving...' : 'Save'}
				icon={Save}
				iconColor="text-info-icon "
				disabled={saving || !canSubmit}
				on:click={handleSave}
			/>
		</div>
	</svelte:fragment>
</StickyCard>

<div class="mt-4 space-y-6">
	<div class="space-y-4 rounded-card border border-border bg-surface p-4">
		<!-- Name, URL, API Key -->
		<div data-onboarding="arr-connection" class="space-y-4">
			<div class="space-y-2">
				<div class="flex items-center gap-4">
					<div class="min-w-0 flex-[12] text-sm font-medium text-text">
						Name<span class="text-danger-icon">*</span>
					</div>
					<div class="flex-1 text-right text-sm font-medium text-text">
						Type{#if mode === 'create'}<span class="text-danger-icon">*</span>{/if}
					</div>
				</div>
				<div class="flex items-center gap-4">
					<p class="min-w-0 flex-1 text-xs text-text-soft">
						The display name for this Arr instance
					</p>
					<p class="flex-1 text-right text-xs text-text-soft">
						Type cannot be changed after creation
					</p>
				</div>
				<div class="flex items-end gap-4">
					<div class="min-w-0 flex-[12]">
						<FormInput
							label="Name"
							name="name"
							value={name}
							placeholder="e.g., Main Radarr, 4K Sonarr"
							required
							hideLabel
							on:input={(e) => update('name', e.detail)}
						/>
					</div>
					<div class="min-w-0 flex-1" data-onboarding="arr-type">
						<DropdownSelect
							value={type}
							options={typeOptions}
							placeholder="Select type..."
							disabled={mode === 'edit'}
							fullWidth
							on:change={(e) => update('type', e.detail)}
						/>
					</div>
				</div>
			</div>
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
			<!-- External URL Row -->
			<FormInput
				label="External URL"
				name="external_url"
				type="url"
				value={externalUrl}
				placeholder="https://radarr.example.com"
				description="Optional. Used for 'Open in Radarr/Sonarr' browser links. Leave blank to reuse the URL above. Set this when Profilarr reaches the instance internally but users reach it through a reverse proxy."
				on:input={(e) => update('externalUrl', e.detail)}
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
			<span class="block text-sm font-medium text-text"> Tags </span>
			<p class="text-xs text-text-muted">Press Enter to add a tag, Backspace to remove</p>
			<TagInput {tags} on:change={(e) => update('tags', JSON.stringify(e.detail))} />
		</div>
		<!-- Library Refresh (edit mode only) -->
		{#if mode === 'edit' && instance}
			<div class="space-y-2">
				<span class="block text-sm font-medium text-text"> Library Refresh </span>
				<p class="text-xs text-text-muted">
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
				<span class="block text-sm font-medium text-text"> Cleanup </span>
				<p class="text-xs text-text-muted">
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
							<span class="mb-1 block text-sm text-text-muted md:hidden">Schedule</span>
							<span class="hidden text-sm text-text-muted md:inline">Schedule:</span>
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
									class="flex flex-wrap items-center gap-3 border-t border-border pt-3 text-xs text-text-muted md:border-0 md:pt-0"
								>
									{#if cleanupTimeUntilNext !== null && cleanupTimeUntilNext <= 0}
										<span
											class="rounded-control-sm bg-success-bg px-1.5 py-0.5 font-medium text-success-text"
											>Ready</span
										>
									{:else if cleanupTimeUntilNext !== null}
										<span>
											Next: <span
												class="rounded-control-sm bg-surface-hover px-1.5 py-0.5 font-mono text-text-soft"
												>{formatTimeRemaining(cleanupTimeUntilNext)}</span
											>
										</span>
									{/if}
									<span>
										Last: <span
											class="rounded-control-sm bg-surface-hover px-1.5 py-0.5 font-mono text-text-soft"
											>{formatSmartDateTime(
												cleanupSettings.lastRunAt,
												$serverTimezone,
												$dateFormat
											)}</span
										>
									</span>
								</div>
							{/if}
							<Button
								text="Run Now"
								icon={Eraser}
								iconColor="text-warning-icon "
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
	<input type="hidden" name="external_url" value={externalUrl} />
	<input type="hidden" name="api_key" value={apiKey} />
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
