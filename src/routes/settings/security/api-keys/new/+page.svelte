<script lang="ts">
	import { onDestroy } from 'svelte';
	import { enhance } from '$app/forms';
	import { beforeNavigate, goto } from '$app/navigation';
	import { Plus, Copy, Check } from '@lucide/svelte';
	import type { PageData } from './$types';
	import PageMeta from '$ui/meta/PageMeta.svelte';
	import StickyCard from '$ui/card/StickyCard.svelte';
	import FormInput from '$ui/form/FormInput.svelte';
	import DropdownSelect from '$ui/dropdown/DropdownSelect.svelte';
	import Toggle from '$ui/toggle/Toggle.svelte';
	import Button from '$ui/button/Button.svelte';
	import Modal from '$ui/modal/Modal.svelte';
	import DirtyModal from '$ui/modal/DirtyModal.svelte';
	import Table from '$ui/table/Table.svelte';
	import type { Column } from '$ui/table/types';
	import { alertStore } from '$alerts/store';
	import { copyToClipboard } from '$lib/client/utils/clipboard';
	import { current, initCreate, update, clear } from '$lib/client/stores/dirty';
	import {
		API_KEY_EXPIRY_OPTIONS,
		DEFAULT_API_KEY_EXPIRY,
		type ApiArea,
		type ApiKeyAccess,
		type ApiKeyAreaPermissions
	} from '$shared/apiKeys';

	export let data: PageData;

	type AreaAccess = 'none' | ApiKeyAccess;

	interface ApiKeyFormData {
		name: string;
		expiry: string;
		fullAccess: boolean;
		access: Record<string, AreaAccess>;
		[key: string]: unknown;
	}

	const defaults: ApiKeyFormData = {
		name: '',
		expiry: DEFAULT_API_KEY_EXPIRY,
		fullAccess: false,
		access: Object.fromEntries(data.apiAreas.map((area) => [area.id, 'none']))
	};

	initCreate(defaults);
	onDestroy(clear);

	$: formData = $current as ApiKeyFormData;

	const expiryOptions = API_KEY_EXPIRY_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

	const areaColumns: Column<ApiArea>[] = [
		{ key: 'name', header: 'Area' },
		{ key: 'access', header: 'Access' }
	];

	function accessOptions(writable: boolean) {
		const options = [
			{ value: 'none', label: 'No access' },
			{ value: 'read', label: 'Read' }
		];
		return writable ? [...options, { value: 'write', label: 'Read & write' }] : options;
	}

	function setAccess(areaId: string, access: AreaAccess) {
		update('access', { ...formData.access, [areaId]: access });
	}

	$: permissions = Object.fromEntries(
		Object.entries(formData.access ?? {}).filter(([, access]) => access !== 'none')
	) as ApiKeyAreaPermissions;
	$: grantsAccess = formData.fullAccess || Object.keys(permissions).length > 0;
	$: createDisabledReason = !formData.name?.trim()
		? 'Give the key a name'
		: !grantsAccess
			? 'Grant access to at least one area, or give the key full access'
			: '';

	let saving = false;
	let created: { name: string; key: string } | null = null;
	let copied = false;

	async function copyKey() {
		if (!created) return;
		const ok = await copyToClipboard(created.key);
		if (ok) copied = true;
		alertStore.add(
			ok ? 'success' : 'error',
			ok ? 'API key copied to clipboard' : 'Failed to copy to clipboard'
		);
	}

	// Once the key is shown, leaving without copying it loses it for good
	let leaveModalOpen = false;
	let pendingUrl: string | null = null;
	let allowLeave = false;

	beforeNavigate((navigation) => {
		if (!created || copied || allowLeave) return;
		navigation.cancel();
		// Refresh and tab close fall back to the browser's own prompt
		if (navigation.type === 'leave') return;
		pendingUrl = navigation.to?.url.pathname ?? null;
		leaveModalOpen = true;
	});

	function leaveAnyway() {
		leaveModalOpen = false;
		allowLeave = true;
		if (pendingUrl) goto(pendingUrl);
	}
</script>

<PageMeta title="Security · New API Key" />

