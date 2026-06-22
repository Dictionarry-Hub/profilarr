<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onDestroy, tick } from 'svelte';
	import StickyCard from '$ui/card/StickyCard.svelte';
	import Button from '$ui/button/Button.svelte';
	import Modal from '$ui/modal/Modal.svelte';
	import SyncPromptModal from '$ui/modal/SyncPromptModal.svelte';
	import FormInput from '$ui/form/FormInput.svelte';
	import Toggle from '$ui/toggle/Toggle.svelte';
	import DropdownSelect from '$ui/dropdown/DropdownSelect.svelte';
	import { alertStore } from '$alerts/store';
	import { Save, Trash2 } from 'lucide-svelte';
	import { current, isDirty, initEdit, initCreate, update } from '$lib/client/stores/dirty';
	import type { RadarrMediaSettingsRow } from '$shared/pcd/display.ts';
	import type { ArrType } from '$shared/pcd/types.ts';
	import { PROPERS_REPACKS_OPTIONS, type PropersRepacks } from '$shared/pcd/mediaManagement.ts';
	import type { AffectedArr } from '$shared/sync/types.ts';

	interface RadarrMediaSettingsRowFormData {
		name: string;
		propersRepacks: PropersRepacks;
		enableMediaInfo: boolean;
		[key: string]: unknown;
	}

	export let mode: 'create' | 'edit';
	export let arrType: ArrType;
	export let databaseName: string;
	export let canWriteToBase: boolean = false;
	export let actionUrl: string = '';
	export let breadcrumbItems: { label: string; href: string }[] = [];
	export let breadcrumbCurrent: string = '';
	export let initialData: RadarrMediaSettingsRow | null;

	const defaults: RadarrMediaSettingsRowFormData = {
		name: '',
		propersRepacks: 'doNotPrefer',
		enableMediaInfo: true
	};
	const PROPERS_REPACKS_CONFIRM_TEXT =
		'I UNDERSTAND THIS CAN BREAK CUSTOM FORMAT SCORING AND CAUSE INCONSISTENT GRAB BEHAVIOR';

	function mapToFormData(data: RadarrMediaSettingsRow | null): RadarrMediaSettingsRowFormData {
		if (!data) return defaults;
		return {
			name: data.name,
			propersRepacks: data.propers_repacks,
			enableMediaInfo: data.enable_media_info
		};
	}

	if (mode === 'create') {
		initCreate(mapToFormData(initialData));
	} else {
		initEdit(mapToFormData(initialData));
	}

	$: formData = $current as RadarrMediaSettingsRowFormData;

	let saving = false;
	let deleting = false;
	let showDeleteModal = false;
	let showSyncModal = false;
	let showPropersRepacksModal = false;
	let pendingRedirectTo = '';
	let pendingAffectedArrs: AffectedArr[] = [];
	let pendingPropersRepacks: PropersRepacks | null = null;
	let propersRepacksConfirmation = '';
	let propersRepacksConfirmationElement: HTMLInputElement | HTMLTextAreaElement | null = null;
	let propersRepacksPasteElement: HTMLInputElement | HTMLTextAreaElement | null = null;
	let selectedLayer: 'user' | 'base' = canWriteToBase ? 'base' : 'user';
	let mainFormElement: HTMLFormElement;
	let deleteFormElement: HTMLFormElement;

	$: databaseId = parseInt($page.params.databaseId ?? '0', 10);

	$: arrLabel = arrType === 'radarr' ? 'Radarr' : 'Sonarr';
	$: title =
		mode === 'create' ? `New ${arrLabel} Media Settings` : `Edit ${arrLabel} Media Settings`;
	$: description =
		mode === 'create'
			? `Create a new ${arrLabel} media settings configuration for ${databaseName}`
			: `Update ${arrLabel} media settings configuration`;
	$: isValid = formData.name.trim() !== '';
	$: propersRepacksDescription =
		PROPERS_REPACKS_OPTIONS.find((o) => o.value === formData.propersRepacks)?.description ?? '';
	$: canConfirmPropersRepacks = propersRepacksConfirmation === PROPERS_REPACKS_CONFIRM_TEXT;
	$: {
		if (propersRepacksConfirmationElement !== propersRepacksPasteElement) {
			propersRepacksPasteElement?.removeEventListener('paste', blockPropersRepacksPaste);
			propersRepacksPasteElement = propersRepacksConfirmationElement;
			propersRepacksPasteElement?.addEventListener('paste', blockPropersRepacksPaste);
		}
	}

	function updateField<K extends keyof RadarrMediaSettingsRowFormData>(
		field: K,
		value: RadarrMediaSettingsRowFormData[K]
	) {
		update<RadarrMediaSettingsRowFormData, K>(field, value);
	}

	function handlePropersRepacksChange(value: PropersRepacks) {
		if (value === formData.propersRepacks) return;
		if (value === 'doNotPrefer') {
			updateField('propersRepacks', value);
			return;
		}

		pendingPropersRepacks = value;
		propersRepacksConfirmation = '';
		showPropersRepacksModal = true;
	}

	function confirmPropersRepacksChange() {
		if (!pendingPropersRepacks || !canConfirmPropersRepacks) return;
		updateField('propersRepacks', pendingPropersRepacks);
		closePropersRepacksModal();
	}

	function closePropersRepacksModal() {
		showPropersRepacksModal = false;
		pendingPropersRepacks = null;
		propersRepacksConfirmation = '';
	}

	function blockPropersRepacksPaste(event: Event) {
		event.preventDefault();
	}

	async function handleSaveClick() {
		if (saving) return;
		saving = true;
		selectedLayer = canWriteToBase ? 'base' : 'user';
		await tick();
		mainFormElement?.requestSubmit();
	}

	async function handleDeleteClick() {
		showDeleteModal = true;
	}

	async function handleDeleteConfirm() {
		selectedLayer = canWriteToBase ? 'base' : 'user';
		showDeleteModal = false;
		await tick();
		deleteFormElement?.requestSubmit();
	}

	function handleDeleteCancel() {
		showDeleteModal = false;
	}

	onDestroy(() => {
		propersRepacksPasteElement?.removeEventListener('paste', blockPropersRepacksPaste);
	});
