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
	import type { SonarrNamingRow } from '$shared/pcd/display.ts';
	import type { AffectedArr } from '$shared/sync/types.ts';
	import {
		SONARR_COLON_REPLACEMENT_OPTIONS,
		MULTI_EPISODE_STYLE_OPTIONS,
		type SonarrColonReplacementFormat,
		type MultiEpisodeStyle
	} from '$shared/pcd/mediaManagement.ts';
	import { resolveSonarrFormat, getSonarrTokenCategories } from '$shared/pcd/namingTokens.ts';
	import NamingPreview from './NamingPreview.svelte';

	import TokenAutocomplete from './TokenAutocomplete.svelte';

	interface SonarrNamingFormData {
		name: string;
		rename: boolean;
		standardEpisodeFormat: string;
		dailyEpisodeFormat: string;
		animeEpisodeFormat: string;
		seriesFolderFormat: string;
		seasonFolderFormat: string;
		replaceIllegalCharacters: boolean;
		colonReplacementFormat: SonarrColonReplacementFormat;
		customColonReplacementFormat: string;
		multiEpisodeStyle: MultiEpisodeStyle;
		[key: string]: unknown;
	}

	export let mode: 'create' | 'edit';
	export let databaseName: string;
	export let canWriteToBase: boolean = false;
	export let actionUrl: string = '';
	export let breadcrumbItems: { label: string; href: string }[] = [];
	export let breadcrumbCurrent: string = '';
	export let initialData: SonarrNamingRow | null;

	const defaults: SonarrNamingFormData = {
		name: '',
		rename: true,
		standardEpisodeFormat:
			'{Series Title} - S{season:00}E{episode:00} - {Episode Title} {Quality Full}',
		dailyEpisodeFormat: '{Series Title} - {Air-Date} - {Episode Title} {Quality Full}',
		animeEpisodeFormat:
			'{Series Title} - S{season:00}E{episode:00} - {Episode Title} {Quality Full}',
		seriesFolderFormat: '{Series Title}',
		seasonFolderFormat: 'Season {season}',
		replaceIllegalCharacters: false,
		colonReplacementFormat: 'delete',
		customColonReplacementFormat: '',
		multiEpisodeStyle: 'extend'
	};

	function mapToFormData(data: SonarrNamingRow | null): SonarrNamingFormData {
		if (!data) return defaults;
		return {
			name: data.name,
			rename: data.rename,
			standardEpisodeFormat: data.standard_episode_format,
			dailyEpisodeFormat: data.daily_episode_format,
			animeEpisodeFormat: data.anime_episode_format,
			seriesFolderFormat: data.series_folder_format,
			seasonFolderFormat: data.season_folder_format,
			replaceIllegalCharacters: data.replace_illegal_characters,
			colonReplacementFormat: data.colon_replacement_format,
			customColonReplacementFormat: data.custom_colon_replacement_format || '',
			multiEpisodeStyle: data.multi_episode_style
		};
	}

	if (mode === 'create') {
		initCreate(mapToFormData(initialData));
	} else {
		initEdit(mapToFormData(initialData));
	}

	$: formData = $current as SonarrNamingFormData;

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
	let standardEpisodeFormatInput: HTMLInputElement | HTMLTextAreaElement | null = null;
	let dailyEpisodeFormatInput: HTMLInputElement | HTMLTextAreaElement | null = null;
	let animeEpisodeFormatInput: HTMLInputElement | HTMLTextAreaElement | null = null;
	let seriesFolderFormatInput: HTMLInputElement | HTMLTextAreaElement | null = null;
	let seasonFolderFormatInput: HTMLInputElement | HTMLTextAreaElement | null = null;

	const sonarrTokenCategories = getSonarrTokenCategories();

	$: title = mode === 'create' ? 'New Sonarr Naming Config' : 'Edit Sonarr Naming Config';
	$: description =
		mode === 'create'
			? `Create a new Sonarr naming configuration for ${databaseName}`
			: `Update Sonarr naming configuration`;
	$: isValid = formData.name.trim() !== '';
	$: showCustomColonInput = formData.colonReplacementFormat === 'custom';

	function updateField<K extends keyof SonarrNamingFormData>(
		field: K,
		value: SonarrNamingFormData[K]
	) {
		update<SonarrNamingFormData, K>(field, value);
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
</script>

<StickyCard position="top" {breadcrumbItems} {breadcrumbCurrent} stickyBreadcrumb={false}>
	<div slot="left">
		<h1 class="text-text">{title}</h1>
		<p class="text-text-soft">{description}</p>
	</div>
	<div slot="right" class="flex items-center gap-2">
		<Button
			text="Info"
			icon={Info}
			iconColor="text-info-icon"
			on:click={() => (showInfoModal = true)}
		/>
		{#if mode === 'edit'}
			<Button
				text={deleting ? 'Deleting...' : 'Delete'}
				icon={Trash2}
				iconColor="text-danger-icon"
				disabled={deleting || saving}
				on:click={handleDeleteClick}
			/>
		{/if}
		<Button
			text={saving ? 'Saving...' : mode === 'create' ? 'Create' : 'Save'}
			icon={Save}
			iconColor="text-info-icon"
			disabled={saving || !isValid || !$isDirty}
			on:click={handleSaveClick}
		/>
	</div>
</StickyCard>

<div class="md:px-4">
	<div class="space-y-6">
		<div class="space-y-2">
			<div class="flex items-center justify-between gap-4">
				<div>
					<div class="text-sm font-medium text-text">
						Name<span class="text-danger-icon">*</span>
					</div>
				</div>
				<div class="text-sm font-medium text-text">Rename Episodes</div>
			</div>
			<div class="flex items-center justify-between gap-4">
				<p class="text-xs text-text-soft">The name of this Sonarr naming configuration.</p>
				<p class="text-right text-xs text-text-soft">
					Rename episode files to match the naming format.
				</p>
			</div>
			<div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_14rem] md:items-end">
				<FormInput
					label="Name"
					name="name"
					required
					hideLabel
					value={formData.name}
					placeholder="e.g., default"
					on:input={(e) => updateField('name', e.detail)}
				/>
				<Toggle
					checked={formData.rename}
					label={formData.rename ? 'Enabled' : 'Disabled'}
					ariaLabel="Rename Episodes"
					color={formData.rename ? 'green' : 'neutral'}
					fullWidth
					on:change={(e) => updateField('rename', e.detail)}
				/>
			</div>
		</div>

		<div
			class="space-y-4"
			class:opacity-60={!formData.rename}
			data-onboarding="media-naming-formats"
		>
			<div class="space-y-1">
				<div class="text-sm font-medium text-text">Episode Formats</div>
				<p class="text-xs text-text-soft">
					Control how Sonarr names standard, daily, and anime episodes.
				</p>
			</div>
			<div>
				<TokenAutocomplete
					label="Standard Episode Format"
					name="standardEpisodeFormat"
					value={formData.standardEpisodeFormat}
					categories={sonarrTokenCategories}
					disabled={!formData.rename}
					bind:inputElement={standardEpisodeFormatInput}
					on:input={(e) => updateField('standardEpisodeFormat', e.detail)}
				/>
				<NamingPreview format={formData.standardEpisodeFormat} resolver={resolveSonarrFormat} />
			</div>

			<div>
				<TokenAutocomplete
					label="Daily Episode Format"
					name="dailyEpisodeFormat"
					value={formData.dailyEpisodeFormat}
					categories={sonarrTokenCategories}
					disabled={!formData.rename}
					bind:inputElement={dailyEpisodeFormatInput}
					on:input={(e) => updateField('dailyEpisodeFormat', e.detail)}
				/>
				<NamingPreview format={formData.dailyEpisodeFormat} resolver={resolveSonarrFormat} />
			</div>

			<div>
				<TokenAutocomplete
					label="Anime Episode Format"
					name="animeEpisodeFormat"
					value={formData.animeEpisodeFormat}
					categories={sonarrTokenCategories}
					disabled={!formData.rename}
					bind:inputElement={animeEpisodeFormatInput}
					on:input={(e) => updateField('animeEpisodeFormat', e.detail)}
				/>
				<NamingPreview format={formData.animeEpisodeFormat} resolver={resolveSonarrFormat} />
			</div>
		</div>

		<div class="space-y-4" class:opacity-60={!formData.rename}>
			<div class="space-y-1">
				<div class="text-sm font-medium text-text">Folder Formats</div>
				<p class="text-xs text-text-soft">Control how Sonarr names series and season folders.</p>
			</div>
			<div>
				<TokenAutocomplete
					label="Series Folder Format"
					name="seriesFolderFormat"
					value={formData.seriesFolderFormat}
					categories={sonarrTokenCategories}
					disabled={!formData.rename}
					bind:inputElement={seriesFolderFormatInput}
					on:input={(e) => updateField('seriesFolderFormat', e.detail)}
				/>
				<NamingPreview format={formData.seriesFolderFormat} resolver={resolveSonarrFormat} />
			</div>

			<div>
				<TokenAutocomplete
					label="Season Folder Format"
					name="seasonFolderFormat"
					value={formData.seasonFolderFormat}
					categories={sonarrTokenCategories}
					disabled={!formData.rename}
					bind:inputElement={seasonFolderFormatInput}
					on:input={(e) => updateField('seasonFolderFormat', e.detail)}
				/>
				<NamingPreview format={formData.seasonFolderFormat} resolver={resolveSonarrFormat} />
			</div>
		</div>

		<div class="space-y-2" class:opacity-60={!formData.rename}>
			<div class="space-y-1">
				<div class="text-sm font-medium text-text">Multi-Episode Style</div>
				<p class="text-xs text-text-soft">
					Choose how multi-episode files are represented in generated names.
				</p>
			</div>
			<DropdownSelect
				value={formData.multiEpisodeStyle}
				options={MULTI_EPISODE_STYLE_OPTIONS}
				disabled={!formData.rename}
				on:change={(e) => updateField('multiEpisodeStyle', e.detail as MultiEpisodeStyle)}
			/>
		</div>

		<div
			class="space-y-4"
			class:opacity-60={!formData.rename}
			data-onboarding="media-naming-character-replacement"
		>
			<div class="space-y-1">
				<div class="text-sm font-medium text-text">Character Replacement</div>
				<p class="text-xs text-text-soft">
					Control how illegal filesystem characters are handled in generated names.
				</p>
			</div>

			<div class="space-y-2">
				<Toggle
					checked={formData.replaceIllegalCharacters}
					label="Replace Illegal Characters"
					ariaLabel="Replace Illegal Characters"
					color={formData.replaceIllegalCharacters ? 'green' : 'neutral'}
					disabled={!formData.rename}
					on:change={(e) => updateField('replaceIllegalCharacters', e.detail)}
				/>
				<p class="text-xs text-text-soft">Replace characters that are not allowed in file names.</p>
			</div>

			<div class="space-y-2">
				<div class="text-sm font-medium text-text">Colon Replacement</div>
				<DropdownSelect
					value={formData.colonReplacementFormat}
					options={SONARR_COLON_REPLACEMENT_OPTIONS}
					disabled={!formData.rename || !formData.replaceIllegalCharacters}
					on:change={(e) =>
						updateField('colonReplacementFormat', e.detail as SonarrColonReplacementFormat)}
				/>
			</div>

			{#if showCustomColonInput}
				<FormInput
					label="Custom Replacement"
					name="customColonReplacementFormat"
					value={formData.customColonReplacementFormat}
					placeholder="Enter custom replacement character(s)"
					disabled={!formData.rename || !formData.replaceIllegalCharacters}
					on:input={(e) => updateField('customColonReplacementFormat', e.detail)}
				/>
			{/if}
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
	<input type="hidden" name="arrType" value="sonarr" />
	<input type="hidden" name="name" value={formData.name} />
	<input type="hidden" name="rename" value={formData.rename} />
	<input type="hidden" name="standardEpisodeFormat" value={formData.standardEpisodeFormat} />
	<input type="hidden" name="dailyEpisodeFormat" value={formData.dailyEpisodeFormat} />
	<input type="hidden" name="animeEpisodeFormat" value={formData.animeEpisodeFormat} />
	<input type="hidden" name="seriesFolderFormat" value={formData.seriesFolderFormat} />
	<input type="hidden" name="seasonFolderFormat" value={formData.seasonFolderFormat} />
	<input type="hidden" name="replaceIllegalCharacters" value={formData.replaceIllegalCharacters} />
	<input type="hidden" name="colonReplacementFormat" value={formData.colonReplacementFormat} />
	<input
		type="hidden"
		name="customColonReplacementFormat"
		value={formData.customColonReplacementFormat}
	/>
	<input type="hidden" name="multiEpisodeStyle" value={formData.multiEpisodeStyle} />
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
	header="Delete Sonarr naming config"
	bodyMessage="This will remove the naming config and write a delete op. You can recreate it later if needed."
	confirmText="Delete"
	cancelText="Cancel"
	confirmDanger={true}
	confirmDisabled={deleting}
	loading={deleting}
	on:confirm={handleDeleteConfirm}
	on:cancel={handleDeleteCancel}
/>

<InfoModal bind:open={showInfoModal} header="Sonarr Naming Configuration">
	<div class="space-y-4 text-sm text-text-soft">
		<div>
			<div class="font-medium text-text">Format Strings</div>
			<p class="mt-1">
				Format strings control how Sonarr names episode files and folders. Use tokens like
				<code class="rounded-control-sm bg-surface-hover px-1 py-0.5 font-mono text-xs"
					>{'{Series Title}'}</code
				>
				and
				<code class="rounded-control-sm bg-surface-hover px-1 py-0.5 font-mono text-xs"
					>{'{Episode Title}'}</code
				>
				to build your naming pattern. Sonarr has separate formats for standard, daily, and anime episodes.
			</p>
		</div>
		<div>
			<div class="font-medium text-text">Token Autocomplete</div>
			<p class="mt-1">
				Type <code class="rounded-control-sm bg-surface-hover px-1 py-0.5 font-mono text-xs"
					>{'{'}</code
				> in any format field to open the token picker. Filter by typing, then use arrow keys and Enter
				or click to insert.
			</p>
		</div>
		<div>
			<div class="font-medium text-text">Live Preview</div>
			<p class="mt-1">
				A preview line below each format field shows how your pattern resolves with sample data, so
				you can see the result as you type.
			</p>
		</div>
		<div>
			<div class="font-medium text-text">Multi-Episode Style</div>
			<p class="mt-1">
				Controls how multi-episode files are named. "Extend" appends additional episode numbers
				(S01E01-E02), while other styles use different separator patterns.
			</p>
		</div>
		<div>
			<div class="font-medium text-text">Character Replacement</div>
			<p class="mt-1">
				When enabled, illegal filesystem characters are replaced automatically. The colon
				replacement option controls how colons specifically are handled. Sonarr also supports a
				custom replacement string.
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
