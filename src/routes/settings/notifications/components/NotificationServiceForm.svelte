<script lang="ts">
	import { enhance } from '$app/forms';
	import { alertStore } from '$alerts/store';
	import DiscordConfiguration from './DiscordConfiguration.svelte';
	import NtfyConfiguration from './NtfyConfiguration.svelte';
	import WebhookConfiguration from './WebhookConfiguration.svelte';
	import { groupNotificationTypesByCategory } from '$shared/notifications/types';
	import { Plus, Save, ListChecks, CheckCircle, XCircle } from 'lucide-svelte';
	import Toggle from '$ui/toggle/Toggle.svelte';
	import FormInput from '$ui/form/FormInput.svelte';
	import DropdownSelect from '$ui/dropdown/DropdownSelect.svelte';
	import Button from '$ui/button/Button.svelte';
	import StickyCard from '$ui/card/StickyCard.svelte';
	import ExpandableTable from '$ui/table/ExpandableTable.svelte';
	import type { Column } from '$ui/table/types';

	export let mode: 'create' | 'edit' = 'create';
	export let initialData: {
		name?: string;
		serviceType?: string;
		config?: Record<string, unknown>;
		enabledTypes?: string[];
	} = {};

	let selectedType: 'discord' | 'ntfy' | 'webhook' =
		(initialData.serviceType as 'discord' | 'ntfy' | 'webhook') || 'discord';
	let serviceName = initialData.name || '';

	// Group notification types by category
	const groupedTypes = groupNotificationTypesByCategory();

	// Track enabled types state
	let enabledTypesState: Record<string, boolean> = {};

	// Initialize enabled types from initialData
	$: {
		for (const [, types] of Object.entries(groupedTypes)) {
			for (const type of types) {
				if (enabledTypesState[type.id] === undefined) {
					enabledTypesState[type.id] = initialData.enabledTypes?.includes(type.id) || false;
				}
			}
		}
	}

	// Category rows for expandable table
	const categoryRows = Object.entries(groupedTypes).map(([category, types]) => ({
		category,
		types
	}));

	type CategoryRow = (typeof categoryRows)[number];

	const typeColumns: Column<CategoryRow>[] = [{ key: 'category', header: 'Category' }];

	// All categories expanded by default
	let expandedCategories = new Set<string | number>(categoryRows.map((r) => r.category));

	const gridColumns = 5;

	function getTypeStatus(typeId: string): 'success' | 'failed' | 'other' {
		if (typeId.endsWith('.success') || typeId.endsWith('_success') || typeId.endsWith('.partial')) {
			return 'success';
		}
		if (typeId.endsWith('.failed') || typeId.endsWith('_failed')) {
			return 'failed';
		}
		return 'other';
	}

	function enableByStatus(status: 'all' | 'success' | 'failed') {
		for (const types of Object.values(groupedTypes)) {
			for (const type of types) {
				enabledTypesState[type.id] = status === 'all' ? true : getTypeStatus(type.id) === status;
			}
		}
		enabledTypesState = enabledTypesState;
	}

	const typeOptions = [
		{ value: 'discord', label: 'Discord' },
		{ value: 'ntfy', label: 'Ntfy' },
		{ value: 'webhook', label: 'Webhook' }
	];

	$: title = mode === 'create' ? 'New Notification Service' : 'Edit Notification Service';
	$: description =
		mode === 'create'
			? 'Configure a new notification service'
			: 'Update notification service configuration';
	$: submitText = mode === 'create' ? 'Create Service' : 'Save Changes';

	let saving = false;
</script>

<form
	method="POST"
	action="?/{mode}"
	use:enhance={() => {
		saving = true;
		return async ({ result, update }) => {
			if (result.type === 'failure' && result.data) {
				alertStore.add(
					'error',
					(result.data as { error?: string }).error || `Failed to ${mode} service`
				);
			} else if (result.type === 'redirect') {
				alertStore.add(
					'success',
					`Notification service ${mode === 'create' ? 'created' : 'updated'} successfully`
				);
			}
			await update();
			saving = false;
		};
	}}
	class="space-y-6"
