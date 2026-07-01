<script lang="ts">
	import { page } from '$app/stores';
	import ActionsBar from '$ui/actions/ActionsBar.svelte';
	import SearchAction from '$ui/actions/SearchAction.svelte';
	import ActionButton from '$ui/actions/ActionButton.svelte';
	import Dropdown from '$ui/dropdown/Dropdown.svelte';
	import DropdownHeader from '$ui/dropdown/DropdownHeader.svelte';
	import DropdownItem from '$ui/dropdown/DropdownItem.svelte';
	import Button from '$ui/button/Button.svelte';
	import InfoModal from '$ui/modal/InfoModal.svelte';
	import ExpandableCard from '$ui/card/ExpandableCard.svelte';
	import Label from '$ui/label/Label.svelte';
	import ConflictField from './ConflictField.svelte';
	import { enhance } from '$app/forms';
	import { alertStore } from '$alerts/store';
	import { Fingerprint, AlertTriangle, HeartHandshake, HandMetal, Info } from 'lucide-svelte';
	import { getPersistentSearchStore, type SearchStore } from '$lib/client/stores/search';
	import type { PageData } from './$types';

	export let data: PageData;

	type FieldConflict = {
		field: string;
		was: unknown;
		you: unknown;
		upstreamNow: unknown;
	};

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
		groupId: string | null;
		fields: FieldConflict[];
		complex: boolean;
	};

	type ConflictGroup = {
		key: string;
		title: string;
		entity: string;
		name: string;
		conflicts: ConflictRow[];
	};

	function groupKey(row: ConflictRow): string {
		return row.groupId ?? `op-${row.opId}`;
	}

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
	let showInfoModal = false;

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

	type LabelVariant =
		| 'default'
		| 'secondary'
		| 'destructive'
		| 'outline'
		| 'ghost'
		| 'success'
		| 'warning'
		| 'danger'
		| 'info'
		| 'link';

	const reasonLabels: Record<string, string> = {
		guard_mismatch: 'Guard mismatch',
		duplicate_key: 'Duplicate key',
		missing_target: 'Missing target'
	};

	const reasonVariants: Record<string, LabelVariant> = {
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

	const entityVariants: Record<string, LabelVariant> = {
		quality_profile: 'info',
		custom_format: 'default',
		regular_expression: 'warning',
		delay_profile: 'success',
		radarr_naming: 'secondary',
		sonarr_naming: 'secondary',
		radarr_media_settings: 'secondary',
		sonarr_media_settings: 'secondary',
		radarr_quality_definitions: 'secondary',
		sonarr_quality_definitions: 'secondary',
		test_entity: 'secondary',
		test_release: 'secondary'
	};

	function titleCase(value: string): string {
		return value
			.split(' ')
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');
	}

	function formatEntity(entity: string): string {
		return titleCase(entity.replace(/_/g, ' '));
	}

	function formatValue(value: unknown): string {
		if (value === null || value === undefined) return '—';
		if (typeof value === 'boolean') return value ? 'Yes' : 'No';
		if (typeof value === 'string') {
			if (value === '') return '(empty)';
			return value;
		}
		if (typeof value === 'number') return String(value);
		try {
			return JSON.stringify(value);
		} catch {
			return String(value);
		}
	}

	function reasonLabel(reason: string | null): string {
		const key = reason ?? 'guard_mismatch';
		return reasonLabels[key] ?? key;
	}

	function reasonVariant(reason: string | null): LabelVariant {
		const key = reason ?? 'guard_mismatch';
		return reasonVariants[key] ?? 'secondary';
	}

	function entityLabel(entity: string): string {
		return entityLabels[entity] ?? formatEntity(entity);
	}

	function entityVariant(entity: string): LabelVariant {
		return entityVariants[entity] ?? 'secondary';
	}

	function rowMatchesQuery(conflict: ConflictRow, query: string): boolean {
		if (!query) return true;
		const haystack = [
			conflict.title,
			conflict.entity,
			conflict.name,
			reasonLabels[conflict.conflictReason ?? 'guard_mismatch'] ?? conflict.conflictReason ?? '',
			conflict.status,
			...conflict.fields.flatMap((f) => [
				f.field,
				formatValue(f.was),
				formatValue(f.you),
				formatValue(f.upstreamNow)
			])
		]
			.join(' ')
			.toLowerCase();
		return haystack.includes(query);
	}

	$: filteredConflicts = data.conflicts.filter((conflict) => {
		const query = $searchStore.query?.trim().toLowerCase() ?? '';
		const matchesQuery = rowMatchesQuery(conflict, query);
		const matchesEntity = activeEntities.size === 0 ? true : activeEntities.has(conflict.entity);
		const matchesReason =
			activeReasons.size === 0 ? true : activeReasons.has(conflict.conflictReason ?? '');
		return matchesQuery && matchesEntity && matchesReason;
	});

	$: filteredGroups = ((): ConflictGroup[] => {
		const groups = new Map<string, ConflictGroup>();
		for (const conflict of filteredConflicts) {
			const key = groupKey(conflict);
			let group = groups.get(key);
			if (!group) {
				group = {
					key,
					title: conflict.title,
					entity: conflict.entity,
					name: conflict.name,
					conflicts: []
				};
				groups.set(key, group);
			}
			group.conflicts.push(conflict);
		}
		// Stable order: groups in their natural appearance order; conflicts within
		// a group ordered by opId so split-save siblings render in a predictable
		// sequence.
		for (const group of groups.values()) {
			group.conflicts.sort((a, b) => a.opId - b.opId);
		}
		return Array.from(groups.values());
	})();
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
	<ActionButton
		icon={Info}
		title="About conflict actions"
		on:click={() => (showInfoModal = true)}
	/>
</ActionsBar>

<div class="mt-6 space-y-4">
	{#if filteredGroups.length === 0}
		<div
			class="rounded-card border border-border bg-surface p-8 text-center text-sm text-text-soft"
		>
			No conflicts detected
		</div>
	{:else}
		{#each filteredGroups as group (group.key)}
			<ExpandableCard
				title={group.title}
				description={group.conflicts.length > 1
					? `${group.conflicts.length} fields conflicted`
					: ''}
				open
			>
				<svelte:fragment slot="header-right">
					<Label variant={entityVariant(group.entity)} size="sm" radius="md">
						{entityLabel(group.entity)}
					</Label>
				</svelte:fragment>
				<div class="divide-y divide-border">
					{#each group.conflicts as row (row.opId)}
						<div
							class="flex flex-col gap-4 px-4 py-4 md:flex-row md:items-start md:justify-between"
						>
							<div class="flex-1 space-y-3">
								<div class="flex flex-wrap items-center gap-2 text-xs">
									<span class="font-mono text-text-muted">#{row.opId}</span>
									<Label variant={reasonVariant(row.conflictReason)} size="sm" radius="md">
										{reasonLabel(row.conflictReason)}
									</Label>
								</div>
								{#if row.complex}
									<p class="text-xs text-text-muted">
										Complex change &middot; {row.summary ?? row.title}
									</p>
								{:else if row.fields.length === 0}
									<p class="text-xs text-text-muted">
										{row.summary ?? row.title}
									</p>
								{:else}
									<div class="space-y-4">
										{#each row.fields as field (field.field)}
											<ConflictField
												field={field.field}
												was={field.was}
												you={field.you}
												upstreamNow={field.upstreamNow}
											/>
										{/each}
									</div>
								{/if}
							</div>
							<div class="flex shrink-0 items-center gap-2">
								<form
									method="POST"
									action="?/align"
									use:enhance={handleConflictAction('Conflict aligned', 'Align conflict failed')}
								>
									<input type="hidden" name="opId" value={row.opId} />
									<Button
										icon={HeartHandshake}
										text="Align"
										variant="secondary"
										iconColor="text-success-icon "
										size="sm"
										type="submit"
									/>
								</form>
								<form
									method="POST"
									action="?/override"
									use:enhance={handleConflictAction(
										'Conflict override queued',
										'Override conflict failed'
									)}
								>
									<input type="hidden" name="opId" value={row.opId} />
									<Button
										icon={HandMetal}
										text="Override"
										variant="secondary"
										iconColor="text-accent-solid"
										size="sm"
										type="submit"
									/>
								</form>
							</div>
						</div>
					{/each}
				</div>
			</ExpandableCard>
		{/each}
	{/if}
</div>

<InfoModal bind:open={showInfoModal} header="Conflict Actions">
	<div class="space-y-4 text-sm text-text-soft">
		<section>
			<h3 class="mb-2 font-semibold text-text">Align</h3>
			<p>Align accepts the database version and discards your local change for this conflict.</p>
		</section>

		<section>
			<h3 class="mb-2 font-semibold text-text">Override</h3>
			<p>Override keeps your local change and reapplies it on top of the new version.</p>
		</section>
	</div>
</InfoModal>