<div class="p-4 md:p-8">
	{#if created}
		<div class="space-y-6">
			<StickyCard
				position="top"
				breadcrumbItems={[{ label: 'Security', href: '/settings/security' }]}
				breadcrumbCurrent="New API Key"
			>
				<svelte:fragment slot="left">
					<div>
						<h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
							"{created.name}" created
						</h2>
						<p class="text-sm text-neutral-600 dark:text-neutral-400">
							Send it in the X-Api-Key header
						</p>
					</div>
				</svelte:fragment>
				<svelte:fragment slot="right">
					<Button
						text="Done"
						icon={Check}
						iconColor="text-accent-500"
						on:click={() => goto('/settings/security')}
					/>
				</svelte:fragment>
			</StickyCard>

			<div class="space-y-3 md:px-4">
				<div class="flex items-center gap-2">
					<div class="flex-1">
						<FormInput label="API key" hideLabel value={created.key} readonly mono />
					</div>
					<Button
						icon={copied ? Check : Copy}
						iconColor={copied ? 'text-emerald-500' : ''}
						text={copied ? 'Copied' : 'Copy'}
						on:click={copyKey}
					/>
				</div>
				<p class="text-sm text-amber-600 dark:text-amber-400">
					This key is shown once. Copy it now; it can't be recovered.
				</p>
			</div>
		</div>
	{:else}
		<form
			method="POST"
			action="?/create"
			class="space-y-6"
			use:enhance={() => {
				saving = true;
				return async ({ result }) => {
					saving = false;
					if (result.type === 'success' && result.data?.created) {
						clear();
						created = result.data.created as { name: string; key: string };
					} else if (result.type === 'failure') {
						alertStore.add(
							'error',
							(result.data as { error?: string } | undefined)?.error ?? 'Failed to create API key'
						);
					} else if (result.type === 'error') {
						alertStore.add('error', 'Failed to create API key');
					}
				};
			}}
		>
			<StickyCard
				position="top"
				breadcrumbItems={[{ label: 'Security', href: '/settings/security' }]}
				breadcrumbCurrent="New API Key"
			>
				<svelte:fragment slot="left">
					<div>
						<h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">New API Key</h2>
						<p class="text-sm text-neutral-600 dark:text-neutral-400">
							Lets scripts and integrations use the Profilarr API
						</p>
					</div>
				</svelte:fragment>
				<svelte:fragment slot="right">
					<div class="flex items-center gap-2">
						<Button text="Cancel" variant="secondary" href="/settings/security" />
						<Button
							text={saving ? 'Creating...' : 'Create'}
							icon={Plus}
							iconColor="text-blue-600 dark:text-blue-400"
							disabled={saving || createDisabledReason !== ''}
							tooltip={createDisabledReason}
							tooltipAlign="right"
							type="submit"
						/>
					</div>
				</svelte:fragment>
			</StickyCard>

			<input type="hidden" name="name" value={formData.name} />
			<input type="hidden" name="expiry" value={formData.expiry} />
			<input type="hidden" name="fullAccess" value={formData.fullAccess ? 'on' : ''} />
			<input type="hidden" name="permissions" value={JSON.stringify(permissions)} />

			<div class="space-y-6 md:px-4">
				<div class="grid grid-cols-1 gap-4 md:grid-cols-8">
					<div class="md:col-span-6">
						<FormInput
							label="Name"
							value={formData.name}
							placeholder="e.g. Homepage widget"
							description="Shown in the key list and in logs"
							required
							on:input={(e) => update('name', e.detail)}
						/>
					</div>
					<div class="space-y-2 md:col-span-2">
						<span class="block text-sm font-semibold text-neutral-900 dark:text-neutral-100">
							Expires After
						</span>
						<p class="text-xs text-neutral-500 dark:text-neutral-400">
							This key stops working after:
						</p>
						<DropdownSelect
							value={formData.expiry}
							options={expiryOptions}
							fullWidth
							on:change={(e) => update('expiry', e.detail)}
						/>
					</div>
				</div>

				<div class="space-y-3">
					<div class="flex items-start justify-between gap-4">
						<div>
							<span class="block text-sm font-semibold text-neutral-900 dark:text-neutral-100">
								Access
							</span>
							<p class="text-xs text-neutral-500 dark:text-neutral-400">
								Full access covers every area, including ones added in future versions
							</p>
						</div>
						<Toggle
							label="Full access"
							checked={formData.fullAccess}
							on:change={(e) => update('fullAccess', e.detail)}
						/>
					</div>

					<Table columns={areaColumns} data={data.apiAreas} compact responsive hoverable={false}>
						<svelte:fragment slot="cell" let:row let:column>
							{#if column.key === 'name'}
								<span
									class="text-sm {formData.fullAccess
										? 'text-neutral-400 dark:text-neutral-500'
										: 'text-neutral-900 dark:text-neutral-100'}">{row.name}</span
								>
							{:else if column.key === 'access'}
								<!-- With full access on, each area shows what full access grants it -->
								<DropdownSelect
									value={formData.fullAccess
										? row.writable
											? 'write'
											: 'read'
										: (formData.access?.[row.id] ?? 'none')}
									options={accessOptions(row.writable)}
									minWidth="10rem"
									width="w-40"
									fullWidth
									fixed
									disabled={formData.fullAccess}
									on:change={(e) => setAccess(row.id, e.detail as AreaAccess)}
								/>
							{/if}
						</svelte:fragment>
					</Table>
				</div>
			</div>
		</form>
	{/if}
</div>

<DirtyModal />

<Modal
	open={leaveModalOpen}
	header="Key Not Copied"
	bodyMessage="You haven't copied this API key. It can't be shown again, so you'll need to delete it and create a new one if you leave now."
	confirmText="Leave Anyway"
	cancelText="Stay"
	confirmDanger
	on:confirm={leaveAnyway}
	on:cancel={() => (leaveModalOpen = false)}
/>
