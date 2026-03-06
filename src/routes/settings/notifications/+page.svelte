<script lang="ts">
	import { enhance } from '$app/forms';
	import { alertStore } from '$alerts/store';
	import { Plus, Trash2, Bell, BellOff, MessageSquare, Send, Pencil } from 'lucide-svelte';
	import Modal from '$ui/modal/Modal.svelte';
	import NotificationHistory from './components/NotificationHistory.svelte';
	import Table from '$ui/table/Table.svelte';
	import Badge from '$ui/badge/Badge.svelte';
	import type { Column } from '$ui/table/types';
	import { siDiscord } from 'simple-icons';
	import Button from '$ui/button/Button.svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	type Service = (typeof data.services)[0];

	const columns: Column<Service>[] = [
		{ key: 'name', header: 'Service', sortable: true },
		{ key: 'service_type', header: 'Type', sortable: true },
		{ key: 'enabled', header: 'Status', sortable: true },
		{ key: 'stats', header: 'Stats' }
	];

	// Modal state
	let showDeleteModal = false;
	let selectedService: string | null = null;
	let selectedServiceName: string | null = null;
	let deleteFormRef: HTMLFormElement | null = null;

	// Test notification loading state
	let testingServiceId: string | null = null;

	function openDeleteModal(id: string, name: string, formRef: HTMLFormElement) {
		selectedService = id;
		selectedServiceName = name;
		deleteFormRef = formRef;
		showDeleteModal = true;
	}

	function confirmDelete() {
		if (deleteFormRef) {
			deleteFormRef.requestSubmit();
		}
		showDeleteModal = false;
		selectedService = null;
		selectedServiceName = null;
		deleteFormRef = null;
	}

	function cancelDelete() {
		showDeleteModal = false;
		selectedService = null;
		selectedServiceName = null;
		deleteFormRef = null;
	}

	function getServiceIcon(serviceType: string) {
		switch (serviceType) {
			case 'discord':
				return MessageSquare;
			default:
				return Bell;
		}
	}

	function getServiceTypeName(serviceType: string): string {
		switch (serviceType) {
			case 'discord':
				return 'Discord';
			case 'slack':
				return 'Slack';
			case 'email':
				return 'Email';
			default:
				return serviceType;
		}
	}

	function formatSuccessRate(rate: number): string {
		return rate.toFixed(1) + '%';
	}

	function formatNotificationType(type: string): string {
		// Convert 'job.create_backup.success' to 'Backup Success'
		const parts = type.split('.');
		if (parts.length >= 3) {
			const action = parts[1].replace(/_/g, ' ');
			const status = parts[2];
			return `${action.charAt(0).toUpperCase() + action.slice(1)} ${status.charAt(0).toUpperCase() + status.slice(1)}`;
		}
		return type;
	}

	function getEnabledTypes(enabledTypesJson: string): string[] {
		try {
			return JSON.parse(enabledTypesJson);
		} catch {
			return [];
		}
	}
</script>