>
	<StickyCard
		position="top"
		breadcrumbItems={[{ label: 'Notifications', href: '/settings/notifications' }]}
		breadcrumbCurrent={mode === 'edit' ? (initialData.name ?? 'Edit') : 'New'}
	>
		<svelte:fragment slot="left">
			<div>
				<h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{title}</h2>
				<p class="text-sm text-neutral-600 dark:text-neutral-400">{description}</p>
			</div>
		</svelte:fragment>
		<svelte:fragment slot="right">
			<div class="flex items-center gap-2">
				<Button text="Cancel" variant="secondary" href="/settings/notifications" />
				<Button
					text={saving ? 'Saving...' : submitText}
					icon={mode === 'create' ? Plus : Save}
					iconColor="text-blue-600 dark:text-blue-400"
					disabled={saving || !serviceName}
					type="submit"
				/>
			</div>
		</svelte:fragment>
	</StickyCard>

	<!-- Hidden fields for form submission -->
	<input type="hidden" name="type" value={selectedType} />
	<input type="hidden" name="name" value={serviceName} />

	<div class="space-y-6 md:px-4">
		<!-- Service Type -->
		<div class="space-y-2">
			<span class="block text-sm font-semibold text-neutral-900 dark:text-neutral-100">
				Service Type
			</span>
			{#if mode === 'edit'}
				<p class="text-xs text-neutral-500 dark:text-neutral-400">
					Type cannot be changed after creation
				</p>
			{/if}
			<DropdownSelect
				value={selectedType}
				options={typeOptions}
				disabled={mode === 'edit'}
				fullWidth
				on:change={(e) => (selectedType = e.detail as typeof selectedType)}
			/>
		</div>

		<!-- Service Name -->
		<FormInput
			label="Service Name"
			name="service_name"
			value={serviceName}
			placeholder={selectedType === 'ntfy'
				? 'e.g., Phone Alerts'
				: selectedType === 'webhook'
					? 'e.g., Home Assistant'
					: 'e.g., Main Discord Server'}
			description="A friendly name to identify this notification service"
			required
			on:input={(e) => (serviceName = e.detail)}
		/>

		<!-- Service Configuration -->
		{#if selectedType === 'discord'}
			<DiscordConfiguration config={initialData.config} {mode} />
		{:else if selectedType === 'ntfy'}
			<NtfyConfiguration config={initialData.config} {mode} />
		{:else if selectedType === 'webhook'}
			<WebhookConfiguration config={initialData.config} {mode} />
		{/if}

		<!-- Notification Types -->
		<div class="space-y-4">
			<div class="flex items-start justify-between">
				<div>
					<h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
						Notification Types
					</h3>
					<p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
						Select which types of notifications should be sent to this service
					</p>
				</div>
				<div class="flex items-center gap-1">
					<Button
						text="All"
						icon={ListChecks}
						iconColor="text-blue-500 dark:text-blue-400"
						size="sm"
						variant="secondary"
						on:click={() => enableByStatus('all')}
					/>
					<Button
						text="Success"
						icon={CheckCircle}
						iconColor="text-green-500 dark:text-green-400"
						size="sm"
						variant="secondary"
						on:click={() => enableByStatus('success')}
					/>
					<Button
						text="Failed"
						icon={XCircle}
						iconColor="text-red-500 dark:text-red-400"
						size="sm"
						variant="secondary"
						on:click={() => enableByStatus('failed')}
					/>
				</div>
			</div>

			<ExpandableTable
				columns={typeColumns}
				data={categoryRows}
				getRowId={(row) => row.category}
				expandedRows={expandedCategories}
				chevronPosition="right"
				flushExpanded
				compact
			>
				<svelte:fragment slot="cell" let:row let:column>
					{#if column.key === 'category'}
						<span
							class="text-xs font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400"
						>
							{row.category}
						</span>
					{/if}
				</svelte:fragment>

				<svelte:fragment slot="expanded" let:row>
					<div
						class="grid gap-2 px-4 py-3"
						style="grid-template-columns: repeat({gridColumns}, 1fr);"
					>
						{#each row.types as type}
							<div>
								<Toggle
									label={type.label}
									checked={enabledTypesState[type.id]}
									fullWidth
									on:change={() => (enabledTypesState[type.id] = !enabledTypesState[type.id])}
								/>
								<input
									type="hidden"
									name={type.id}
									value={enabledTypesState[type.id] ? 'on' : ''}
								/>
							</div>
						{/each}
					</div>
				</svelte:fragment>
			</ExpandableTable>
		</div>
	</div>
</form>
