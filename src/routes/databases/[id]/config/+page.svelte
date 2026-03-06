<script lang="ts">
	import type { PageData } from './$types';
	import { onMount, onDestroy } from 'svelte';
	import { enhance } from '$app/forms';
	import { Save } from 'lucide-svelte';
	import FormInput from '$ui/form/FormInput.svelte';
	import NumberInput from '$ui/form/NumberInput.svelte';
	import KeyValueList from '$ui/form/KeyValueList.svelte';
	import TagInput from '$ui/form/TagInput.svelte';
	import MarkdownInput from '$ui/form/MarkdownInput.svelte';
	import DirtyModal from '$ui/modal/DirtyModal.svelte';
	import StickyCard from '$ui/card/StickyCard.svelte';
	import Button from '$ui/button/Button.svelte';
	import { alertStore } from '$lib/client/alerts/store';
	import {
		isDirty,
		initEdit,
		update as dirtyUpdate,
		resetFromServer,
		clear as clearDirty
	} from '$lib/client/stores/dirty';

	export let data: PageData;

	let manifest = data.manifest;
	let readme = data.readmeRaw ?? '';
	let saving = false;

	// Initialize dirty tracking
	onMount(() => {
		if (manifest) {
			initEdit({ manifest, readme });
		}
	});

	onDestroy(() => {
		clearDirty();
	});

	function updateManifest<K extends keyof NonNullable<typeof manifest>>(
		key: K,
		value: NonNullable<typeof manifest>[K]
	) {
		if (!manifest) return;
		manifest = { ...manifest, [key]: value };
		dirtyUpdate('manifest', manifest);
	}

	function updateProfilarr(key: 'minimum_version', value: string) {
		if (!manifest) return;
		manifest = {
			...manifest,
			profilarr: { ...manifest.profilarr, [key]: value }
		};
		dirtyUpdate('manifest', manifest);
	}

	function updateReadme(value: string) {
		readme = value;
		dirtyUpdate('readme', readme);
	}

	function parseVersion(v: string): [number, number, number] {
		const parts = v.split('.').map((p) => parseInt(p, 10) || 0);
		return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
	}

	function updateVersionPart(current: string, part: 0 | 1 | 2, value: number): string {
		const parts = parseVersion(current);
		parts[part] = value;
		return parts.join('.');
	}

	$: [vMajor, vMinor, vPatch] = manifest ? parseVersion(manifest.version) : [0, 0, 0];
	$: [pvMajor, pvMinor, pvPatch] = manifest
		? parseVersion(manifest.profilarr.minimum_version)
		: [0, 0, 0];
</script>

<svelte:head>
	<title>Config - {data.database.name} - Profilarr</title>
</svelte:head>

<form
	method="POST"
	action="?/save"
	use:enhance={() => {
		saving = true;
		return async ({ result }) => {
			saving = false;
			if (result.type === 'success') {
				alertStore.add('success', 'Config saved successfully');
				resetFromServer({ manifest, readme });
			} else if (result.type === 'failure') {
				alertStore.add(
					'error',
					(result.data as { error?: string })?.error || 'Failed to save config'
				);
			}
		};
	}}
