<script lang="ts">
	import { enhance } from '$app/forms';
	import { tick } from 'svelte';
	import Modal from '$ui/modal/Modal.svelte';
	import FormInput from '$ui/form/FormInput.svelte';
	import TagInput from '$ui/form/TagInput.svelte';
	import { alertStore } from '$alerts/store';

	export let open = false;
	export let mode: 'create' | 'edit' = 'create';
	export let entityType: 'movie' | 'series';
	export let entityTmdbId: number;
	export let release: {
		id?: number;
		title: string;
		size_bytes: number | null;
		languages: string[];
		indexers: string[];
		flags: string[];
	} | null = null;
	export let canWriteToBase: boolean = false;

	let saving = false;
	let formRef: HTMLFormElement;

	// Layer selection
	let selectedLayer: 'user' | 'base' = canWriteToBase ? 'base' : 'user';

	// Form state
	let title = '';
	let sizeGb = '';
	let languages: string[] = [];
	let indexers: string[] = [];
	let flags: string[] = [];

	// Reset form when modal opens or release changes
	$: if (open) {
		if (mode === 'edit' && release) {
			title = release.title;
			sizeGb = release.size_bytes ? (release.size_bytes / (1024 * 1024 * 1024)).toFixed(2) : '';
			languages = [...release.languages];
			indexers = [...release.indexers];
			flags = [...release.flags];
		} else {
			title = '';
			sizeGb = '';
			languages = [];
			indexers = [];
			flags = [];
		}
	}

	async function handleConfirm() {
		selectedLayer = canWriteToBase ? 'base' : 'user';
		await tick();
		formRef?.requestSubmit();
	}

	function handleCancel() {
		open = false;
	}

	// Convert GB to bytes
	function gbToBytes(gb: string): number | null {
		const num = parseFloat(gb);
		if (isNaN(num) || num <= 0) return null;
		return Math.round(num * 1024 * 1024 * 1024);
	}

	$: actionUrl = mode === 'create' ? '?/createRelease' : '?/updateRelease';
	$: modalHeader = mode === 'create' ? 'Add Test Release' : 'Edit Test Release';
	$: confirmText = mode === 'create' ? 'Add' : 'Save';

	// Build JSON for form submission
	$: releaseJson = JSON.stringify({
		id: release?.id,
		entityType,
		entityTmdbId,
		title,
		size_bytes: gbToBytes(sizeGb),
		languages,
		indexers,
		flags
	});
</script>

<Modal
	bind:open
	header={modalHeader}
	{confirmText}
	size="lg"
	on:cancel={handleCancel}
	on:confirm={handleConfirm}
>
	<div slot="body" class="space-y-4">
		<FormInput
			label="Release Title"
			description="The full release title (e.g., Movie.2024.1080p.BluRay.REMUX-GROUP)"
			bind:value={title}
			placeholder="Movie.2024.1080p.BluRay.REMUX-GROUP"
			required
		/>

		<FormInput
			label="Size (GB)"
			description="File size in gigabytes"
			bind:value={sizeGb}
			placeholder="15.5"
			type="number"
		/>

		<div class="space-y-1">
			<span class="block text-sm font-medium text-text-soft"> Languages </span>
			<p class="text-xs text-text-muted">Press Enter to add languages</p>
			<TagInput bind:tags={languages} placeholder="Type language and press Enter" />
		</div>

		<div class="space-y-1">
			<span class="block text-sm font-medium text-text-soft"> Indexers </span>
			<p class="text-xs text-text-muted">Press Enter to add indexers</p>
			<TagInput bind:tags={indexers} placeholder="Type indexer and press Enter" />
		</div>

		<div class="space-y-1">
			<span class="block text-sm font-medium text-text-soft"> Flags </span>
			<p class="text-xs text-text-muted">Press Enter to add flags (e.g., freeleech, scene)</p>
			<TagInput bind:tags={flags} placeholder="Type flag and press Enter" />
		</div>

		<form
			bind:this={formRef}
			method="POST"
			action={actionUrl}
			class="hidden"
			use:enhance={() => {
				saving = true;
				return async ({ result, update }) => {
					if (result.type === 'failure' && result.data) {
						alertStore.add(
							'error',
							(result.data as { error?: string }).error || `Failed to ${mode} release`
						);
					} else if (result.type === 'success') {
						alertStore.add('success', mode === 'create' ? 'Release added' : 'Release updated');
						open = false;
					}
					await update();
					saving = false;
				};
			}}
		>
			<input type="hidden" name="release" value={releaseJson} />
			<input type="hidden" name="layer" value={selectedLayer} />
		</form>
	</div>
</Modal>
