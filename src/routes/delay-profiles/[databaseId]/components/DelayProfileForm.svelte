<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { tick } from 'svelte';
	import NumberInput from '$ui/form/NumberInput.svelte';
	import FormInput from '$ui/form/FormInput.svelte';
	import Toggle from '$ui/toggle/Toggle.svelte';
	import DropdownSelect from '$ui/dropdown/DropdownSelect.svelte';
	import StickyCard from '$ui/card/StickyCard.svelte';
	import Card from '$ui/card/Card.svelte';
	import Button from '$ui/button/Button.svelte';
	import Modal from '$ui/modal/Modal.svelte';
	import SyncPromptModal from '$ui/modal/SyncPromptModal.svelte';
	import { alertStore } from '$alerts/store';
	import { Save, Trash2, Loader2 } from 'lucide-svelte';
	import type { PreferredProtocol } from '$shared/pcd/display.ts';
	import { current, isDirty, initEdit, initCreate, update } from '$lib/client/stores/dirty';
	import type { AffectedArr } from '$shared/sync/types.ts';

	// Form data shape
	interface DelayProfileFormData {
		name: string;
		preferredProtocol: PreferredProtocol;
		usenetDelay: number;
		torrentDelay: number;
		bypassIfHighestQuality: boolean;
		bypassIfAboveCfScore: boolean;
		minimumCfScore: number;
		[key: string]: unknown;
	}

	// Props
	export let mode: 'create' | 'edit';
	export let databaseName: string;
	export let canWriteToBase: boolean = false;
	export let actionUrl: string = '';
	export let breadcrumbItems: { label: string; href: string }[] = [];
	export let breadcrumbCurrent: string = '';
	export let initialData: DelayProfileFormData;

	// Event handlers
	export let onCancel: () => void;

	const defaults: DelayProfileFormData = {
		name: '',
		preferredProtocol: 'prefer_usenet',
		usenetDelay: 0,
		torrentDelay: 0,
		bypassIfHighestQuality: false,
		bypassIfAboveCfScore: false,
		minimumCfScore: 0
	};

	if (mode === 'create') {
		initCreate(initialData ?? defaults);
	} else {
		initEdit(initialData);
	}

	// Typed accessor for current form data
	$: formData = $current as DelayProfileFormData;

	// Loading states
	let saving = false;
	let deleting = false;
	let showDeleteModal = false;

	// Layer selection
	let selectedLayer: 'user' | 'base' = canWriteToBase ? 'base' : 'user';

	// Modal states
	let showSyncModal = false;
	let pendingRedirectTo = '';
	let pendingAffectedArrs: AffectedArr[] = [];
	let mainFormElement: HTMLFormElement;
	let deleteFormElement: HTMLFormElement;

	$: databaseId = parseInt($page.params.databaseId ?? '0', 10);

	// Delete layer selection
	let deleteLayer: 'user' | 'base' = canWriteToBase ? 'base' : 'user';

	// Display text based on mode
	$: title = mode === 'create' ? 'New Delay Profile' : 'Edit Delay Profile';
	$: description =
		mode === 'create'
			? `Create a new delay profile for ${databaseName}`
			: `Update delay profile settings`;
	$: submitButtonText = mode === 'create' ? 'Create Profile' : 'Save Changes';

	// Computed states based on protocol
	$: usenetEnabled = formData.preferredProtocol !== 'only_torrent';
	$: torrentEnabled = formData.preferredProtocol !== 'only_usenet';

	const protocolOptions: { value: PreferredProtocol; label: string; description: string }[] = [
		{
			value: 'prefer_usenet',
			label: 'Prefer Usenet',
			description: 'Try Usenet first, fall back to Torrent'
		},
		{
			value: 'prefer_torrent',
			label: 'Prefer Torrent',
			description: 'Try Torrent first, fall back to Usenet'
		},
		{ value: 'only_usenet', label: 'Only Usenet', description: 'Never use Torrent' },
		{ value: 'only_torrent', label: 'Only Torrent', description: 'Never use Usenet' }
	];

	$: isValid = formData.name.trim() !== '';
	$: protocolDescription =
		protocolOptions.find((o) => o.value === formData.preferredProtocol)?.description ?? '';

	async function handleSaveClick() {
		selectedLayer = canWriteToBase ? 'base' : 'user';
		await tick();
		mainFormElement?.requestSubmit();
	}

	async function handleDeleteClick() {
		showDeleteModal = true;
	}

	async function handleDeleteConfirm() {
		deleteLayer = canWriteToBase ? 'base' : 'user';
		showDeleteModal = false;
		await tick();
		deleteFormElement?.requestSubmit();
	}

	function handleDeleteCancel() {
		showDeleteModal = false;
	}
