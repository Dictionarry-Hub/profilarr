<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { tick } from 'svelte';
	import TagInput from '$ui/form/TagInput.svelte';
	import MarkdownInput from '$ui/form/MarkdownInput.svelte';
	import FormInput from '$ui/form/FormInput.svelte';
	import Modal from '$ui/modal/Modal.svelte';
	import SyncPromptModal from '$ui/modal/SyncPromptModal.svelte';
	import StickyCard from '$ui/card/StickyCard.svelte';
	import Button from '$ui/button/Button.svelte';
	import RegexPatternField from './RegexPatternField.svelte';
	import UnitTests from './UnitTests.svelte';
	import { alertStore } from '$alerts/store';
	import { Save, Trash2, Loader2 } from 'lucide-svelte';
	import { current, isDirty, initEdit, initCreate, update } from '$lib/client/stores/dirty';
	import type { AffectedArr } from '$shared/sync/types.ts';
	import type { Regex101UnitTest } from '../../regex101/types';

	// Form data shape
	interface RegularExpressionFormData {
		name: string;
		tags: string[];
		pattern: string;
		description: string;
		regex101Id: string;
		[key: string]: unknown;
	}

	// Props
	export let mode: 'create' | 'edit';
	export let databaseName: string;
	export let canWriteToBase: boolean = false;
	export let actionUrl: string = '';
	export let initialData: RegularExpressionFormData;

	// Breadcrumb (optional)
	export let breadcrumbItems: { label: string; href: string }[] = [];
	export let breadcrumbCurrent: string = '';

	// Event handlers
	export let onCancel: () => void;

	const defaults: RegularExpressionFormData = {
		name: '',
		tags: [],
		pattern: '',
		description: '',
		regex101Id: ''
	};

	if (mode === 'create') {
		initCreate(initialData ?? defaults);
	} else {
		initEdit(initialData);
	}

	// Typed accessor for current form data
	$: formData = $current as RegularExpressionFormData;

	// Loading states
	let saving = false;
	let deleting = false;

	// Layer selection
	let selectedLayer: 'user' | 'base' = canWriteToBase ? 'base' : 'user';

	// Modal states
	let showDeleteConfirmModal = false;
	let showSyncModal = false;
	let pendingRedirectTo = '';
	let pendingAffectedArrs: AffectedArr[] = [];
	let mainFormElement: HTMLFormElement;
	let deleteFormElement: HTMLFormElement;

	$: databaseId = parseInt($page.params.databaseId ?? '0', 10);

	// Delete layer selection
	let deleteLayer: 'user' | 'base' = canWriteToBase ? 'base' : 'user';

	// Display text based on mode
	$: title = mode === 'create' ? 'New Regular Expression' : 'Edit Regular Expression';
	$: description_ =
		mode === 'create'
			? `Create a new regular expression for ${databaseName}`
			: `Update regular expression settings`;
	$: submitButtonText = mode === 'create' ? 'Create' : 'Save Changes';

	// Unit tests state
	let unitTests: Regex101UnitTest[] = [];
	let unitTestsLoading = false;
	let unitTestsError: string | null = null;
	let lastFetchedRegex101Id: string | null = null;

	$: if (browser && formData.regex101Id && formData.regex101Id !== lastFetchedRegex101Id) {
		fetchUnitTests(formData.regex101Id);
	} else if (!formData.regex101Id) {
		unitTests = [];
		unitTestsError = null;
		lastFetchedRegex101Id = null;
	}

	async function fetchUnitTests(id: string) {
		if (!id.trim()) {
			unitTests = [];
			unitTestsError = null;
			return;
		}

		unitTestsLoading = true;
		unitTestsError = null;

		try {
			const response = await fetch(`/regular-expressions/regex101/${encodeURIComponent(id)}`);
			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.message || `Failed to fetch: ${response.statusText}`);
			}
			const data = await response.json();
			unitTests = data.unitTests || [];
			lastFetchedRegex101Id = id;
		} catch (err) {
			unitTestsError = err instanceof Error ? err.message : 'Failed to fetch unit tests';
			unitTests = [];
		} finally {
			unitTestsLoading = false;
		}
	}

	let patternValidationState: 'idle' | 'checking' | 'valid' | 'invalid' | 'unavailable' = 'idle';

	$: isValid =
		formData.name.trim() !== '' &&
		formData.pattern.trim() !== '' &&
		patternValidationState !== 'invalid';

	$: saveTooltip = patternValidationState === 'invalid' ? 'Pattern is not a valid .NET regex' : '';

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
	<StickyCard position="top" {breadcrumbItems} {breadcrumbCurrent}>
		<svelte:fragment slot="left">
			<div>
				<h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{title}</h2>
				<p class="text-sm text-neutral-600 dark:text-neutral-400">{description_}</p>
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
					tooltip={saveTooltip}
					tooltipPosition="bottom"
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
							mode === 'create' ? 'Regular expression created!' : 'Regular expression updated!'
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
						mode === 'create' ? 'Regular expression created!' : 'Regular expression updated!'
					);
					initEdit(formData);
				}
				await formUpdate();
				saving = false;
			};
		}}
	>
		<!-- Hidden fields for form data -->
		<input type="hidden" name="tags" value={JSON.stringify(formData.tags)} />
		<input type="hidden" name="layer" value={selectedLayer} />

		<div class="space-y-6">
			<!-- Name -->
			<FormInput
				label="Name"
				name="name"
				required
				value={formData.name}
				placeholder="e.g., Release Group - SPARKS"
				on:input={(e) => update('name', e.detail)}
			/>

			<!-- Tags -->
			<div>
				<div class="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Tags</div>
				<p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
					Categorize this pattern for easier filtering
				</p>
				<div class="mt-2">
					<TagInput
						tags={formData.tags}
						onchange={(newTags) => update('tags', newTags)}
						placeholder="Add tags..."
					/>
				</div>
			</div>

			<!-- Description -->
			<div>
				<MarkdownInput
					id="description"
					name="description"
					label="Description"
					description="Describe what this pattern matches"
					value={formData.description}
					onchange={(v) => update('description', v)}
					placeholder="What does this pattern match?"
				/>
			</div>

			<RegexPatternField
				pattern={formData.pattern}
				regex101Id={formData.regex101Id}
				onPatternChange={(v) => update('pattern', v)}
				onRegex101IdChange={(v) => update('regex101Id', v)}
				onValidationStateChange={(s) => (patternValidationState = s)}
			/>
		</div>
	</form>

	<!-- Unit Tests (outside form to avoid button submission issues) -->
	{#if formData.regex101Id}
		<div class="pb-12 md:px-4">
			<h4 class="mb-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
				Unit Tests
				{#if !unitTestsLoading && unitTests.length > 0}
					<span class="ml-1 text-xs font-normal text-neutral-500">({unitTests.length})</span>
				{/if}
			</h4>
			<UnitTests {unitTests} loading={unitTestsLoading} error={unitTestsError} />
		</div>
	{/if}

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
						alertStore.add('success', 'Regular expression deleted');
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

<!-- Delete Confirmation Modal -->
{#if mode === 'edit'}
	<Modal
		open={showDeleteConfirmModal}
		header="Delete Regular Expression"
		bodyMessage={`Are you sure you want to delete "${formData.name}"? This action cannot be undone.`}
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
	entityType="regularExpression"
	{databaseId}
	entityName={formData.name.trim()}
/>
