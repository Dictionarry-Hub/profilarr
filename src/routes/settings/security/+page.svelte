<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import {
		LogOut,
		Check,
		Globe,
		Monitor,
		Smartphone,
		Network,
		Clock,
		Plus,
		Trash2,
		BookOpen,
		Eye,
		Pencil,
		ShieldCheck
	} from '@lucide/svelte';
	import { parseUTC, formatDateTime, formatDate } from '$shared/utils/dates';
	import { dateFormat } from '$lib/client/stores/dateFormat.ts';
	import { serverTimezone } from '$lib/client/stores/timezone.ts';
	import Button from '$ui/button/Button.svelte';
	import ExpandableCard from '$ui/card/ExpandableCard.svelte';
	import FormInput from '$ui/form/FormInput.svelte';
	import Table from '$ui/table/Table.svelte';
	import Label from '$ui/label/Label.svelte';
	import Tooltip from '$ui/tooltip/Tooltip.svelte';
	import Modal from '$ui/modal/Modal.svelte';
	import InlineCode from '$ui/code/InlineCode.svelte';
	import PageMeta from '$ui/meta/PageMeta.svelte';
	import { alertStore } from '$alerts/store';
	import type { Column } from '$ui/table/types';
	import { FEATURES } from '$shared/features';
	import {
		API_KEYS_DOCS_URL,
		ENV_API_KEY_NAME,
		apiKeyAccessEntries,
		type ApiKeyAccessEntry
	} from '$shared/apiKeys';

	export let data: PageData;
	export let form: ActionData;

	let changingPassword = false;
	let currentPassword = '';
	let newPassword = '';
	let confirmPassword = '';

	let creatingLocalAccount = false;
	let localUsername = '';
	let localPassword = '';
	let localConfirmPassword = '';

	// Handle form responses
	$: if (form?.passwordSuccess) {
		alertStore.add('success', 'Password changed successfully');
		currentPassword = '';
		newPassword = '';
		confirmPassword = '';
	}
	$: if (form?.passwordError) {
		alertStore.add('error', form.passwordError);
	}
	$: if (form?.localAccountCreated) {
		alertStore.add('success', `Local account "${form.localAccountCreated}" created`);
		localUsername = '';
		localPassword = '';
		localConfirmPassword = '';
	}
	$: if (form?.localAccountError) {
		alertStore.add('error', form.localAccountError);
	}
	$: if (form?.apiKeyDeleted) {
		alertStore.add('success', `API key "${form.apiKeyDeleted}" deleted`);
	}
	$: if (form?.apiKeyError) {
		alertStore.add('error', form.apiKeyError);
	}
	$: if (form?.sessionRevoked) {
		alertStore.add('success', 'Session revoked');
	}
	$: if (form?.sessionsRevoked !== undefined) {
		alertStore.add('success', `Revoked ${form.sessionsRevoked} session(s)`);
	}
	$: if (form?.sessionError) {
		alertStore.add('error', form.sessionError);
	}

	interface ApiKeyRow {
		/** null for the env key */
		id: number | null;
		name: string;
		access: ApiKeyAccessEntry[] | 'all';
		keyHint: string | null;
		expiresAt: string | null;
		expired: boolean;
		lastUsedAt: string | null;
	}

	const envKeyRow: ApiKeyRow = {
		id: null,
		name: ENV_API_KEY_NAME,
		access: 'all',
		keyHint: null,
		expiresAt: null,
		expired: false,
		lastUsedAt: null
	};

	$: apiKeyRows = [
		...data.apiKeys.map((key): ApiKeyRow => ({
			id: key.id,
			name: key.name,
			access: apiKeyAccessEntries(key.permissions, data.apiAreas),
			keyHint: key.keyHint,
			expiresAt: key.expiresAt,
			expired: key.expired,
			lastUsedAt: key.lastUsedAt
		})),
		...(data.hasEnvApiKey ? [envKeyRow] : [])
	];

	const apiKeyColumns: Column<ApiKeyRow>[] = [
		{ key: 'name', header: 'Name' },
		{ key: 'access', header: 'Access' },
		{ key: 'keyHint', header: 'Key', hideOnMobile: true },
		{ key: 'expiresAt', header: 'Expires' },
		{ key: 'lastUsedAt', header: 'Last Used', hideOnMobile: true }
	];

	let pendingDelete: ApiKeyRow | null = null;
	let deleteForm: HTMLFormElement;

	function confirmDelete() {
		// The form data is read synchronously on submit, so the modal can close right away
		deleteForm.requestSubmit();
		pendingDelete = null;
	}

	function fmtDateTime(dateStr: string): string {
		return formatDateTime(dateStr, $serverTimezone, $dateFormat);
	}

	interface SessionRow {
		handle: string;
		created_at: string;
		expires_at: string;
		last_active_at: string | null;
		ip_address: string | null;
		browser: string | null;
		os: string | null;
		device_type: string | null;
		isCurrent: boolean;
	}

	function formatRelativeTime(dateStr: string | null): string {
		if (!dateStr) return 'Never';
		const date = parseUTC(dateStr);
		if (!date) return 'Unknown';

		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffSecs = Math.floor(diffMs / 1000);
		const diffMins = Math.floor(diffSecs / 60);
		const diffHours = Math.floor(diffMins / 60);
		const diffDays = Math.floor(diffHours / 24);

		if (diffSecs < 60) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return formatDate(dateStr, $serverTimezone, $dateFormat);
	}

	const sessionColumns: Column<SessionRow>[] = [
		{
			key: 'browser',
			header: 'Browser',
			headerIcon: Globe,
			cell: (row) => row.browser ?? 'Unknown'
		},
		{
			key: 'os',
			header: 'OS',
			headerIcon: Monitor,
			cell: (row) => row.os ?? 'Unknown'
		},
		{
			key: 'device_type',
			header: 'Device',
			headerIcon: Smartphone,
			cell: (row) => row.device_type ?? 'Unknown'
		},
		{
			key: 'ip_address',
			header: 'IP',
			headerIcon: Network,
			cell: (row) => ({
				// nosemgrep: profilarr.xss.table-cell-html-unescaped — IP from session DB, not user content
				html: `<span class="font-mono text-xs text-neutral-500 dark:text-neutral-400">${row.ip_address ?? 'Unknown'}</span>`
			})
		},
		{
			key: 'last_active_at',
			header: 'Last Active',
			headerIcon: Clock,
			cell: (row) => ({
				// nosemgrep: profilarr.xss.table-cell-html-unescaped — formatted timestamp
				html: `<span class="text-xs text-neutral-500 dark:text-neutral-400">${formatRelativeTime(row.last_active_at)}</span>`
			})
		}
	];
