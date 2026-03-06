<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { tick } from 'svelte';
	import StickyCard from '$ui/card/StickyCard.svelte';
	import Button from '$ui/button/Button.svelte';
	import Modal from '$ui/modal/Modal.svelte';
	import InfoModal from '$ui/modal/InfoModal.svelte';
	import SyncPromptModal from '$ui/modal/SyncPromptModal.svelte';
	import FormInput from '$ui/form/FormInput.svelte';
	import Toggle from '$ui/toggle/Toggle.svelte';
	import DropdownSelect from '$ui/dropdown/DropdownSelect.svelte';
	import { alertStore } from '$alerts/store';
	import { Save, Trash2, Info } from 'lucide-svelte';
	import { current, isDirty, initEdit, initCreate, update } from '$lib/client/stores/dirty';
	import type { RadarrNamingRow } from '$shared/pcd/display.ts';
	import type { AffectedArr } from '$shared/sync/types.ts';
	import {
		RADARR_COLON_REPLACEMENT_OPTIONS,
		type RadarrColonReplacementFormat
	} from '$shared/pcd/mediaManagement.ts';
	import { resolveRadarrFormat, getRadarrTokenCategories } from '$shared/pcd/namingTokens.ts';
	import NamingPreview from './NamingPreview.svelte';

	import TokenAutocomplete from './TokenAutocomplete.svelte';

	interface RadarrNamingFormData {
		name: string;
		rename: boolean;
		movieFormat: string;
		movieFolderFormat: string;
		replaceIllegalCharacters: boolean;
		colonReplacementFormat: RadarrColonReplacementFormat;
		[key: string]: unknown;
	}

	export let mode: 'create' | 'edit';
	export let databaseName: string;
	export let canWriteToBase: boolean = false;
	export let actionUrl: string = '';
	export let breadcrumbItems: { label: string; href: string }[] = [];
	export let breadcrumbCurrent: string = '';
	export let initialData: RadarrNamingRow | null;

	const defaults: RadarrNamingFormData = {
		name: '',
		rename: true,
		movieFormat: '{Movie Title} ({Release Year}) {Quality Full}',
		movieFolderFormat: '{Movie Title} ({Release Year})',
		replaceIllegalCharacters: true,
		colonReplacementFormat: 'delete'
	};

	function mapToFormData(data: RadarrNamingRow | null): RadarrNamingFormData {
		if (!data) return defaults;
		return {
			name: data.name,
			rename: data.rename,
			movieFormat: data.movie_format,
			movieFolderFormat: data.movie_folder_format,
			replaceIllegalCharacters: data.replace_illegal_characters,
			colonReplacementFormat: data.colon_replacement_format
		};
	}

	if (mode === 'create') {
		initCreate(mapToFormData(initialData));
	} else {
		initEdit(mapToFormData(initialData));
	}

	$: formData = $current as RadarrNamingFormData;

	let saving = false;
	let deleting = false;
	let showDeleteModal = false;
	let showInfoModal = false;
	let showSyncModal = false;
	let pendingRedirectTo = '';
	let pendingAffectedArrs: AffectedArr[] = [];
	let selectedLayer: 'user' | 'base' = canWriteToBase ? 'base' : 'user';
	let mainFormElement: HTMLFormElement;
	let deleteFormElement: HTMLFormElement;

	$: databaseId = parseInt($page.params.databaseId ?? '0', 10);
	let movieFormatInput: HTMLInputElement | HTMLTextAreaElement | null = null;
	let movieFolderFormatInput: HTMLInputElement | HTMLTextAreaElement | null = null;

	const radarrTokenCategories = getRadarrTokenCategories();

	$: title = mode === 'create' ? 'New Radarr Naming Config' : 'Edit Radarr Naming Config';
	$: description =
		mode === 'create'
			? `Create a new Radarr naming configuration for ${databaseName}`
			: `Update Radarr naming configuration`;
	$: isValid = formData.name.trim() !== '';

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
</script>

<StickyCard position="top" {breadcrumbItems} {breadcrumbCurrent}>
	<div slot="left">
		<h1 class="text-xl font-semibold text-neutral-900 dark:text-neutral-50">{title}</h1>
		<p class="text-sm text-neutral-500 dark:text-neutral-400">{description}</p>
	</div>
	<div slot="right" class="flex items-center gap-2">
		<Button
			text="Info"
			icon={Info}
			iconColor="text-blue-600 dark:text-blue-400"
			on:click={() => (showInfoModal = true)}
		/>
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

