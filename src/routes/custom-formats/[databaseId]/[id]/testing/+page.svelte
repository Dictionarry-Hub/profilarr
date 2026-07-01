<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';
	import { Plus, AlertTriangle, Check, X, Pencil, Trash2 } from 'lucide-svelte';
	import ExpandableTable from '$ui/table/ExpandableTable.svelte';
	import Badge from '$ui/badge/Badge.svelte';
	import Modal from '$ui/modal/Modal.svelte';
	import StickyCard from '$ui/card/StickyCard.svelte';
	import Button from '$ui/button/Button.svelte';
	import type { Column } from '$ui/table/types';
	import type { PageData } from './$types';
	import type { TestWithResult } from './+page.server';
	import { clear } from '$lib/client/stores/dirty';
	import { alertStore } from '$lib/client/alerts/store';

	export let data: PageData;
	let readOnly = false;

	const readOnlyMessage = 'Entity tests are read-only for this database.';

	function notifyReadOnly() {
		alertStore.add('info', readOnlyMessage);
	}

	// Clear dirty state - this is a read-only listing page
	clear();

	type Test = TestWithResult;
	type Condition = Test['conditions'][number];

	const columns: Column<Test>[] = [
		{
			key: 'title',
			header: 'Release Title',
			sortable: true
		},
		{
			key: 'should_match',
			header: 'Expected',
			width: 'w-40',
			align: 'center',
			sortable: true
		},
		{
			key: 'type',
			header: 'Type',
			width: 'w-24',
			align: 'center',
			sortable: true
		},
		{
			key: 'result',
			header: 'Result',
			width: 'w-24',
			align: 'center',
			sortable: true
		}
	];

	$: readOnly = !data.canWriteToBase;

	function handleAddTest() {
		if (readOnly) {
			notifyReadOnly();
			return;
		}
		goto(`/custom-formats/${$page.params.databaseId}/${$page.params.id}/testing/new`);
	}

	function getRowId(test: Test) {
		return `${test.title}:${test.type}`;
	}

	// Delete modal state
	let showDeleteModal = false;
	let testToDelete: Test | null = null;
	let deleteForm: HTMLFormElement | null = null;

	function handleDeleteClick(test: Test, form: HTMLFormElement) {
		testToDelete = test;
		deleteForm = form;
		showDeleteModal = true;
	}

	function handleDeleteConfirm() {
		if (deleteForm) {
			deleteForm.requestSubmit();
		}
		showDeleteModal = false;
		testToDelete = null;
		deleteForm = null;
	}

	function handleDeleteCancel() {
		showDeleteModal = false;
		testToDelete = null;
		deleteForm = null;
	}
</script>

<svelte:head>
	<title>{data.format.name} - Testing - Profilarr</title>
</svelte:head>