</script>

<div class="space-y-6">
	<StickyCard position="top" {breadcrumbItems} {breadcrumbCurrent}>
		<svelte:fragment slot="left">
			<div>
				<h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{title}</h2>
				<p class="text-sm text-neutral-600 dark:text-neutral-400">{description}</p>
			</div>
		</svelte:fragment>
		<svelte:fragment slot="right">
			<div class="flex items-center gap-2">
				{#if mode === 'edit'}
					<Button
						disabled={deleting}
						icon={deleting ? Loader2 : Trash2}
						iconColor="text-red-600 dark:text-red-400"
						text={deleting ? 'Deleting...' : 'Delete'}
						on:click={handleDeleteClick}
					/>
				{/if}
				<Button text="Cancel" on:click={onCancel} />
				<Button
					disabled={saving || !isValid || !$isDirty}
					icon={saving ? Loader2 : Save}
					iconColor="text-blue-600 dark:text-blue-400"
					text={saving ? (mode === 'create' ? 'Creating...' : 'Saving...') : submitButtonText}
					on:click={handleSaveClick}
				/>
			</div>
		</svelte:fragment>
	</StickyCard>

	<form
		bind:this={mainFormElement}
		method="POST"
		action={actionUrl}
		class="md:px-4"
		use:enhance={() => {
			saving = true;
			return async ({ result, update: formUpdate }) => {
				if (result.type === 'failure' && result.data) {
					alertStore.add('error', (result.data as { error?: string }).error || 'Operation failed');
				} else if (result.type === 'success' && result.data) {
					const data = result.data as {
						success?: boolean;
						redirectTo?: string;
						affectedArrs?: AffectedArr[];
					};
					if (data.success) {
						alertStore.add(
							'success',
							mode === 'create' ? 'Delay profile created!' : 'Delay profile updated!'
						);
						initEdit(formData);
						if (data.affectedArrs && data.affectedArrs.length > 0) {
							pendingRedirectTo = data.redirectTo || '';
							pendingAffectedArrs = data.affectedArrs;
							showSyncModal = true;
						} else {
							goto(data.redirectTo || '');
						}
						saving = false;
						return;
					}
				} else if (result.type === 'redirect') {
					alertStore.add(
						'success',
						mode === 'create' ? 'Delay profile created!' : 'Delay profile updated!'
					);
					initEdit(formData);
				}
				await formUpdate();
				saving = false;
			};
		}}
	>
		<!-- Hidden fields for form data -->
		<input type="hidden" name="preferredProtocol" value={formData.preferredProtocol} />
		<input type="hidden" name="usenetDelay" value={formData.usenetDelay} />
		<input type="hidden" name="torrentDelay" value={formData.torrentDelay} />
		<input type="hidden" name="bypassIfHighestQuality" value={formData.bypassIfHighestQuality} />
		<input type="hidden" name="bypassIfAboveCfScore" value={formData.bypassIfAboveCfScore} />
		<input type="hidden" name="minimumCfScore" value={formData.minimumCfScore} />
		<input type="hidden" name="layer" value={selectedLayer} />

		<Card flush padding="lg">
			<div class="space-y-6">
				<!-- Name -->
				<div data-onboarding="delay-general-name">
					<FormInput
						label="Name"
						name="name"
						placeholder="e.g., Standard Delay"
						required
						value={formData.name}
						on:input={(e) => update('name', e.detail)}
					/>
				</div>

				<!-- Protocol Preference -->
				<div class="space-y-2" data-onboarding="delay-general-protocol">
					<h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
						Protocol Preference
					</h3>
					<DropdownSelect
						value={formData.preferredProtocol}
						options={protocolOptions}
						fullWidth
						on:change={(e) => update('preferredProtocol', e.detail)}
					/>
					{#if protocolDescription}
						<p class="text-xs text-neutral-500 dark:text-neutral-400">
							{protocolDescription}
						</p>
					{/if}
				</div>

				<!-- Delays -->
				<div data-onboarding="delay-general-delays">
					<h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Delays</h3>
					<p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
						Time to wait before downloading from each source. Set to 0 for no delay.
					</p>
					<div class="mt-3 grid gap-4 sm:grid-cols-2">
						<div>
							<label
								for="usenet-delay"
								class="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
							>
								Usenet Delay (minutes)
							</label>
							<div class="mt-1">
								<NumberInput
									name="usenet-delay"
									id="usenet-delay"
									value={formData.usenetDelay}
									onchange={(v) => update('usenetDelay', v)}
									min={0}
									font="mono"
									disabled={!usenetEnabled}
								/>
							</div>
						</div>

						<div>
							<label
								for="torrent-delay"
								class="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
							>
								Torrent Delay (minutes)
							</label>
							<div class="mt-1">
								<NumberInput
									name="torrent-delay"
									id="torrent-delay"
									value={formData.torrentDelay}
									onchange={(v) => update('torrentDelay', v)}
									min={0}
									font="mono"
									disabled={!torrentEnabled}
								/>
							</div>
						</div>
					</div>
				</div>

				<!-- Bypass Conditions -->
				<div data-onboarding="delay-general-bypass">
					<h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
						Bypass Conditions
					</h3>
					<p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
						Skip the delay when these conditions are met.
					</p>
					<div class="mt-3 space-y-3">
						<div>
							<Toggle
								label="Bypass if Highest Quality"
								checked={formData.bypassIfHighestQuality}
								fullWidth
								on:change={() => update('bypassIfHighestQuality', !formData.bypassIfHighestQuality)}
							/>
							<p class="mt-1 px-3 text-xs text-neutral-500 dark:text-neutral-400">
								Skip delay when release is already the highest quality in profile
							</p>
						</div>

						<div>
							<div class="grid grid-cols-1 items-center gap-3 sm:grid-cols-2">
								<Toggle
									label="Bypass if Above Custom Format Score"
									checked={formData.bypassIfAboveCfScore}
									fullWidth
									on:change={() => update('bypassIfAboveCfScore', !formData.bypassIfAboveCfScore)}
								/>
								<NumberInput
									name="min-cf-score"
									id="min-cf-score"
									value={formData.minimumCfScore}
									onchange={(v) => update('minimumCfScore', v)}
									disabled={!formData.bypassIfAboveCfScore}
									font="mono"
								/>
							</div>
							<p class="mt-1 px-3 text-xs text-neutral-500 dark:text-neutral-400">
								Skip delay when release exceeds minimum score
							</p>
						</div>
					</div>
				</div>
			</div>
		</Card>
	</form>

	<!-- Hidden delete form -->
	{#if mode === 'edit'}
		<form
			bind:this={deleteFormElement}
			method="POST"
			action="?/delete"
			class="hidden"
			use:enhance={() => {
				deleting = true;
				return async ({ result, update }) => {
					if (result.type === 'failure' && result.data) {
						alertStore.add(
							'error',
							(result.data as { error?: string }).error || 'Failed to delete'
						);
					} else if (result.type === 'redirect') {
						alertStore.add('success', 'Delay profile deleted');
					}
					await update();
					deleting = false;
				};
			}}
		>
			<input type="hidden" name="layer" value={deleteLayer} />
		</form>
	{/if}
</div>

<Modal
	open={showDeleteModal}
	header="Delete delay profile"
	bodyMessage="This will remove the delay profile and write a delete op. You can recreate it later if needed."
	confirmText="Delete"
	cancelText="Cancel"
	confirmDanger={true}
	confirmDisabled={deleting}
	loading={deleting}
	on:confirm={handleDeleteConfirm}
	on:cancel={handleDeleteCancel}
/>

<!-- Sync Prompt Modal -->
<SyncPromptModal
	bind:open={showSyncModal}
	redirectTo={pendingRedirectTo}
	affectedArrs={pendingAffectedArrs}
	entityType="delayProfile"
	{databaseId}
	entityName={formData.name.trim()}
/>