<div class="mt-6 md:px-4">
	<div
		class="space-y-6 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
	>
		<!-- Basic Info -->
		<div class="space-y-4">
			<h2 class="text-base font-semibold text-neutral-900 dark:text-neutral-100">Basic Info</h2>
			<FormInput
				label="Name"
				name="name"
				required
				value={formData.name}
				placeholder="e.g., default"
				on:input={(e) => update('name', e.detail)}
			/>

			<div class="space-y-2">
				<Toggle
					checked={formData.rename}
					label="Rename Movies"
					ariaLabel="Rename Movies"
					color={formData.rename ? 'green' : 'neutral'}
					on:change={(e) => update('rename', e.detail)}
				/>
				<p class="text-xs text-neutral-500 dark:text-neutral-400">
					Rename movie files to match the naming format
				</p>
			</div>
		</div>

		{#if formData.rename}
			<hr class="border-neutral-200 dark:border-neutral-700" />

			<!-- Naming Formats -->
			<div class="space-y-4">
				<h2 class="text-base font-semibold text-neutral-900 dark:text-neutral-100">
					Naming Formats
				</h2>
				<div>
					<TokenAutocomplete
						label="Movie Format"
						name="movieFormat"
						value={formData.movieFormat}
						placeholder="e.g., Movie Title (Year) Quality"
						categories={radarrTokenCategories}
						bind:inputElement={movieFormatInput}
						on:input={(e) => update('movieFormat', e.detail)}
					/>
					<NamingPreview format={formData.movieFormat} resolver={resolveRadarrFormat} />
				</div>

				<div>
					<TokenAutocomplete
						label="Movie Folder Format"
						name="movieFolderFormat"
						value={formData.movieFolderFormat}
						placeholder="e.g., Movie Title (Year)"
						categories={radarrTokenCategories}
						bind:inputElement={movieFolderFormatInput}
						on:input={(e) => update('movieFolderFormat', e.detail)}
					/>
					<NamingPreview format={formData.movieFolderFormat} resolver={resolveRadarrFormat} />
				</div>
			</div>

			<hr class="border-neutral-200 dark:border-neutral-700" />

			<!-- Character Replacement -->
			<div class="space-y-4">
				<h2 class="text-base font-semibold text-neutral-900 dark:text-neutral-100">
					Character Replacement
				</h2>

				<div class="space-y-2">
					<Toggle
						checked={formData.replaceIllegalCharacters}
						label="Replace Illegal Characters"
						ariaLabel="Replace Illegal Characters"
						color={formData.replaceIllegalCharacters ? 'green' : 'neutral'}
						on:change={(e) => update('replaceIllegalCharacters', e.detail)}
					/>
					<p class="text-xs text-neutral-500 dark:text-neutral-400">
						Replace characters that are not allowed in file names
					</p>
				</div>

				{#if formData.replaceIllegalCharacters}
					<DropdownSelect
						label="Colon Replacement"
						value={formData.colonReplacementFormat}
						options={RADARR_COLON_REPLACEMENT_OPTIONS}
						on:change={(e) => update('colonReplacementFormat', e.detail)}
					/>
				{/if}
			</div>
		{/if}
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
						mode === 'create' ? 'Naming config created!' : 'Naming config updated!'
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
					mode === 'create' ? 'Naming config created!' : 'Naming config updated!'
				);
				initEdit(formData);
			}
			await formUpdate();
			saving = false;
		};
	}}
>
	<input type="hidden" name="arrType" value="radarr" />
	<input type="hidden" name="name" value={formData.name} />
	<input type="hidden" name="rename" value={formData.rename} />
	<input type="hidden" name="movieFormat" value={formData.movieFormat} />
	<input type="hidden" name="movieFolderFormat" value={formData.movieFolderFormat} />
	<input type="hidden" name="replaceIllegalCharacters" value={formData.replaceIllegalCharacters} />
	<input type="hidden" name="colonReplacementFormat" value={formData.colonReplacementFormat} />
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
					alertStore.add('success', 'Naming config deleted');
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
	header="Delete Radarr naming config"
	bodyMessage="This will remove the naming config and write a delete op. You can recreate it later if needed."
	confirmText="Delete"
	cancelText="Cancel"
	confirmDanger={true}
	confirmDisabled={deleting}
	loading={deleting}
	on:confirm={handleDeleteConfirm}
	on:cancel={handleDeleteCancel}
/>

<InfoModal bind:open={showInfoModal} header="Radarr Naming Configuration">
	<div class="space-y-4 text-sm text-neutral-600 dark:text-neutral-400">
		<div>
			<div class="font-medium text-neutral-900 dark:text-neutral-100">Format Strings</div>
			<p class="mt-1">
				Format strings control how Radarr names movie files and folders. Use tokens like
				<code class="rounded bg-neutral-100 px-1 py-0.5 font-mono text-xs dark:bg-neutral-800"
					>{'{Movie Title}'}</code
				>
				and
				<code class="rounded bg-neutral-100 px-1 py-0.5 font-mono text-xs dark:bg-neutral-800"
					>{'{Release Year}'}</code
				>
				to build your naming pattern.
			</p>
		</div>
		<div>
			<div class="font-medium text-neutral-900 dark:text-neutral-100">Token Autocomplete</div>
			<p class="mt-1">
				Type <code class="rounded bg-neutral-100 px-1 py-0.5 font-mono text-xs dark:bg-neutral-800"
					>{'{'}</code
				> in any format field to open the token picker. Filter by typing, then use arrow keys and Enter
				or click to insert.
			</p>
		</div>
		<div>
			<div class="font-medium text-neutral-900 dark:text-neutral-100">Live Preview</div>
			<p class="mt-1">
				A preview line below each format field shows how your pattern resolves with sample data, so
				you can see the result as you type.
			</p>
		</div>
		<div>
			<div class="font-medium text-neutral-900 dark:text-neutral-100">Character Replacement</div>
			<p class="mt-1">
				When enabled, illegal filesystem characters are replaced automatically. The colon
				replacement option controls how colons specifically are handled (deleted, replaced with a
				dash, space, etc.).
			</p>
		</div>
	</div>
</InfoModal>

<!-- Sync Prompt Modal -->
<SyncPromptModal
	bind:open={showSyncModal}
	redirectTo={pendingRedirectTo}
	affectedArrs={pendingAffectedArrs}
	entityType="naming"
	{databaseId}
	entityName={formData.name.trim()}
/>
