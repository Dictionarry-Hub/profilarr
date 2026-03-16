<script lang="ts">
	import { enhance } from '$app/forms';
	import { alertStore } from '$alerts/store';
	import DiscordConfiguration from './DiscordConfiguration.svelte';
	import { groupNotificationTypesByCategory } from '$shared/notifications/types';
	import { Plus, Save } from 'lucide-svelte';
	import Toggle from '$ui/toggle/Toggle.svelte';
	import FormInput from '$ui/form/FormInput.svelte';
	import DropdownSelect from '$ui/dropdown/DropdownSelect.svelte';
	import Button from '$ui/button/Button.svelte';
	import StickyCard from '$ui/card/StickyCard.svelte';

	export let mode: 'create' | 'edit' = 'create';
	export let initialData: {
		name?: string;
		serviceType?: string;
		config?: Record<string, unknown>;
		enabledTypes?: string[];
	} = {};

	let selectedType: 'discord' | 'slack' | 'email' =
		(initialData.serviceType as 'discord') || 'discord';
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

	const typeOptions = [{ value: 'discord', label: 'Discord' }];

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
			placeholder="e.g., Main Discord Server"
			description="A friendly name to identify this notification service"
			required
			on:input={(e) => (serviceName = e.detail)}
		/>

		<!-- Service Configuration -->
		{#if selectedType === 'discord'}
			<DiscordConfiguration config={initialData.config} {mode} />
		{/if}

		<!-- Notification Types -->
		<div class="space-y-4">
			<div>
				<h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
					Notification Types
				</h3>
				<p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
					Select which types of notifications should be sent to this service
				</p>
			</div>

			{#each Object.entries(groupedTypes) as [category, types]}
				<div>
					<h4
						class="mb-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400"
					>
						{category}
					</h4>
					<div class="flex flex-wrap gap-2">
						{#each types as type}
							<div>
								<Toggle
									label={type.label}
									checked={enabledTypesState[type.id]}
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
				</div>
			{/each}
		</div>
	</div>
</form>