</script>

<StickyCard position="top" {breadcrumbItems} {breadcrumbCurrent} stickyBreadcrumb={false}>
	<div slot="left">
		<h1 class="text-neutral-900 dark:text-neutral-50">{title}</h1>
		<p class="text-neutral-600 dark:text-neutral-400">{description}</p>
	</div>
	<div slot="right" class="flex items-center gap-2">
		{#if mode === 'edit'}
			<Button
				text={deleting ? 'Deleting...' : 'Delete'}
				icon={Trash2}
				iconColor="text-red-600 dark:text-red-400"
				disabled={deleting || saving}
				on:click={handleDeleteClick}
			/>
		{/if}
		<Button
			text={saving ? 'Saving...' : mode === 'create' ? 'Create' : 'Save'}
			icon={Save}
			iconColor="text-blue-600 dark:text-blue-400"
			disabled={saving || !isValid || !$isDirty}
			on:click={handleSaveClick}
		/>
	</div>
</StickyCard>

<div class="md:px-4">
	<div class="space-y-6">
		<div data-onboarding="media-settings-name">
			<FormInput
				label="Name"
				name="name"
				placeholder="e.g., default"
				required
				description="The name of this media settings configuration."
				value={formData.name}
				on:input={(e) => updateField('name', e.detail)}
			/>
		</div>

		<div class="space-y-2" data-onboarding="media-settings-propers-repacks">
			<div class="space-y-1">
				<div class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
					Propers and Repacks
				</div>
				<p class="text-xs text-neutral-600 dark:text-neutral-400">
					Choose how {arrLabel} handles proper and repack releases.
				</p>
			</div>
			<DropdownSelect
				value={formData.propersRepacks}
				options={PROPERS_REPACKS_OPTIONS}
				fullWidth
				on:change={(e) => handlePropersRepacksChange(e.detail as PropersRepacks)}
			/>
			{#if propersRepacksDescription}
				<p class="text-xs text-neutral-600 dark:text-neutral-400">
					{propersRepacksDescription}
				</p>
			{/if}
		</div>

		<div class="space-y-2" data-onboarding="media-settings-file-analysis">
			<div class="space-y-1">
				<div class="text-sm font-medium text-neutral-900 dark:text-neutral-100">File Analysis</div>
				<p class="text-xs text-neutral-600 dark:text-neutral-400">
					Scan files to extract media information such as codec, resolution, and audio tracks.
				</p>
			</div>
			<Toggle
				label="Enable Media Info"
				checked={formData.enableMediaInfo}
				on:change={() => updateField('enableMediaInfo', !formData.enableMediaInfo)}
			/>
		</div>
	</div>
</div>

<!-- Hidden save form -->
<form
	bind:this={mainFormElement}
	method="POST"
	action={actionUrl}
	class="hidden"
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
						mode === 'create' ? 'Media settings created!' : 'Media settings updated!'
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
					mode === 'create' ? 'Media settings created!' : 'Media settings updated!'
				);
				initEdit(formData);
			}
			await formUpdate();
			saving = false;
		};
	}}
