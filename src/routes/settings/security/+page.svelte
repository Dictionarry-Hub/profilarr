<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import {
		Copy,
		RefreshCw,
		LogOut,
		Check,
		Globe,
		Monitor,
		Smartphone,
		Network,
		Clock
	} from 'lucide-svelte';
	import { parseUTC } from '$shared/utils/dates';
	import Button from '$ui/button/Button.svelte';
	import ExpandableCard from '$ui/card/ExpandableCard.svelte';
	import FormInput from '$ui/form/FormInput.svelte';
	import Toggle from '$ui/toggle/Toggle.svelte';
	import Table from '$ui/table/Table.svelte';
	import { alertStore } from '$alerts/store';
	import type { Column } from '$ui/table/types';

	export let data: PageData;
	export let form: ActionData;

	let changingPassword = false;
	let currentPassword = '';
	let newPassword = '';
	let confirmPassword = '';

	let regeneratingKey = false;
	let togglingBypass = false;
	let bypassForm: HTMLFormElement;

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
	$: if (form?.apiKeyRegenerated) {
		alertStore.add('success', 'API key regenerated');
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
	$: if (form?.localBypassToggled) {
		alertStore.add('success', `Local bypass ${form.localBypassEnabled ? 'enabled' : 'disabled'}`);
	}

	$: apiKey = form?.apiKey ?? null;

	function copyApiKey() {
		if (apiKey) {
			navigator.clipboard.writeText(apiKey);
			alertStore.add('success', 'API key copied to clipboard');
		}
	}

	function formatDate(dateStr: string): string {
		const date = parseUTC(dateStr);
		return date ? date.toLocaleString() : '';
	}

	interface SessionRow {
		id: string;
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
		return date.toLocaleDateString();
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

<div class="p-4 md:p-8">
	<div class="mb-8">
		<h1 class="text-2xl font-bold text-neutral-900 md:text-3xl dark:text-neutral-50">Security</h1>
		<p class="mt-2 text-base text-neutral-600 md:mt-3 md:text-lg dark:text-neutral-400">
			Manage your password, API key, and active sessions
		</p>
	</div>

	<div class="space-y-8">
		<!-- Change Password -->
		<ExpandableCard title="Change Password" description="Update your account password">
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

		<!-- Local Bypass -->
		<ExpandableCard
			title="Local Bypass"
			description="Skip authentication for requests from local network addresses"
		>
			<div class="p-6">
				<form
					bind:this={bypassForm}
					method="POST"
					action="?/toggleLocalBypass"
					use:enhance={() => {
						togglingBypass = true;
						return async ({ update }) => {
							await update();
							togglingBypass = false;
						};
					}}
				>
					<Toggle
						label={data.localBypassEnabled ? 'Enabled' : 'Disabled'}
						checked={data.localBypassEnabled}
						disabled={togglingBypass}
						on:change={() => bypassForm.requestSubmit()}
					/>
				</form>
			</div>
		</ExpandableCard>

		<!-- API Key -->
		<ExpandableCard
			title="API Key"
			description="Authenticate API requests via the X-Api-Key header"
		>
			<div class="p-6">
				{#if apiKey}
					<!-- Just generated — show key once -->
					<div class="space-y-3">
						<div class="flex items-center gap-2">
							<div class="flex-1">
								<FormInput name="apiKey" label="" type="text" value={apiKey} readonly />
							</div>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								icon={Copy}
								title="Copy"
								ariaLabel="Copy API key"
								on:click={copyApiKey}
							/>
						</div>
						<p class="text-sm text-amber-600 dark:text-amber-400">
							This key is shown only once — copy it now.
						</p>
						<form
							method="POST"
							action="?/regenerateApiKey"
							use:enhance={() => {
								regeneratingKey = true;
								return async ({ update }) => {
									await update();
									regeneratingKey = false;
								};
							}}
						>
							<Button
								type="submit"
								variant="secondary"
								size="sm"
								icon={RefreshCw}
								text={regeneratingKey ? 'Regenerating...' : 'Regenerate'}
								disabled={regeneratingKey}
							/>
						</form>
					</div>
				{:else if data.hasApiKey}
					<!-- Key exists but can't be displayed -->
					<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<p class="text-sm text-neutral-500 dark:text-neutral-400">
							Your API key is hashed and cannot be displayed. Regenerating will replace the current
							key.
						</p>
						<form
							method="POST"
							action="?/regenerateApiKey"
							use:enhance={() => {
								regeneratingKey = true;
								return async ({ update }) => {
									await update();
									regeneratingKey = false;
								};
							}}
						>
							<Button
								type="submit"
								variant="secondary"
								size="sm"
								icon={RefreshCw}
								iconColor="text-emerald-500"
								text={regeneratingKey ? 'Regenerating...' : 'Regenerate'}
								disabled={regeneratingKey}
							/>
						</form>
					</div>
				{:else}
					<!-- No key configured -->
					<div class="flex items-center gap-4">
						<p class="text-sm text-neutral-500 dark:text-neutral-400">No API key configured</p>
						<form method="POST" action="?/regenerateApiKey" use:enhance>
							<Button type="submit" variant="secondary" size="sm" text="Generate Key" />
						</form>
					</div>
				{/if}
			</div>
		</ExpandableCard>

		<!-- Active Sessions -->
		<ExpandableCard
			title="Active Sessions"
			description="Manage your logged-in sessions across devices"
		>
			<svelte:fragment slot="header-right">
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
							size="xs"
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
									<input type="hidden" name="sessionId" value={row.id} />
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
