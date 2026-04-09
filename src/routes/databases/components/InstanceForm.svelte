<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { Save, Trash2, Star, GitFork, CircleDot, Database, GitBranch } from 'lucide-svelte';
	import { siGithub } from 'simple-icons';
	import { alertStore } from '$alerts/store';
	import { isDirty, initEdit, initCreate, update, current, clear } from '$lib/client/stores/dirty';
	import type { DatabaseInstancePublic } from '$db/queries/databaseInstances.ts';
	import type { RepoInfo } from '$utils/git/types';
	import FormInput from '$ui/form/FormInput.svelte';
	import DropdownSelect from '$ui/dropdown/DropdownSelect.svelte';
	import Modal from '$ui/modal/Modal.svelte';
	import DirtyModal from '$ui/modal/DirtyModal.svelte';
	import Button from '$ui/button/Button.svelte';
	import StickyCard from '$ui/card/StickyCard.svelte';

	// Props
	export let mode: 'create' | 'edit';
	export let instance: DatabaseInstancePublic | undefined = undefined;
	export let repoInfo: RepoInfo | null = null;
	export let currentBranch: string = '';
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export let form: any = undefined;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export let data: any = undefined;

	// Initialize dirty tracking on mount
	onMount(() => {
		if (mode === 'edit' && instance) {
			initEdit({
				name: instance.name,
				repositoryUrl: instance.repository_url,
				personalAccessToken: '', // Never pre-populate for security
				gitUserName: instance.git_user_name ?? '',
				gitUserEmail: instance.git_user_email ?? '',
				localOpsEnabled: instance.local_ops_enabled ? 'true' : 'false',
				conflictStrategy: instance.conflict_strategy ?? 'override',
				syncStrategy: String(instance.sync_strategy),
				autoPull: instance.auto_pull ? 'true' : 'false'
			});
		} else {
			initCreate({
				name: data?.formData?.name ?? '',
				repositoryUrl: '',
				branch: data?.formData?.branch ?? '',
				personalAccessToken: data?.formData?.personalAccessToken ?? '',
				gitUserName: data?.formData?.gitUserName ?? '',
				gitUserEmail: data?.formData?.gitUserEmail ?? '',
				localOpsEnabled: data?.formData?.localOpsEnabled === '1' ? 'true' : 'false',
				conflictStrategy: 'override',
				syncStrategy: data?.formData?.syncStrategy ? String(data.formData.syncStrategy) : '60',
				autoPull: data?.formData?.autoPull === '0' ? 'false' : 'true'
			});
		}
		return () => clear();
	});

	// Read current values from dirty store
	$: name = ($current.name ?? '') as string;
	$: repositoryUrl = ($current.repositoryUrl ?? '') as string;
	$: branch = ($current.branch ?? '') as string;
	$: personalAccessToken = ($current.personalAccessToken ?? '') as string;
	$: gitUserName = ($current.gitUserName ?? '') as string;
	$: gitUserEmail = ($current.gitUserEmail ?? '') as string;
	$: localOpsEnabled = ($current.localOpsEnabled ?? 'false') as string;
	$: conflictStrategy = ($current.conflictStrategy ?? 'override') as string;
	$: syncStrategy = ($current.syncStrategy ?? '60') as string;
	$: autoPull = ($current.autoPull ?? 'true') as string;
	$: showGitIdentity = !!personalAccessToken || (mode === 'edit' && !!instance?.hasPat);
	$: requiresGitIdentity = !!personalAccessToken;

	// UI state
	let saving = false;
	let deleting = false;
	let showDeleteModal = false;

	// Options for dropdowns
	const syncStrategyOptions = [
		{ value: '0', label: 'Manual (no auto-sync)' },
		{ value: '5', label: 'Every 5 minutes' },
		{ value: '15', label: 'Every 15 minutes' },
		{ value: '30', label: 'Every 30 minutes' },
		{ value: '60', label: 'Every hour' },
		{ value: '360', label: 'Every 6 hours' },
		{ value: '720', label: 'Every 12 hours' },
		{ value: '1440', label: 'Every 24 hours' }
	];

	const autoPullOptions = [
		{ value: 'true', label: 'Enabled' },
		{ value: 'false', label: 'Disabled' }
	];

	const localOpsOptions = [
		{ value: 'false', label: 'Disabled' },
		{ value: 'true', label: 'Enabled' }
	];

	const conflictStrategyOptions = [
		{ value: 'override', label: 'Override (default)' },
		{ value: 'align', label: 'Align' },
		{ value: 'ask', label: 'Ask every time' }
	];

	// Submit handler
	function handleSave() {
		if (!name) {
			alertStore.add('error', 'Name is required');
			return;
		}
		if (mode === 'create' && !repositoryUrl) {
			alertStore.add('error', 'Repository URL is required');
			return;
		}
		if (requiresGitIdentity && (!gitUserName || !gitUserEmail)) {
			alertStore.add(
				'error',
				'Git author name and email are required when a personal access token is set.'
			);
			return;
		}

		saving = true;
		const saveForm = document.getElementById('save-form');
		if (saveForm instanceof HTMLFormElement) {
			saveForm.requestSubmit();
		}
	}

	$: canSubmit =
		$isDirty &&
		!!name &&
		(mode === 'edit' || !!repositoryUrl) &&
		(!requiresGitIdentity || (!!gitUserName && !!gitUserEmail));

	// Handle form response
	let lastFormId: unknown = null;
	$: if (form && form !== lastFormId) {
		lastFormId = form;
		if (form.success) {
			alertStore.add('success', 'Settings saved successfully');
			// Reset dirty state with new values (keep personalAccessToken empty)
			initEdit({
				name,
				repositoryUrl,
				personalAccessToken: '',
				gitUserName,
				gitUserEmail,
				localOpsEnabled,
				conflictStrategy,
				syncStrategy,
				autoPull
			});
		}
		if (form.error) {
			alertStore.add('error', form.error);
		}
	}

	// Display text based on mode
	$: title = mode === 'create' ? 'Link Database' : 'Settings';
	$: description =
		mode === 'create'
			? 'Link a Profilarr Compliant Database from a Git repository.'
			: `Configure settings for ${instance?.name || 'this database'}.`;