<div class="p-4 md:p-8">
	<!-- Header -->
	<div class="mb-8">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-2xl font-bold text-neutral-900 md:text-3xl dark:text-neutral-50">
					Notifications
				</h1>
				<p class="mt-2 text-base text-neutral-600 md:mt-3 md:text-lg dark:text-neutral-400">
					Manage notification services and delivery settings
				</p>
			</div>

			<!-- Add Service Button -->
			<Button
				href="/settings/notifications/new"
				icon={Plus}
				iconColor="text-blue-600 dark:text-blue-400"
				text="Add Service"
				variant="secondary"
			/>
		</div>
	</div>

	<!-- Services Table -->
	<Table
		{columns}
		data={data.services}
		emptyMessage="No notification services configured. Click 'Add Service' to get started."
		compact
		responsive
	>
		<svelte:fragment slot="cell" let:row let:column>
			{#if column.key === 'name'}
				<span class="font-medium">{row.name}</span>
			{:else if column.key === 'service_type'}
				<div class="flex items-center gap-2">
					{#if row.service_type === 'discord'}
						<svg
							role="img"
							viewBox="0 0 24 24"
							class="h-4 w-4 text-neutral-600 dark:text-neutral-400"
							fill="currentColor"
						>
							<path d={siDiscord.path} />
						</svg>
					{:else}
						<svelte:component
							this={getServiceIcon(row.service_type)}
							size={16}
							class="text-neutral-600 dark:text-neutral-400"
						/>
					{/if}
					<span>{getServiceTypeName(row.service_type)}</span>
				</div>
			{:else if column.key === 'enabled'}
				<Badge variant={row.enabled ? 'success' : 'neutral'} icon={row.enabled ? Bell : BellOff}>
					{row.enabled ? 'Enabled' : 'Disabled'}
				</Badge>
			{:else if column.key === 'stats'}
				{#if row.successCount + row.failedCount > 0}
					<span class="text-xs">
						<span class="text-green-600 dark:text-green-400">{row.successCount}</span>
						/
						<span class="text-red-600 dark:text-red-400">{row.failedCount}</span>
					</span>
				{:else}
					<span class="text-neutral-400 dark:text-neutral-500">-</span>
				{/if}
			{/if}
		</svelte:fragment>

		<svelte:fragment slot="actions" let:row>
			<div class="flex items-center gap-1">
				<!-- Test Button -->
				<form
					method="POST"
					action="?/testNotification"
					use:enhance={() => {
						testingServiceId = row.id;
						return async ({ result, update }) => {
							if (result.type === 'failure' && result.data) {
								alertStore.add(
									'error',
									(result.data as { error?: string }).error || 'Failed to send test notification'
								);
							} else if (result.type === 'success') {
								alertStore.add('success', 'Test notification sent successfully');
							}
							testingServiceId = null;
							await update();
						};
					}}
				>
					<input type="hidden" name="id" value={row.id} />
					<Button
						icon={Send}
						iconColor="text-accent-600 dark:text-accent-400"
						size="xs"
						type="submit"
						disabled={testingServiceId === row.id}
						loading={testingServiceId === row.id}
						tooltip="Send test notification"
					/>
				</form>

				<!-- Edit Button -->
				<Button
					icon={Pencil}
					size="xs"
					href="/settings/notifications/edit/{row.id}"
					tooltip="Edit service"
				/>

				<!-- Delete Button -->
				<form
					method="POST"
					action="?/delete"
					use:enhance={() => {
						return async ({ result, update }) => {
							if (result.type === 'failure' && result.data) {
								alertStore.add(
									'error',
									(result.data as { error?: string }).error || 'Failed to delete service'
								);
							} else if (result.type === 'success') {
								alertStore.add('success', 'Service deleted successfully');
							}
							await update();
						};
					}}
				>
					<input type="hidden" name="id" value={row.id} />
					<Button
						icon={Trash2}
						iconColor="text-red-600 dark:text-red-400"
						size="xs"
						tooltip="Delete service"
						on:click={(e) => {
							const form = (e.target as HTMLElement)?.closest('form');
							if (form) openDeleteModal(row.id, row.name, form);
						}}
					/>
				</form>
			</div>
		</svelte:fragment>
	</Table>

	<!-- Notification History Component -->
	<div class="mt-8">
		<NotificationHistory history={data.history} services={data.services} />
	</div>
</div>

<!-- Delete Confirmation Modal -->
<Modal
	open={showDeleteModal}
	header="Delete Service"
	bodyMessage="Are you sure you want to delete this notification service? This action cannot be undone.{selectedServiceName
		? `\n\nService: ${selectedServiceName}`
		: ''}"
	confirmText="Delete Service"
	cancelText="Cancel"
	confirmDanger={true}
	on:confirm={confirmDelete}
	on:cancel={cancelDelete}
/>
