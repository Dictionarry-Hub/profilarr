<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { tick } from 'svelte';
	import { Save, Loader2, Trash2 } from 'lucide-svelte';
	import FormInput from '$ui/form/FormInput.svelte';
	import MarkdownInput from '$ui/form/MarkdownInput.svelte';
	import TagInput from '$ui/form/TagInput.svelte';
	import Toggle from '$ui/toggle/Toggle.svelte';
	import Modal from '$ui/modal/Modal.svelte';
	import SyncPromptModal from '$ui/modal/SyncPromptModal.svelte';
	import StickyCard from '$ui/card/StickyCard.svelte';
	import Button from '$ui/button/Button.svelte';
	import { alertStore } from '$alerts/store';
	import { current, isDirty, initEdit, initCreate, update } from '$lib/client/stores/dirty';
	import type { AffectedArr } from '$shared/sync/types.ts';

	// Form data shape
	interface GeneralFormData {
		[key: string]: unknown;
		name: string;
		tags: string[];
		description: string;
		includeInRename: boolean;
	}

	// Props
	export let mode: 'create' | 'edit';
	export let canWriteToBase: boolean = false;
	export let actionUrl: string = '';
	export let initialData: GeneralFormData;

	// Event handlers
	export let onCancel: (() => void) | undefined = undefined;

	const defaults: GeneralFormData = {
		name: '',
		tags: [],
		description: '',
		includeInRename: false
	};

	if (mode === 'create') {
		initCreate(initialData ?? defaults);
	} else {
		initEdit(initialData);
	}

	// Loading states
	let saving = false;
	let deleting = false;

	// Layer selection
	let selectedLayer: 'user' | 'base' = canWriteToBase ? 'base' : 'user';
	let deleteLayer: 'user' | 'base' = canWriteToBase ? 'base' : 'user';

	// Modal state
	let showDeleteConfirmModal = false;
	let showSyncModal = false;
	let pendingRedirectTo = '';
	let pendingAffectedArrs: AffectedArr[] = [];
	let mainFormElement: HTMLFormElement;
	let deleteFormElement: HTMLFormElement;

	$: databaseId = parseInt($page.params.databaseId ?? '0', 10);

	// Display text based on mode
	$: title = mode === 'create' ? 'New Custom Format' : 'General';
	$: description_ =
		mode === 'create'
			? `After saving, you'll be able to add conditions and tests.`
			: `Update custom format settings`;
	$: submitButtonText = mode === 'create' ? 'Create' : 'Save Changes';

	// Reactive getters for current values
	$: name = ($current.name ?? '') as string;
	$: tags = ($current.tags ?? []) as string[];
	$: description = ($current.description ?? '') as string;
	$: includeInRename = ($current.includeInRename ?? false) as boolean;

	// Validation
	$: isValid = name.trim() !== '';

	async function handleSaveClick() {
		selectedLayer = canWriteToBase ? 'base' : 'user';
		await tick();
		mainFormElement?.requestSubmit();
	}

	function handleDeleteClick() {
		showDeleteConfirmModal = true;
	}

	async function handleDeleteConfirm() {
		showDeleteConfirmModal = false;
		deleteLayer = canWriteToBase ? 'base' : 'user';
		await tick();
		deleteFormElement?.requestSubmit();
	}
</script>

<div class="space-y-6">
	<!-- Header with actions -->
	<StickyCard position="top">
		<svelte:fragment slot="left">
			<h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{title}</h2>
			<p class="text-sm text-neutral-600 dark:text-neutral-400">{description_}</p>
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
				{#if onCancel}
					<Button text="Cancel" on:click={onCancel} />
				{/if}
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
							mode === 'create' ? 'Custom format created!' : 'Custom format updated!'
						);
						initEdit($current as GeneralFormData);
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
						mode === 'create' ? 'Custom format created!' : 'Custom format updated!'
					);
					initEdit($current as GeneralFormData);
				}
				await formUpdate();
				saving = false;
			};
		}}
	>
		<!-- Hidden fields for form data -->
		<input type="hidden" name="tags" value={JSON.stringify(tags)} />
		<input type="hidden" name="layer" value={selectedLayer} />
		<input type="hidden" name="includeInRename" value={includeInRename} />

		<div class="space-y-6">
			<!-- Name -->
			<FormInput
				label="Name"
				name="name"
				value={name}
				required
				description="The name of this custom format"
				placeholder="Enter custom format name"
				on:input={(e) => update('name', e.detail)}
			/>

			<!-- Description -->
			<MarkdownInput
				id="description"
				name="description"
				label="Description"
				description="Add any notes or details about this custom format's purpose and configuration."
				value={description}
				onchange={(v) => update('description', v)}
			/>

			<!-- Tags -->
			<div class="space-y-2">
				<div class="block text-sm font-medium text-neutral-900 dark:text-neutral-100">Tags</div>
				<p class="text-xs text-neutral-600 dark:text-neutral-400">
					Add tags to organize and categorize this custom format.
				</p>
				<TagInput {tags} onchange={(newTags) => update('tags', newTags)} />
			</div>

			<!-- Include In Rename -->
			<div class="space-y-2">
				<div class="block text-sm font-medium text-neutral-900 dark:text-neutral-100">
					Include In Rename
				</div>
				<p class="text-xs text-neutral-600 dark:text-neutral-400">
					When enabled, this custom format's name will be included in the renamed filename.
				</p>
				<Toggle
					checked={includeInRename}
					ariaLabel="Include in rename"
					label={includeInRename ? 'Enabled' : 'Disabled'}
					color="accent"
					on:change={(e) => update('includeInRename', e.detail)}
				/>
			</div>
		</div>
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
						alertStore.add(
							'error',
							(result.data as { error?: string }).error || 'Failed to delete'
						);
					} else if (result.type === 'redirect') {
						alertStore.add('success', 'Custom format deleted');
					}
					await formUpdate();
					deleting = false;
				};
			}}
		>
			<input type="hidden" name="layer" value={deleteLayer} />
		</form>
	{/if}
</div>

<!-- Delete Confirmation Modal -->
{#if mode === 'edit'}
	<Modal
		open={showDeleteConfirmModal}
		header="Delete Custom Format"
		bodyMessage={`Are you sure you want to delete "${name}"? This action cannot be undone.`}
		confirmText="Delete"
		cancelText="Cancel"
		confirmDanger={true}
		on:confirm={handleDeleteConfirm}
		on:cancel={() => (showDeleteConfirmModal = false)}
	/>
{/if}

<!-- Sync Prompt Modal -->
<SyncPromptModal
	bind:open={showSyncModal}
	redirectTo={pendingRedirectTo}
	affectedArrs={pendingAffectedArrs}
	entityType="customFormat"
	{databaseId}
	entityName={name.trim()}
/>