</script>

<div class="space-y-6" class:mt-6={mode === 'edit'}>
	<!-- Header -->
	<div data-onboarding="db-header">
		<StickyCard position="top">
			<svelte:fragment slot="left">
				{#if mode === 'edit'}
					<div class="flex items-center gap-3">
						{#if repoInfo}
							<img src={repoInfo.ownerAvatarUrl} alt={repoInfo.owner} class="h-8 w-8 rounded-lg" />
							<div class="flex flex-col gap-1">
								<code
									class="text-sm text-neutral-700 dark:text-neutral-300"
									style="font-family: var(--font-code)"
								>
									{repoInfo.owner}/{repoInfo.repo}
								</code>
								<div class="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
									{#if currentBranch}
										<span class="flex items-center gap-1">
											<GitBranch size={12} />
											<code style="font-family: var(--font-code)">{currentBranch}</code>
										</span>
									{/if}
									<span class="flex items-center gap-1">
										<Star size={12} />
										<code style="font-family: var(--font-code)"
											>{repoInfo.stars.toLocaleString()}</code
										>
									</span>
									<span class="flex items-center gap-1">
										<GitFork size={12} />
										<code style="font-family: var(--font-code)"
											>{repoInfo.forks.toLocaleString()}</code
										>
									</span>
									<span class="flex items-center gap-1">
										<CircleDot size={12} />
										<code style="font-family: var(--font-code)"
											>{repoInfo.openIssues.toLocaleString()}</code
										>
									</span>
								</div>
							</div>
						{:else}
							<div
								class="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-700"
							>
								<Database size={16} class="text-neutral-500 dark:text-neutral-400" />
							</div>
							<div class="flex flex-col gap-1">
								<span class="text-sm font-medium text-neutral-700 dark:text-neutral-300">
									{instance?.name ?? 'Database'}
								</span>
								{#if instance?.repository_url}
									<code class="font-mono text-xs text-neutral-500 dark:text-neutral-400">
										{instance.repository_url.replace('https://github.com/', '')}
									</code>
								{/if}
							</div>
						{/if}
					</div>
				{:else}
					<h1 class="text-neutral-900 dark:text-neutral-50">{title}</h1>
					<p class="text-neutral-600 dark:text-neutral-400">{description}</p>
				{/if}
			</svelte:fragment>
			<svelte:fragment slot="right">
				{#if mode === 'edit'}
					<Button
						text="Unlink"
						icon={Trash2}
						iconColor="text-red-600 dark:text-red-400"
						disabled={saving || deleting}
						on:click={() => (showDeleteModal = true)}
					/>
				{/if}
				<div data-onboarding="db-save">
					<Button
						text={saving ? 'Saving...' : 'Save'}
						icon={Save}
						iconColor="text-blue-600 dark:text-blue-400"
						disabled={saving || !canSubmit}
						on:click={handleSave}
					/>
				</div>
				{#if mode === 'edit'}
					<Button
						href={repoInfo?.htmlUrl ?? instance?.repository_url}
						target="_blank"
						rel="noopener noreferrer"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="currentColor"
						>
							<path d={siGithub.path} />
						</svg>
						GitHub
					</Button>
				{/if}
			</svelte:fragment>
		</StickyCard>
	</div>

	<div
		class="space-y-4 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
	>
		<!-- Name, Repository URL, Branch -->
		<div data-onboarding="db-name-repo-branch" class="space-y-4">
			<FormInput
				label="Name"
				name="name"
				value={name}
				placeholder="e.g., Main Database, 4K Profiles"
				description="A friendly name to identify this database"
				required
				on:input={(e) => update('name', e.detail)}
			/>

			<FormInput
				label="Repository URL"
				name="repository_url"
				type="url"
				value={repositoryUrl}
				placeholder="https://github.com/username/database"
				description={mode === 'edit'
					? 'Repository URL cannot be changed after linking'
					: 'Git repository URL containing the PCD manifest'}
				required
				readonly={mode === 'edit'}
				on:input={(e) => update('repositoryUrl', e.detail)}
			/>

			{#if mode === 'create'}
				<FormInput
					label="Branch"
					name="branch"
					value={branch}
					placeholder="main"
					description="Branch to checkout on link. Cannot be changed after linking. Leave empty for the default branch."
					on:input={(e) => update('branch', e.detail)}
				/>
			{/if}
		</div>

		<!-- Personal Access Token Row -->
		<div data-onboarding="db-pat">
			<FormInput
				label="Personal Access Token"
				name="personal_access_token"
				value={personalAccessToken}
				placeholder="ghp_..."
				description={mode === 'edit'
					? 'Re-enter to update. Required for private repos and to push changes.'
					: 'Required for private repositories and to push changes back to GitHub.'}
				private_
				on:input={(e) => update('personalAccessToken', e.detail)}
			/>
		</div>

		<!-- Git Author Identity -->
		{#if showGitIdentity}
			<FormInput
				label="Git Author Name"
				name="git_user_name"
				value={gitUserName}
				placeholder="e.g., Jane Doe"
				description="Used for commits when exporting changes to Git."
				required={requiresGitIdentity}
				on:input={(e) => update('gitUserName', e.detail)}
			/>
			<FormInput
				label="Git Author Email"
				name="git_user_email"
				type="email"
				value={gitUserEmail}
				placeholder="jane@example.com"
				description="Used for commits when exporting changes to Git."
				required={requiresGitIdentity}
				on:input={(e) => update('gitUserEmail', e.detail)}
			/>
		{/if}

		<!-- Local Ops Only Row -->
		{#if showGitIdentity}
			<div class="space-y-2">
				<span class="block text-sm font-medium text-neutral-900 dark:text-neutral-100">
					Local Ops Only
				</span>
				<p class="text-xs text-neutral-500 dark:text-neutral-400">
					Force changes to save as local user ops even when a personal access token is set.
				</p>
				<DropdownSelect
					value={localOpsEnabled}
					options={localOpsOptions}
					fullWidth
					on:change={(e) => update('localOpsEnabled', e.detail)}
				/>
			</div>
		{/if}

		<!-- Conflict Strategy Row -->
		{#if !showGitIdentity || localOpsEnabled === 'true'}
			<div data-onboarding="db-conflict" class="space-y-2">
				<span class="block text-sm font-medium text-neutral-900 dark:text-neutral-100">
					Conflict Strategy
				</span>
				<p class="text-xs text-neutral-500 dark:text-neutral-400">
					How to handle user ops that conflict with upstream changes.
				</p>
				<ul class="list-disc space-y-1 pl-5 text-xs text-neutral-500 dark:text-neutral-400">
					<li>
						<span class="font-medium text-neutral-700 dark:text-neutral-200">Override:</span>
						reapply your local change with updated guards.
					</li>
					<li>
						<span class="font-medium text-neutral-700 dark:text-neutral-200">Align:</span>
						drop the local op and accept upstream changes.
					</li>
					<li>
						<span class="font-medium text-neutral-700 dark:text-neutral-200">Ask:</span>
						mark conflicts as pending for manual review.
					</li>
				</ul>
				<DropdownSelect
					value={conflictStrategy}
					options={conflictStrategyOptions}
					fullWidth
					on:change={(e) => update('conflictStrategy', e.detail)}
				/>
			</div>
		{/if}

		<!-- Sync Strategy & Auto Pull -->
		<div data-onboarding="db-sync" class="space-y-4">
			<div class="space-y-2">
				<span class="block text-sm font-medium text-neutral-900 dark:text-neutral-100">
					Sync Strategy
				</span>
				<p class="text-xs text-neutral-500 dark:text-neutral-400">
					How often to check for updates from the remote repository
				</p>
				<DropdownSelect
					value={syncStrategy}
					options={syncStrategyOptions}
					fullWidth
					on:change={(e) => update('syncStrategy', e.detail)}
				/>
			</div>

			<div class="space-y-2">
				<span class="block text-sm font-medium text-neutral-900 dark:text-neutral-100">
					Auto Pull
				</span>
				<p class="text-xs text-neutral-500 dark:text-neutral-400">
					Automatically pull updates when available, or just receive notifications
				</p>
				<DropdownSelect
					value={autoPull}
					options={autoPullOptions}
					on:change={(e) => update('autoPull', e.detail)}
				/>
			</div>
			{#if autoPull === 'false'}
				<p class="text-xs text-amber-600 dark:text-amber-400">
					You will receive notifications when updates are available but they won't be applied
					automatically
				</p>
			{/if}
		</div>
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
				alertStore.add('success', 'Database linked successfully');
			}
			await formUpdate({ reset: false });
			saving = false;
		};
	}}
>
	<input type="hidden" name="name" value={name} />
	<input type="hidden" name="repository_url" value={repositoryUrl} />
	{#if mode === 'create'}
		<input type="hidden" name="branch" value={branch} />
	{/if}
	<input type="hidden" name="personal_access_token" value={personalAccessToken} />
	<input type="hidden" name="git_user_name" value={gitUserName} />
	<input type="hidden" name="git_user_email" value={gitUserEmail} />
	<input type="hidden" name="local_ops_enabled" value={localOpsEnabled === 'true' ? '1' : '0'} />
	<input type="hidden" name="conflict_strategy" value={conflictStrategy} />
	<input type="hidden" name="sync_strategy" value={syncStrategy} />
	<input type="hidden" name="auto_pull" value={autoPull === 'true' ? '1' : '0'} />
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
					alertStore.add(
						'error',
						(result.data as { error?: string }).error || 'Failed to unlink database'
					);
				} else if (result.type === 'redirect') {
					alertStore.add('success', 'Database unlinked successfully');
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
		header="Unlink Database"
		bodyMessage={`Are you sure you want to unlink "${instance?.name}"? This action cannot be undone and all local data will be permanently removed.`}
		confirmText="Unlink"
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