<div class="space-y-6">
	<StickyCard position="top">
		<svelte:fragment slot="left">
			<div>
				<h2 class="text-lg font-semibold text-text">Test Cases</h2>
				<p class="text-sm text-text-soft">Test release titles against this custom format</p>
			</div>
		</svelte:fragment>
		<svelte:fragment slot="right">
			<Button
				text="Add Test"
				icon={Plus}
				iconColor="text-info-icon "
				variant="secondary"
				onboarding="cf-testing-add"
				on:click={handleAddTest}
			/>
		</svelte:fragment>
	</StickyCard>

	<div class="mt-6 space-y-6 pb-12 md:px-4">
		<!-- Parser Warning -->
		{#if !data.parserAvailable}
			<div
				class="flex items-center gap-3 rounded-card border border-warning-border bg-warning-bg p-4"
			>
				<AlertTriangle size={20} class="text-warning-icon " />
				<div>
					<p class="text-sm font-medium text-warning-text">Parser service unavailable</p>
					<p class="text-xs text-warning-icon">
						Test results cannot be evaluated. Start the parser microservice to see pass/fail status.
					</p>
				</div>
			</div>
		{/if}

		<!-- Tests List -->
		{#if data.tests.length === 0}
			<div class="rounded-card border border-border bg-surface p-8 text-center">
				<p class="text-text-soft">
					No test cases yet. Add a test to verify this custom format works correctly.
				</p>
			</div>
		{:else}
			<ExpandableTable
				{columns}
				data={data.tests}
				{getRowId}
				emptyMessage="No test cases found"
				flushExpanded={true}
				responsive={true}
			>
				<svelte:fragment slot="cell" let:row let:column>
					{#if column.key === 'title'}
						<code class="font-mono text-sm">{row.title}</code>
						{#if row.description}
							<p class="mt-1 text-xs text-text-muted">{row.description}</p>
						{/if}
					{:else if column.key === 'should_match'}
						{#if row.should_match}
							<span
								class="inline-flex items-center gap-1 rounded-control-sm bg-success-bg px-2 py-0.5 text-xs font-medium text-success-text"
								>Should Match</span
							>
						{:else}
							<span
								class="inline-flex items-center gap-1 rounded-control-sm bg-danger-bg px-2 py-0.5 text-xs font-medium text-danger-text"
								>Shouldn't Match</span
							>
						{/if}
					{:else if column.key === 'type'}
						<span
							class="inline-flex items-center gap-1 rounded-control-sm bg-surface-hover px-2 py-0.5 text-xs font-medium text-text-soft"
							>{row.type}</span
						>
					{:else if column.key === 'result'}
						{#if row.result === 'pass'}
							<div class="flex items-center justify-center">
								<div class="flex h-6 w-6 items-center justify-center rounded-pill bg-success-bg">
									<Check size={14} class="text-success-icon " />
								</div>
							</div>
						{:else if row.result === 'fail'}
							<div class="flex items-center justify-center">
								<div class="flex h-6 w-6 items-center justify-center rounded-pill bg-danger-bg">
									<X size={14} class="text-danger-icon " />
								</div>
							</div>
						{:else}
							<div class="flex items-center justify-center">
								<div class="flex h-6 w-6 items-center justify-center rounded-pill bg-warning-bg">
									<span class="text-sm font-medium text-warning-icon">?</span>
								</div>
							</div>
						{/if}
					{/if}
				</svelte:fragment>

				<svelte:fragment slot="expanded" let:row>
					{@const conditionTypeLabels: Record<string, string> = {
					'release_title': 'Release Title',
					'source': 'Source',
					'resolution': 'Resolution',
					'quality_modifier': 'Quality Modifier',
					'language': 'Language',
					'release_group': 'Release Group',
					'release_type': 'Release Type',
					'year': 'Year',
					'edition': 'Edition',
					'indexer_flag': 'Indexer Flag',
					'size': 'Size'
				}}
					{@const groupedConditions = row.conditions.reduce<Record<string, Condition[]>>(
						(acc, c) => {
							if (!acc[c.conditionType]) acc[c.conditionType] = [];
							acc[c.conditionType].push(c);
							return acc;
						},
						{}
					)}
					{@const conditionTypes = Object.keys(groupedConditions)}
					{@const allRequiredPass = row.conditions
						.filter((c: Condition) => c.required)
						.every((c: Condition) => c.passes)}
					{@const optionalConditions = row.conditions.filter((c: Condition) => !c.required)}
					{@const optionalPass =
						optionalConditions.length === 0 || optionalConditions.some((c: Condition) => c.passes)}

					<div class="px-4 py-3">
						{#if row.conditions.length > 0}
							<div class="overflow-x-auto rounded-card border border-border">
								<!-- lint-disable-next-line no-raw-ui -- rowspan grouping not supported by Table component -->
								<table class="w-full text-sm">
									<thead class="border-b border-border bg-surface-muted">
										<tr>
											<th
												class="px-3 py-2 text-left text-xs font-medium tracking-wider text-text-soft uppercase"
												>Type</th
											>
											<th
												class="px-3 py-2 text-left text-xs font-medium tracking-wider text-text-soft uppercase"
												>Condition</th
											>
											<th
												class="px-3 py-2 text-left text-xs font-medium tracking-wider text-text-soft uppercase"
												>Expected</th
											>
											<th
												class="px-3 py-2 text-left text-xs font-medium tracking-wider text-text-soft uppercase"
												>Actual</th
											>
											<th
												class="px-3 py-2 text-center text-xs font-medium tracking-wider text-text-soft uppercase"
												>Pass</th
											>
											<th
												class="px-3 py-2 text-center text-xs font-medium tracking-wider text-text-soft uppercase"
												>Type Pass</th
											>
											<th
												class="px-3 py-2 text-center text-xs font-medium tracking-wider text-text-soft uppercase"
												>Expected</th
											>
											<th
												class="px-3 py-2 text-center text-xs font-medium tracking-wider text-text-soft uppercase"
												>Actual</th
											>
											<th
												class="px-3 py-2 text-center text-xs font-medium tracking-wider text-text-soft uppercase"
												>Result</th
											>
										</tr>
									</thead>
									<tbody class="divide-y divide-border bg-surface">
										{#each conditionTypes as conditionType, typeIndex}
											{@const conditions = groupedConditions[conditionType]}
											{#each conditions as condition, condIndex}
												<tr>
													{#if condIndex === 0}
														<td
															rowspan={conditions.length}
															class="border-r border-border px-3 py-2 align-top font-medium text-text"
														>
															{conditionTypeLabels[conditionType] || conditionType}
														</td>
													{/if}
													<td class="px-3 py-2 text-text-soft">
														<div class="flex items-center gap-2">
															<span>{condition.conditionName}</span>
															{#if condition.required}
																<Badge variant={condition.negate ? 'danger' : 'success'}
																	>Required</Badge
																>
															{/if}
														</div>
													</td>
													<td
														class="max-w-48 truncate px-3 py-2 font-mono text-xs text-text-soft"
														title={condition.expected}
													>
														{condition.expected}
													</td>
													<td
														class="max-w-48 truncate px-3 py-2 font-mono text-xs text-text-soft"
														title={condition.actual}
													>
														{condition.actual}
													</td>
													<td class="px-3 py-2 text-center">
														{#if condition.passes}
															<div
																class="inline-flex h-5 w-5 items-center justify-center rounded-pill bg-success-bg"
															>
																<Check size={12} class="text-success-icon " />
															</div>
														{:else}
															<div
																class="inline-flex h-5 w-5 items-center justify-center rounded-pill bg-danger-bg"
															>
																<X size={12} class="text-danger-icon " />
															</div>
														{/if}
													</td>
													{#if condIndex === 0}
														{@const requiredPass = conditions
															.filter((c: Condition) => c.required)
															.every((c: Condition) => c.passes)}
														{@const optionalConditions = conditions.filter(
															(c: Condition) => !c.required
														)}
														{@const optionalPass =
															optionalConditions.length === 0 ||
															optionalConditions.some((c: Condition) => c.passes)}
														{@const typePass = requiredPass && optionalPass}
														<td
															rowspan={conditions.length}
															class="border-l border-border px-3 py-2 text-center align-middle"
														>
															{#if typePass}
																<div
																	class="inline-flex h-6 w-6 items-center justify-center rounded-pill bg-success-bg"
																>
																	<Check size={14} class="text-success-icon " />
																</div>
															{:else}
																<div
																	class="inline-flex h-6 w-6 items-center justify-center rounded-pill bg-danger-bg"
																>
																	<X size={14} class="text-danger-icon " />
																</div>
															{/if}
														</td>
													{/if}
													{#if typeIndex === 0 && condIndex === 0}
														<td
															rowspan={row.conditions.length}
															class="border-l border-border px-3 py-2 text-center align-middle"
														>
															{#if row.should_match}
																<div
																	class="inline-flex h-10 w-10 items-center justify-center rounded-pill bg-success-bg"
																>
																	<Check size={24} class="text-success-icon " />
																</div>
																<div class="mt-1 text-[10px] font-medium text-success-icon">
																	MATCH
																</div>
															{:else}
																<div
																	class="inline-flex h-10 w-10 items-center justify-center rounded-pill bg-danger-bg"
																>
																	<X size={24} class="text-danger-icon " />
																</div>
																<div class="mt-1 text-[10px] font-medium text-danger-icon">
																	NO MATCH
																</div>
															{/if}
														</td>
														<td
															rowspan={row.conditions.length}
															class="border-l border-border px-3 py-2 text-center align-middle"
														>
															{#if row.actual_match}
																<div
																	class="inline-flex h-10 w-10 items-center justify-center rounded-pill bg-success-bg"
																>
																	<Check size={24} class="text-success-icon " />
																</div>
																<div class="mt-1 text-[10px] font-medium text-success-icon">
																	MATCH
																</div>
															{:else}
																<div
																	class="inline-flex h-10 w-10 items-center justify-center rounded-pill bg-danger-bg"
																>
																	<X size={24} class="text-danger-icon " />
																</div>
																<div class="mt-1 text-[10px] font-medium text-danger-icon">
																	NO MATCH
																</div>
															{/if}
														</td>
														<td
															rowspan={row.conditions.length}
															class="border-l border-border px-3 py-2 text-center align-middle"
														>
															{#if row.result === 'pass'}
																<div
																	class="inline-flex h-10 w-10 items-center justify-center rounded-pill bg-success-bg"
																>
																	<Check size={24} class="text-success-icon " />
																</div>
																<div class="mt-1 text-[10px] font-medium text-success-icon">
																	PASS
																</div>
															{:else if row.result === 'fail'}
																<div
																	class="inline-flex h-10 w-10 items-center justify-center rounded-pill bg-danger-bg"
																>
																	<X size={24} class="text-danger-icon " />
																</div>
																<div class="mt-1 text-[10px] font-medium text-danger-icon">
																	FAIL
																</div>
															{:else}
																<div
																	class="inline-flex h-10 w-10 items-center justify-center rounded-pill bg-warning-bg"
																>
																	<span class="text-lg font-medium text-warning-icon">?</span>
																</div>
																<div class="mt-1 text-[10px] font-medium text-warning-icon">
																	UNKNOWN
																</div>
															{/if}
														</td>
													{/if}
												</tr>
											{/each}
										{/each}
									</tbody>
								</table>
							</div>

							<!-- Parsed Values (collapsed) -->
							{#if row.parsed}
								<details class="mt-4">
									<summary
										class="cursor-pointer text-xs font-semibold tracking-wider text-text-muted uppercase hover:text-text-soft"
									>
										Parsed Values
									</summary>
									<div class="mt-2 flex flex-wrap gap-2">
										<div class="flex items-center gap-1.5">
											<span class="text-xs text-text-muted">Source:</span>
											<Badge variant="neutral" size="md">{row.parsed.source}</Badge>
										</div>
										<div class="flex items-center gap-1.5">
											<span class="text-xs text-text-muted">Resolution:</span>
											<Badge variant="neutral" size="md">{row.parsed.resolution}</Badge>
										</div>
										<div class="flex items-center gap-1.5">
											<span class="text-xs text-text-muted">Modifier:</span>
											<Badge variant="neutral" size="md">{row.parsed.modifier}</Badge>
										</div>
										<div class="flex items-center gap-1.5">
											<span class="text-xs text-text-muted">Languages:</span>
											<Badge variant="neutral" size="md"
												>{row.parsed.languages.length > 0
													? row.parsed.languages.join(', ')
													: 'None'}</Badge
											>
										</div>
										{#if row.parsed.releaseGroup}
											<div class="flex items-center gap-1.5">
												<span class="text-xs text-text-muted">Release Group:</span>
												<Badge variant="neutral" size="md">{row.parsed.releaseGroup}</Badge>
											</div>
										{/if}
										{#if row.parsed.year}
											<div class="flex items-center gap-1.5">
												<span class="text-xs text-text-muted">Year:</span>
												<Badge variant="neutral" size="md">{row.parsed.year}</Badge>
											</div>
										{/if}
										{#if row.parsed.edition}
											<div class="flex items-center gap-1.5">
												<span class="text-xs text-text-muted">Edition:</span>
												<Badge variant="neutral" size="md">{row.parsed.edition}</Badge>
											</div>
										{/if}
										{#if row.parsed.releaseType}
											<div class="flex items-center gap-1.5">
												<span class="text-xs text-text-muted">Release Type:</span>
												<Badge variant="neutral" size="md">{row.parsed.releaseType}</Badge>
											</div>
										{/if}
									</div>
								</details>
							{/if}
						{:else if !row.parsed}
							<div class="text-sm text-text-muted">
								Parser unavailable - unable to evaluate conditions
							</div>
						{/if}
					</div>
				</svelte:fragment>

				<svelte:fragment slot="actions" let:row>
					<div class="flex items-center justify-end gap-1">
						<Button
							icon={Pencil}
							title="Edit test case"
							ariaLabel="Edit test case"
							variant="secondary"
							iconColor="text-accent-solid"
							size="xs"
							on:click={() => {
								if (readOnly) {
									notifyReadOnly();
									return;
								}
								goto(
									`/custom-formats/${$page.params.databaseId}/${$page.params.id}/testing/edit?title=${encodeURIComponent(row.title)}&type=${encodeURIComponent(row.type)}`
								);
							}}
						/>
						<form method="POST" action="?/delete" use:enhance>
							<input type="hidden" name="testTitle" value={row.title} />
							<input type="hidden" name="testType" value={row.type} />
							<input type="hidden" name="formatName" value={data.format.name} />
							<input type="hidden" name="layer" value={data.canWriteToBase ? 'base' : 'user'} />
							<Button
								icon={Trash2}
								title="Delete test case"
								ariaLabel="Delete test case"
								variant="secondary"
								iconColor="text-danger-icon "
								size="xs"
								on:click={(e) => {
									if (readOnly) {
										notifyReadOnly();
										return;
									}
									const form = (e.currentTarget as HTMLElement | null)?.closest('form');
									if (form) handleDeleteClick(row, form);
								}}
							/>
						</form>
					</div>
				</svelte:fragment>
			</ExpandableTable>
		{/if}
	</div>
</div>

<!-- Delete Confirmation Modal -->
<Modal
	open={showDeleteModal}
	header="Delete Test Case"
	bodyMessage={testToDelete
		? `Are you sure you want to delete the test case "${testToDelete.title}"?`
		: ''}
	confirmText="Delete"
	cancelText="Cancel"
	confirmDanger={true}
	on:confirm={handleDeleteConfirm}
	on:cancel={handleDeleteCancel}
/>