</script>

<PageMeta title="Security" />

<div class="p-4 md:p-8">
	<div class="mb-8">
		<h1 class="text-2xl font-bold text-neutral-900 md:text-3xl dark:text-neutral-50">Security</h1>
		<p class="mt-2 text-base text-neutral-600 md:mt-3 md:text-lg dark:text-neutral-400">
			Manage your password, API keys, and active sessions
		</p>
	</div>

	<div class="space-y-8">
		{#if data.signedInWithSso && !data.hasLocalAccount}
			<!-- Create Local Account (SSO users only, until one exists) -->
			<ExpandableCard
				title="Create Local Account"
				description="Add a username and password to sign in with if SSO is unavailable"
				onboardingId="security-password"
			>
				<div class="p-6">
					<form
						method="POST"
						action="?/createLocalAccount"
						class="space-y-4"
						use:enhance={() => {
							creatingLocalAccount = true;
							return async ({ update }) => {
								await update({ reset: false });
								creatingLocalAccount = false;
							};
						}}
					>
						<FormInput
							name="username"
							label="Username"
							placeholder="Minimum 3 characters"
							autocomplete="username"
							bind:value={localUsername}
						/>
						<FormInput
							name="password"
							label="Password"
							type="password"
							placeholder="Minimum 8 characters"
							autocomplete="new-password"
							private_
							bind:value={localPassword}
						/>
						<FormInput
							name="confirmPassword"
							label="Confirm Password"
							type="password"
							placeholder="Re-enter password"
							autocomplete="new-password"
							private_
							bind:value={localConfirmPassword}
						/>
						<div class="flex justify-end">
							<Button
								type="submit"
								variant="secondary"
								size="sm"
								icon={Plus}
								iconColor="text-accent-500"
								text={creatingLocalAccount ? 'Creating...' : 'Create Account'}
								disabled={creatingLocalAccount}
							/>
						</div>
					</form>
				</div>
			</ExpandableCard>
		{/if}

		{#if !data.signedInWithSso}
			<!-- Change Password -->
			<ExpandableCard
				title="Change Password"
				description="Update your account password"
				onboardingId="security-password"
			>
				<div class="p-6">
					<form
						method="POST"
						action="?/changePassword"
						class="space-y-4"
						use:enhance={() => {
							changingPassword = true;
							return async ({ update }) => {
								await update({ reset: false });
								changingPassword = false;
							};
						}}
					>
						<FormInput
							name="currentPassword"
							label="Current Password"
							type="password"
							placeholder="Enter current password"
							autocomplete="current-password"
							private_
							bind:value={currentPassword}
						/>
						<FormInput
							name="newPassword"
							label="New Password"
							type="password"
							placeholder="Minimum 8 characters"
							autocomplete="new-password"
							private_
							bind:value={newPassword}
						/>
						<FormInput
							name="confirmPassword"
							label="Confirm New Password"
							type="password"
							placeholder="Re-enter new password"
							autocomplete="new-password"
							private_
							bind:value={confirmPassword}
						/>
						<div class="flex justify-end">
							<Button
								type="submit"
								variant="secondary"
								size="sm"
								icon={Check}
								iconColor="text-accent-500"
								text={changingPassword ? 'Saving...' : 'Change Password'}
								disabled={changingPassword}
							/>
						</div>
					</form>
				</div>
			</ExpandableCard>
		{/if}

		<!-- API Keys -->
		<ExpandableCard title="API Keys" onboardingId="security-api-key">
			<svelte:fragment slot="description">
				Authenticate API requests with the <InlineCode text="X-Api-Key" rounded="sm" /> header
			</svelte:fragment>
			<svelte:fragment slot="header-actions">
				<Button
					variant="secondary"
					icon={BookOpen}
					text="API docs"
					href={FEATURES.docs ? API_KEYS_DOCS_URL : undefined}
					target={FEATURES.docs ? '_blank' : undefined}
					rel={FEATURES.docs ? 'noopener noreferrer' : undefined}
					disabled={!FEATURES.docs}
					tooltip={FEATURES.docs ? '' : 'Docs coming soon'}
				/>
				<Button
					variant="secondary"
					icon={Plus}
					iconColor="text-accent-500"
					text="New Key"
					href="/settings/security/api-keys/new"
				/>
			</svelte:fragment>
			<div class="p-6">
				{#if apiKeyRows.length > 0}
					<Table
						columns={apiKeyColumns}
						data={apiKeyRows}
						compact
						responsive
						hoverable={false}
						actionsHeader=""
					>
						<svelte:fragment slot="cell" let:row let:column>
							{#if column.key === 'name'}
								<span class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
									{row.name}
								</span>
							{:else if column.key === 'access'}
								{#if row.access === 'all'}
									<Label variant="secondary" size="md" rounded="md">
										<ShieldCheck size={12} class="text-blue-600 dark:text-blue-400" />
										Full access
									</Label>
								{:else if row.access.length === 0}
									<span class="text-xs text-neutral-500 dark:text-neutral-400">No access</span>
								{:else}
									<div class="flex flex-wrap gap-1">
										{#each row.access as entry (entry.area.id)}
											<Tooltip
												text={`${entry.access === 'write' ? 'Read & write' : 'Read'} access to ${entry.area.name}`}
												position="top"
											>
												<Label variant="secondary" size="md" rounded="md">
													{#if entry.access === 'write'}
														<Pencil size={12} class="text-amber-600 dark:text-amber-400" />
													{:else}
														<Eye size={12} class="text-emerald-600 dark:text-emerald-400" />
													{/if}
													{entry.area.name}
												</Label>
											</Tooltip>
										{/each}
									</div>
								{/if}
							{:else if column.key === 'keyHint'}
								<span class="font-mono text-xs text-neutral-500 dark:text-neutral-400">
									{row.keyHint ? `••••${row.keyHint}` : '—'}
								</span>
							{:else if column.key === 'expiresAt'}
								{#if row.expired}
									<Label variant="danger" size="sm" rounded="md">Expired</Label>
								{:else}
									<span class="text-xs text-neutral-500 dark:text-neutral-400">
										{row.expiresAt
											? formatDate(row.expiresAt, $serverTimezone, $dateFormat)
											: 'Never'}
									</span>
								{/if}
							{:else if column.key === 'lastUsedAt'}
								<span class="text-xs text-neutral-500 dark:text-neutral-400">
									{row.id === null ? '—' : formatRelativeTime(row.lastUsedAt)}
								</span>
							{/if}
						</svelte:fragment>
						<svelte:fragment slot="actions" let:row>
							{#if row.id === null}
								<Tooltip text="Set by PROFILARR_API_KEY" position="left">
									<Label variant="secondary" size="sm" rounded="md">env</Label>
								</Tooltip>
							{:else}
								<Button
									icon={Trash2}
									title="Delete API key"
									ariaLabel="Delete API key"
									variant="secondary"
									iconColor="text-red-600 dark:text-red-400"
									size="xs"
									on:click={() => (pendingDelete = row)}
								/>
							{/if}
						</svelte:fragment>
					</Table>
				{:else}
					<p class="text-sm text-neutral-500 dark:text-neutral-400">No API keys yet</p>
				{/if}

				<form
					method="POST"
					action="?/deleteApiKey"
					class="hidden"
					bind:this={deleteForm}
					use:enhance
				>
					<input type="hidden" name="id" value={pendingDelete?.id ?? ''} />
				</form>
			</div>
		</ExpandableCard>

		<!-- Active Sessions -->
		<ExpandableCard
			title="Active Sessions"
			description="Manage your logged-in sessions across devices"
			onboardingId="security-sessions"
		>
			<svelte:fragment slot="header-actions">
				{#if data.sessions.length > 1}
					<form
						method="POST"
						action="?/revokeOtherSessions"
						use:enhance={() => {
							return async ({ update }) => {
								await update();
								await invalidateAll();
							};
						}}
					>
						<Button
							type="submit"
							variant="secondary"
							icon={LogOut}
							iconColor="text-red-500"
							text="Revoke Others"
						/>
					</form>
				{/if}
			</svelte:fragment>
			<div class="p-6">
				{#if data.sessions.length > 0}
					<Table
						columns={sessionColumns}
						data={data.sessions}
						compact
						responsive
						actionsHeader="Status"
					>
						<svelte:fragment slot="actions" let:row>
							{#if row.isCurrent}
								<span
									class="inline-flex items-center rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
									>Current</span
								>
							{:else}
								<form
									method="POST"
									action="?/revokeSession"
									use:enhance={() => {
										return async ({ update }) => {
											await update();
											await invalidateAll();
										};
									}}
								>
									<input type="hidden" name="session" value={row.handle} />
									<Button
										icon={LogOut}
										title="Revoke session"
										ariaLabel="Revoke session"
										variant="secondary"
										iconColor="text-red-600 dark:text-red-400"
										size="xs"
										type="submit"
									/>
								</form>
							{/if}
						</svelte:fragment>
					</Table>
				{:else}
					<p class="text-sm text-neutral-500 dark:text-neutral-400">No active sessions</p>
				{/if}
			</div>
		</ExpandableCard>
	</div>
</div>

<Modal
	open={pendingDelete !== null}
	header="Delete API Key"
	bodyMessage={`Delete "${pendingDelete?.name ?? ''}"? Anything using this key stops working immediately.`}
	confirmText="Delete"
	cancelText="Cancel"
	confirmDanger
	on:confirm={confirmDelete}
	on:cancel={() => (pendingDelete = null)}
/>