>
	<input type="hidden" name="manifest" value={JSON.stringify(manifest)} />
	<input type="hidden" name="readme" value={readme} />

	{#if manifest}
		<div class="space-y-5">
			<!-- Header -->
			<StickyCard position="top">
				<svelte:fragment slot="left">
					<h1 class="text-neutral-900 dark:text-neutral-50">Config</h1>
					<p class="text-neutral-600 dark:text-neutral-400">
						Edit the database manifest and README
					</p>
				</svelte:fragment>
				<svelte:fragment slot="right">
					<Button
						text={saving ? 'Saving...' : 'Save'}
						icon={Save}
						iconColor="text-blue-600 dark:text-blue-400"
						disabled={saving || !$isDirty}
						type="submit"
					/>
				</svelte:fragment>
			</StickyCard>

			<div
				class="space-y-5 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
			>
				<!-- Name -->
				<FormInput
					label="Name"
					name="name"
					required
					value={manifest.name}
					description="Unique identifier for the database (lowercase, hyphens preferred)"
					placeholder="my-database"
					on:input={(e) => updateManifest('name', e.detail)}
				/>

				<!-- Description -->
				<FormInput
					label="Description"
					name="description"
					required
					value={manifest.description}
					description="Short summary of what the database provides"
					placeholder="My custom Arr configurations"
					on:input={(e) => updateManifest('description', e.detail)}
				/>

				<!-- Version -->
				<div class="space-y-1">
					<span class="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
						Version <span class="text-red-500">*</span>
					</span>
					<p class="text-xs text-neutral-500 dark:text-neutral-400">
						Semantic version of the database (MAJOR.MINOR.PATCH)
					</p>
					<div class="mt-1 flex items-center gap-1">
						<div class="w-20">
							<NumberInput
								name="version-major"
								value={vMajor}
								min={1}
								font="mono"
								onchange={(v) =>
									updateManifest('version', updateVersionPart(manifest!.version, 0, v))}
								onMinBlocked={() =>
									alertStore.add('warning', 'Database version must be at least 1.0.0')}
							/>
						</div>
						<span class="text-lg font-medium text-neutral-400 dark:text-neutral-500">.</span>
						<div class="w-20">
							<NumberInput
								name="version-minor"
								value={vMinor}
								min={0}
								font="mono"
								onchange={(v) =>
									updateManifest('version', updateVersionPart(manifest!.version, 1, v))}
							/>
						</div>
						<span class="text-lg font-medium text-neutral-400 dark:text-neutral-500">.</span>
						<div class="w-20">
							<NumberInput
								name="version-patch"
								value={vPatch}
								min={0}
								font="mono"
								onchange={(v) =>
									updateManifest('version', updateVersionPart(manifest!.version, 2, v))}
							/>
						</div>
					</div>
				</div>

				<!-- Minimum Profilarr Version -->
				<div class="space-y-1">
					<span class="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
						Minimum Profilarr Version <span class="text-red-500">*</span>
					</span>
					<p class="text-xs text-neutral-500 dark:text-neutral-400">
						Minimum Profilarr version required to use this database
					</p>
					<div class="mt-1 flex items-center gap-1">
						<div class="w-20">
							<NumberInput
								name="profilarr-version-major"
								value={pvMajor}
								min={2}
								font="mono"
								onchange={(v) =>
									updateProfilarr(
										'minimum_version',
										updateVersionPart(manifest!.profilarr.minimum_version, 0, v)
									)}
								onMinBlocked={() =>
									alertStore.add('warning', 'Minimum Profilarr version must be at least 2.0.0')}
							/>
						</div>
						<span class="text-lg font-medium text-neutral-400 dark:text-neutral-500">.</span>
						<div class="w-20">
							<NumberInput
								name="profilarr-version-minor"
								value={pvMinor}
								min={0}
								font="mono"
								onchange={(v) =>
									updateProfilarr(
										'minimum_version',
										updateVersionPart(manifest!.profilarr.minimum_version, 1, v)
									)}
							/>
						</div>
						<span class="text-lg font-medium text-neutral-400 dark:text-neutral-500">.</span>
						<div class="w-20">
							<NumberInput
								name="profilarr-version-patch"
								value={pvPatch}
								min={0}
								font="mono"
								onchange={(v) =>
									updateProfilarr(
										'minimum_version',
										updateVersionPart(manifest!.profilarr.minimum_version, 2, v)
									)}
							/>
						</div>
					</div>
				</div>

				<!-- Arr Types -->
				<div class="space-y-1">
					<span class="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
						Arr Types
					</span>
					<p class="text-xs text-neutral-500 dark:text-neutral-400">
						Which arr applications this database supports. Leave empty if all are supported.
					</p>
					<div class="mt-1">
						<TagInput
							tags={manifest.arr_types ?? []}
							placeholder="Add arr type (radarr, sonarr, etc.)"
							onchange={(tags) => updateManifest('arr_types', tags)}
						/>
					</div>
				</div>

				<!-- Tags -->
				<div class="space-y-1">
					<span class="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Tags</span>
					<p class="text-xs text-neutral-500 dark:text-neutral-400">
						Descriptive keywords for discovery
					</p>
					<div class="mt-1">
						<TagInput
							tags={manifest.tags ?? []}
							placeholder="Add tags..."
							onchange={(tags) => updateManifest('tags', tags)}
						/>
					</div>
				</div>

				<!-- License -->
				<FormInput
					label="License"
					name="license"
					value={manifest.license ?? ''}
					description="SPDX license identifier (e.g., MIT, Apache-2.0)"
					placeholder="MIT"
					on:input={(e) => updateManifest('license', e.detail || undefined)}
				/>

				<!-- Repository -->
				<FormInput
					label="Repository"
					name="repository"
					type="url"
					value={manifest.repository ?? ''}
					description="Git repository URL"
					placeholder="https://github.com/user/repo"
					on:input={(e) => updateManifest('repository', e.detail || undefined)}
				/>

				<!-- Dependencies -->
				<KeyValueList
					label="Dependencies"
					description="Dependencies this database requires. All PCDs must depend on schema at minimum. Additional dependencies coming in a future version."
					keyLabel="Package"
					valueLabel="Version"
					keyPlaceholder="package-name"
					valueType="version"
					versionMinMajor={1}
					value={manifest.dependencies ?? {}}
					onchange={(v) => updateManifest('dependencies', v)}
					lockedFirst={{
						key: 'https://github.com/Dictionarry-Hub/schema',
						value: '1.0.0',
						minMajor: 1
					}}
					onLockedEditAttempt={() =>
						alertStore.add('warning', 'The schema package URL cannot be changed')}
					onLockedDeleteAttempt={() =>
						alertStore.add('warning', 'The schema dependency is required and cannot be removed')}
					onLockedVersionMinBlocked={() =>
						alertStore.add('warning', 'Schema version must be at least 1.0.0')}
					addDisabled={true}
					onAddBlocked={() =>
						alertStore.add(
							'info',
							'Additional dependencies are not available yet. Coming in a future version.'
						)}
				/>

				<!-- README -->
				<div class="space-y-1">
					<span class="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
						>README</span
					>
					<p class="text-xs text-neutral-500 dark:text-neutral-400">
						Documentation for your database
					</p>
					<div class="mt-1">
						<MarkdownInput
							value={readme}
							onchange={updateReadme}
							placeholder="Write your README here..."
							rows={12}
						/>
					</div>
				</div>
			</div>
		</div>
	{:else}
		<p class="text-sm text-neutral-500 dark:text-neutral-400">No manifest found</p>
	{/if}
</form>

<DirtyModal />
