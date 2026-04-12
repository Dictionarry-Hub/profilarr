<script lang="ts">
	import { enhance } from '$app/forms';
	import { tick, onMount } from 'svelte';
	import { alertStore } from '$alerts/store';
	import FormInput from '$ui/form/FormInput.svelte';
	import MarkdownInput from '$ui/form/MarkdownInput.svelte';
	import Toggle from '$ui/toggle/Toggle.svelte';
	import StickyCard from '$ui/card/StickyCard.svelte';
	import Button from '$ui/button/Button.svelte';
	import { Trash2, Loader2, Save, X } from 'lucide-svelte';
	import { isDirty, initEdit, initCreate, update, clear } from '$lib/client/stores/dirty';

	// Props
	export let mode: 'create' | 'edit';
	export let formatName: string;
	export let canWriteToBase: boolean = false;
	export let actionUrl: string = '';
	export let initialData: {
		title: string;
		type: 'movie' | 'series';
		shouldMatch: boolean;
		description: string;
	};

	// Event handlers
	export let onCancel: () => void;

	// Local form state
	let title = initialData.title;
	let type = initialData.type;
	let shouldMatch = initialData.shouldMatch;
	let description = initialData.description;
	const originalTitle = initialData.title;
	const originalType = initialData.type;

	// Initialize dirty tracking
	onMount(() => {
		const formData = { title, type, shouldMatch, description };
		if (mode === 'create') {
			initCreate(formData);
		} else {
			initEdit(formData);
		}
		return () => clear();
	});

	// Update dirty store when fields change
	$: update('title', title);
	$: update('type', type);
	$: update('shouldMatch', shouldMatch);
	$: update('description', description);

	// Loading states
	let saving = false;
	let deleting = false;

	// Layer selection
	let selectedLayer: 'user' | 'base' = canWriteToBase ? 'base' : 'user';
	let deleteLayer: 'user' | 'base' = canWriteToBase ? 'base' : 'user';

	// Modal states

	// Form reference
	let mainFormElement: HTMLFormElement;
	let deleteFormElement: HTMLFormElement;

	// Display text based on mode
	$: pageTitle = mode === 'create' ? 'New Test Case' : 'Edit Test Case';
	$: pageDescription =
		mode === 'create' ? `Add a test case for ${formatName}` : `Update test case settings`;
	$: submitButtonText = mode === 'create' ? 'Create' : 'Save Changes';

	$: isValid = title.trim() !== '';

	async function handleSaveClick() {
		selectedLayer = canWriteToBase ? 'base' : 'user';
		await tick();
		mainFormElement?.requestSubmit();
	}

	async function handleDeleteClick() {
		deleteLayer = canWriteToBase ? 'base' : 'user';
		await tick();
		deleteFormElement?.requestSubmit();
	}

	// Options
	const typeOptions = [
		{ value: 'movie' as const, label: 'Movie', description: 'Parse as a movie release' },
		{ value: 'series' as const, label: 'Series', description: 'Parse as a TV series release' }
	];

	const matchOptions = [
		{
			value: true,
			label: 'Should Match',
			description: 'This title should match the custom format'
		},
		{
			value: false,
			label: 'Should NOT Match',
			description: 'This title should not match the custom format'
		}
	];
</script>

<div class="mt-6 space-y-6">
	<StickyCard position="top">
		<svelte:fragment slot="left">
			<h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{pageTitle}</h2>
			<p class="text-sm text-neutral-600 dark:text-neutral-400">{pageDescription}</p>
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
				<Button text="Cancel" icon={X} on:click={onCancel} />
				<Button
					disabled={saving || !isValid || (mode === 'edit' && !$isDirty)}
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
		use:enhance={() => {
			saving = true;
			return async ({ result, update: formUpdate }) => {
				if (result.type === 'failure' && result.data) {
					alertStore.add('error', (result.data as { error?: string }).error || 'Operation failed');
				} else if (result.type === 'redirect') {
					alertStore.add(
						'success',
						mode === 'create' ? 'Test case created!' : 'Test case updated!'
					);
					// Clear dirty state before redirect so navigation guard doesn't trigger
					clear();
				}
				await formUpdate();
				saving = false;
			};
		}}
	>
		<!-- Hidden fields -->
		<input type="hidden" name="type" value={type} />
		<input type="hidden" name="shouldMatch" value={shouldMatch ? '1' : '0'} />
		<input type="hidden" name="formatName" value={formatName} />
		<input type="hidden" name="layer" value={selectedLayer} />
		<input type="hidden" name="description" value={description} />
		<input type="hidden" name="currentTitle" value={originalTitle} />
		<input type="hidden" name="currentType" value={originalType} />

		<div
			class="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
		>
			<div class="space-y-6 p-4">
				<!-- Title -->
				<FormInput
					label="Release Title"
					name="title"
					bind:value={title}
					required
					mono
					placeholder="e.g., Movie.Name.2024.1080p.BluRay.x264-GROUP"
				/>

				<!-- Media Type -->
				<div>
					<div class="mb-3 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
						Media Type
					</div>
					<div class="grid gap-2 sm:grid-cols-2">
						{#each typeOptions as option}
							<div class="space-y-1">
								<Toggle
									checked={type === option.value}
									label={option.label}
									ariaLabel={`Set media type to ${option.label}`}
									fullWidth
									on:change={() => (type = option.value)}
								/>
								<p class="px-1 text-xs text-neutral-500 dark:text-neutral-400">
									{option.description}
								</p>
							</div>
						{/each}
					</div>
				</div>

				<!-- Expected Result -->
				<div>
					<div class="mb-3 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
						Expected Result
					</div>
					<div class="grid gap-2 sm:grid-cols-2">
						{#each matchOptions as option}
							<div class="space-y-1">
								<Toggle
									checked={shouldMatch === option.value}
									label={option.label}
									ariaLabel={option.label}
									color={option.value ? 'green' : 'red'}
									fullWidth
									on:change={() => (shouldMatch = option.value)}
								/>
								<p class="px-1 text-xs text-neutral-500 dark:text-neutral-400">
									{option.description}
								</p>
							</div>
						{/each}
					</div>
				</div>

				<!-- Description -->
				<MarkdownInput
					label="Description"
					placeholder="Why this test exists or what edge case it covers"
					value={description}
					onchange={(v) => (description = v)}
					rows={2}
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
						alertStore.add('success', 'Test case deleted');
					}
					await formUpdate();
					deleting = false;
				};
			}}
		>
			<input type="hidden" name="formatName" value={formatName} />
			<input type="hidden" name="layer" value={deleteLayer} />
			<input type="hidden" name="testTitle" value={originalTitle} />
			<input type="hidden" name="testType" value={originalType} />
		</form>
	{/if}
</div>