>
	<input type="hidden" name="arrType" value={arrType} />
	<input type="hidden" name="name" value={formData.name} />
	<input type="hidden" name="propersRepacks" value={formData.propersRepacks} />
	<input type="hidden" name="enableMediaInfo" value={formData.enableMediaInfo} />
	<input type="hidden" name="layer" value={selectedLayer} />
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
			return async ({ result, update: formUpdate }) => {
				if (result.type === 'failure' && result.data) {
					alertStore.add('error', (result.data as { error?: string }).error || 'Failed to delete');
				} else if (result.type === 'redirect') {
					alertStore.add('success', 'Media settings deleted');
				}
				await formUpdate();
				deleting = false;
			};
		}}
	>
		<input type="hidden" name="layer" value={selectedLayer} />
	</form>
{/if}

<Modal
	open={showDeleteModal}
	header={`Delete ${arrLabel} media settings`}
	bodyMessage="This will remove the media settings config and write a delete op. You can recreate it later if needed."
	confirmText="Delete"
	cancelText="Cancel"
	confirmDanger={true}
	confirmDisabled={deleting}
	loading={deleting}
	on:confirm={handleDeleteConfirm}
	on:cancel={handleDeleteCancel}
/>

<Modal
	open={showPropersRepacksModal}
	header="Change propers and repacks"
	confirmText="Change"
	cancelText="Cancel"
	confirmDanger={true}
	confirmDisabled={!canConfirmPropersRepacks}
	on:confirm={confirmPropersRepacksChange}
	on:cancel={closePropersRepacksModal}
>
	<div slot="body" class="space-y-4">
		<p class="text-sm text-neutral-700 dark:text-neutral-300">
			Profilarr expects proper and repack preferences to be handled by custom formats. Changing this
			setting enables Arr's built-in preference system, which can override custom format scores and
			make grab decisions look wrong or inconsistent.
		</p>
		<p class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
			Type <span class="font-mono">{PROPERS_REPACKS_CONFIRM_TEXT}</span> to continue.
		</p>
		<FormInput
			label="Confirmation"
			name="propers-repacks-confirmation"
			value={propersRepacksConfirmation}
			placeholder="Type the confirmation text"
			description="Type the confirmation text exactly to unlock this change."
			bind:inputElement={propersRepacksConfirmationElement}
			on:input={(e) => (propersRepacksConfirmation = e.detail)}
		/>
	</div>
</Modal>

<!-- Sync Prompt Modal -->
<SyncPromptModal
	bind:open={showSyncModal}
	redirectTo={pendingRedirectTo}
	affectedArrs={pendingAffectedArrs}
	entityType="mediaSettings"
	{databaseId}
	entityName={formData.name.trim()}
/>
