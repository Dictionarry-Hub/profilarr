<script lang="ts">
	import { page } from '$app/stores';
	import ActionsBar from '$ui/actions/ActionsBar.svelte';
	import SearchAction from '$ui/actions/SearchAction.svelte';
	import ActionButton from '$ui/actions/ActionButton.svelte';
	import Dropdown from '$ui/dropdown/Dropdown.svelte';
	import DropdownHeader from '$ui/dropdown/DropdownHeader.svelte';
	import DropdownItem from '$ui/dropdown/DropdownItem.svelte';
	import Button from '$ui/button/Button.svelte';
	import { enhance } from '$app/forms';
	import { alertStore } from '$alerts/store';
	import { Fingerprint, AlertTriangle, HeartHandshake, HandMetal } from 'lucide-svelte';
	import Table from '$ui/table/Table.svelte';
	import type { Column } from '$ui/table/types';
	import { getPersistentSearchStore, type SearchStore } from '$lib/client/stores/search';
	import type { PageData } from './$types';

	export let data: PageData;

	type ConflictRow = {
		opId: number;
		status: string;
		conflictReason: string | null;
		appliedAt: string;
		operation: string;
		entity: string;
		name: string;
		title: string;
		summary: string | null;
		origin: string;
		groupOpIds: number[];
		collapsedCount: number;
	};

	let searchStore: SearchStore;
	$: searchStore = getPersistentSearchStore(`databaseConflictsSearch:${$page.params.id}`, {
		debounceMs: 300
	});

	const entityKeys = Array.from(new Set(data.conflicts.map((row) => row.entity))).sort();
	const reasonKeys = Array.from(
		new Set(data.conflicts.map((row) => row.conflictReason || ''))
	).sort();
	let activeEntities = new Set<string>();
	let activeReasons = new Set<string>();

	function handleConflictAction(successMessage: string, failureMessage: string) {
		return () => {
			return async ({
				result,
				update
			}: {
				result: { type: string; data?: unknown };
				update: () => Promise<void>;
			}) => {
				if (result.type === 'failure' && result.data) {
					alertStore.add('error', (result.data as { error?: string }).error || failureMessage);
				} else if (result.type === 'success') {
					alertStore.add('success', successMessage);
				}
				await update();
			};
		};
	}

	function toggleEntity(entity: string) {
		if (entity === '__all__') {
			activeEntities = new Set();
			return;
		}
		if (activeEntities.has(entity)) {
			activeEntities.delete(entity);
		} else {
			activeEntities.add(entity);
		}
		activeEntities = new Set(activeEntities);
	}

	function toggleReason(reason: string) {
		if (reason === '__all__') {
			activeReasons = new Set();
			return;
		}
		if (activeReasons.has(reason)) {
			activeReasons.delete(reason);
		} else {
			activeReasons.add(reason);
		}
		activeReasons = new Set(activeReasons);
	}

	const reasonLabels: Record<string, string> = {
		guard_mismatch: 'Guard mismatch',
		duplicate_key: 'Duplicate key',
		missing_target: 'Missing target'
	};

	const badgeVariants: Record<string, string> = {
		accent: 'bg-accent-100 text-accent-800 dark:bg-accent-900 dark:text-accent-200',
		neutral: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
		success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
		warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
		danger: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
		info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
	};

	const reasonVariants: Record<string, string> = {
		guard_mismatch: 'warning',
		duplicate_key: 'danger',
		missing_target: 'warning'
	};

	const entityLabels: Record<string, string> = {
		quality_profile: 'Quality Profile',
		custom_format: 'Custom Format',
		regular_expression: 'Regular Expression',
		delay_profile: 'Delay Profile',
		radarr_naming: 'Radarr Naming',
		sonarr_naming: 'Sonarr Naming',
		radarr_media_settings: 'Radarr Media Settings',
		sonarr_media_settings: 'Sonarr Media Settings',
		radarr_quality_definitions: 'Radarr Quality Sizes',
		sonarr_quality_definitions: 'Sonarr Quality Sizes',
		test_entity: 'Test Entity',
		test_release: 'Test Release'
	};

	const entityVariants: Record<string, string> = {
		quality_profile: 'info',
		custom_format: 'accent',
		regular_expression: 'warning',
		delay_profile: 'success',
		radarr_naming: 'neutral',
		sonarr_naming: 'neutral',
		radarr_media_settings: 'neutral',
		sonarr_media_settings: 'neutral',
		radarr_quality_definitions: 'neutral',
		sonarr_quality_definitions: 'neutral',
		test_entity: 'neutral',
		test_release: 'neutral'
	};

	function escapeHtml(value: string): string {
		return value
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	function titleCase(value: string): string {
		return value
			.split(' ')
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');
	}

	function formatEntity(entity: string): string {
		return titleCase(entity.replace(/_/g, ' '));
	}

	function badgeHtml(label: string, variant: string): string {
		const classes = badgeVariants[variant] ?? badgeVariants.neutral;
		return `<span class="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${classes}">${escapeHtml(label)}</span>`;
	}

	const columns: Column<ConflictRow>[] = [
		{
			key: 'opId',
			header: 'Op #',
			width: '90px',
			cell: (row) => ({
				// nosemgrep: profilarr.xss.table-cell-html-unescaped — internal numeric operation ID
				html: `<span class="font-mono text-xs text-neutral-600 dark:text-neutral-400">${row.opId}</span>`
			})
		},
		{
			key: 'entity',
			header: 'Entity',
			width: '170px',
			cell: (row) => {
				const label = entityLabels[row.entity] ?? formatEntity(row.entity);
				const variant = entityVariants[row.entity] ?? 'neutral';
				return { html: badgeHtml(label, variant) };
			}
		},
		{
			key: 'name',
			header: 'Name',
			width: '220px',
			cell: (row) => escapeHtml(row.name || '-')
		},
		{
			key: 'conflictReason',
			header: 'Reason',
			width: '150px',
			cell: (row) => {
				const reasonKey = row.conflictReason ?? 'guard_mismatch';
				const label = reasonLabels[reasonKey] ?? reasonKey;
				const variant = reasonVariants[reasonKey] ?? 'neutral';
				return { html: badgeHtml(label, variant) };
			}
		},
		{
			key: 'title',
			header: 'Operation',
			cell: (row) => {
				return {
					html: `<div class="font-normal text-neutral-900 dark:text-neutral-100">${escapeHtml(row.title)}</div>`
				};
			}
		}
	];

	$: filteredConflicts = data.conflicts.filter((conflict) => {
		const query = $searchStore.query?.trim().toLowerCase();
		const matchesQuery = !query
			? true
			: conflict.title.toLowerCase().includes(query) ||
				conflict.entity.toLowerCase().includes(query) ||
				conflict.name.toLowerCase().includes(query) ||
				(reasonLabels[conflict.conflictReason ?? 'guard_mismatch'] ?? conflict.conflictReason ?? '')
					.toLowerCase()
					.includes(query) ||
				conflict.status.toLowerCase().includes(query);

		const matchesEntity = activeEntities.size === 0 ? true : activeEntities.has(conflict.entity);
		const matchesReason =
			activeReasons.size === 0 ? true : activeReasons.has(conflict.conflictReason ?? '');

		return matchesQuery && matchesEntity && matchesReason;
	});
</script>

<svelte:head>
	<title>Conflicts - {data.database.name} - Profilarr</title>
</svelte:head>

<ActionsBar className="justify-end mt-6">
	<SearchAction {searchStore} placeholder="Search conflicts..." />
	<ActionButton
		icon={Fingerprint}
		title="Filter entity"
		hasDropdown={true}
		dropdownPosition="right"
	>
		<svelte:fragment slot="dropdown" let:dropdownPosition>
			<Dropdown position={dropdownPosition} minWidth="12rem">
				<div class="max-h-64 overflow-y-auto">
					<DropdownHeader label="Entity" />
					<DropdownItem
						label="All"
						selected={activeEntities.size === 0}
						on:click={() => toggleEntity('__all__')}
					/>
					{#each entityKeys as entity}
						<DropdownItem
							label={entityLabels[entity] ?? formatEntity(entity)}
							selected={activeEntities.has(entity)}
							on:click={() => toggleEntity(entity)}
						/>
					{/each}
				</div>
			</Dropdown>
		</svelte:fragment>
	</ActionButton>
	<ActionButton
		icon={AlertTriangle}
		title="Filter reason"
		hasDropdown={true}
		dropdownPosition="right"
	>
		<svelte:fragment slot="dropdown" let:dropdownPosition>
			<Dropdown position={dropdownPosition} minWidth="12rem">
				<div class="max-h-64 overflow-y-auto">
					<DropdownHeader label="Reason" />
					<DropdownItem
						label="All"
						selected={activeReasons.size === 0}
						on:click={() => toggleReason('__all__')}
					/>
					{#each reasonKeys as reason}
						{@const label = (reasonLabels[reason] ?? reason) || 'Unknown'}
						<DropdownItem
							{label}
							selected={activeReasons.has(reason)}
							on:click={() => toggleReason(reason)}
						/>
					{/each}
				</div>
			</Dropdown>
		</svelte:fragment>
	</ActionButton>
</ActionsBar>

<div class="mt-6">
	<Table
		data={filteredConflicts}
		{columns}
		emptyMessage="No conflicts detected"
		hoverable={true}
		compact={true}
		responsive
	>
		<svelte:fragment slot="actions" let:row>
			<div class="flex items-center justify-end gap-1">
				{#if row.collapsedCount > 0}
					<span class="mr-1 text-[10px] font-medium text-neutral-500 dark:text-neutral-400">
						+{row.collapsedCount} more
					</span>
				{/if}
				<form
					method="POST"
					action="?/align"
					use:enhance={handleConflictAction('Conflict aligned', 'Align conflict failed')}
				>
					<input type="hidden" name="groupOpIds" value={JSON.stringify(row.groupOpIds)} />
					<Button
						icon={HeartHandshake}
						text="Align"
						variant="secondary"
						iconColor="text-emerald-600 dark:text-emerald-400"
						size="xs"
						type="submit"
					/>
				</form>
				<form
					method="POST"
					action="?/override"
					use:enhance={handleConflictAction('Conflict override queued', 'Override conflict failed')}
				>
					<input type="hidden" name="groupOpIds" value={JSON.stringify(row.groupOpIds)} />
					<Button
						icon={HandMetal}
						text="Override"
						variant="secondary"
						iconColor="text-accent-600 dark:text-accent-400"
						size="xs"
						type="submit"
					/>
				</form>
			</div>
		</svelte:fragment>
	</Table>
</div>
