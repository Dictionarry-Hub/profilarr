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
				<h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Test Cases</h2>
				<p class="text-sm text-neutral-600 dark:text-neutral-400">
					Test release titles against this custom format
				</p>
			</div>
		</svelte:fragment>
		<svelte:fragment slot="right">
			<Button
				text="Add Test"
				icon={Plus}
				iconColor="text-blue-600 dark:text-blue-400"
				variant="secondary"
				on:click={handleAddTest}
			/>
		</svelte:fragment>
	</StickyCard>

	<div class="mt-6 space-y-6 pb-12 md:px-4">
		<!-- Parser Warning -->
		{#if !data.parserAvailable}
			<div
				class="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20"
			>
				<AlertTriangle size={20} class="text-amber-600 dark:text-amber-400" />
				<div>
					<p class="text-sm font-medium text-amber-800 dark:text-amber-200">
						Parser service unavailable
					</p>
					<p class="text-xs text-amber-600 dark:text-amber-400">
						Test results cannot be evaluated. Start the parser microservice to see pass/fail status.
					</p>
				</div>
			</div>
		{/if}

		<!-- Tests List -->
		{#if data.tests.length === 0}
			<div
				class="rounded-lg border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900"
			>
				<p class="text-neutral-600 dark:text-neutral-400">
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
							<p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{row.description}</p>
						{/if}
					{:else if column.key === 'should_match'}
						{#if row.should_match}
							<span
								class="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
								>Should Match</span
							>
						{:else}
							<span
								class="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-200"
								>Shouldn't Match</span
							>
						{/if}
					{:else if column.key === 'type'}
						<span
							class="inline-flex items-center gap-1 rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
							>{row.type}</span
						>
					{:else if column.key === 'result'}
						{#if row.result === 'pass'}
							<div class="flex items-center justify-center">
								<div
									class="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900"
								>
									<Check size={14} class="text-emerald-600 dark:text-emerald-400" />
								</div>
							</div>
						{:else if row.result === 'fail'}
							<div class="flex items-center justify-center">
								<div
									class="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 dark:bg-red-900"
								>
									<X size={14} class="text-red-600 dark:text-red-400" />
								</div>
							</div>
						{:else}
							<div class="flex items-center justify-center">
								<div
									class="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900"
								>
									<span class="text-sm font-medium text-amber-600 dark:text-amber-400">?</span>
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
							<div
								class="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800"
							>
								<!-- lint-disable-next-line no-raw-ui -- rowspan grouping not supported by Table component -->
								<table class="w-full text-sm">
									<thead
										class="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-800"
									>
										<tr>
											<th
												class="px-3 py-2 text-left text-xs font-medium tracking-wider text-neutral-700 uppercase dark:text-neutral-300"
												>Type</th
											>
											<th
												class="px-3 py-2 text-left text-xs font-medium tracking-wider text-neutral-700 uppercase dark:text-neutral-300"
												>Condition</th
											>
											<th
												class="px-3 py-2 text-left text-xs font-medium tracking-wider text-neutral-700 uppercase dark:text-neutral-300"
												>Expected</th
											>
											<th
												class="px-3 py-2 text-left text-xs font-medium tracking-wider text-neutral-700 uppercase dark:text-neutral-300"
												>Actual</th
											>
											<th
												class="px-3 py-2 text-center text-xs font-medium tracking-wider text-neutral-700 uppercase dark:text-neutral-300"
												>Pass</th
											>
											<th
												class="px-3 py-2 text-center text-xs font-medium tracking-wider text-neutral-700 uppercase dark:text-neutral-300"
												>Type Pass</th
											>
											<th
												class="px-3 py-2 text-center text-xs font-medium tracking-wider text-neutral-700 uppercase dark:text-neutral-300"
												>Expected</th
											>
											<th
												class="px-3 py-2 text-center text-xs font-medium tracking-wider text-neutral-700 uppercase dark:text-neutral-300"
												>Actual</th
											>
											<th
												class="px-3 py-2 text-center text-xs font-medium tracking-wider text-neutral-700 uppercase dark:text-neutral-300"
												>Result</th
											>
										</tr>
									</thead>
									<tbody
										class="divide-y divide-neutral-200 bg-white dark:divide-neutral-800 dark:bg-neutral-900"
									>
										{#each conditionTypes as conditionType, typeIndex}
											{@const conditions = groupedConditions[conditionType]}
											{#each conditions as condition, condIndex}
												<tr>
													{#if condIndex === 0}
														<td
															rowspan={conditions.length}
															class="border-r border-neutral-200 px-3 py-2 align-top font-medium text-neutral-900 dark:border-neutral-800 dark:text-neutral-100"
														>
															{conditionTypeLabels[conditionType] || conditionType}
														</td>
													{/if}
													<td class="px-3 py-2 text-neutral-700 dark:text-neutral-300">
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
														class="max-w-48 truncate px-3 py-2 font-mono text-xs text-neutral-600 dark:text-neutral-400"
														title={condition.expected}
													>
														{condition.expected}
													</td>
													<td
														class="max-w-48 truncate px-3 py-2 font-mono text-xs text-neutral-600 dark:text-neutral-400"
														title={condition.actual}
													>
														{condition.actual}
													</td>
													<td class="px-3 py-2 text-center">
														{#if condition.passes}
															<div
																class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900"
															>
																<Check size={12} class="text-emerald-600 dark:text-emerald-400" />
															</div>
														{:else}
															<div
																class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-100 dark:bg-red-900"
															>
																<X size={12} class="text-red-600 dark:text-red-400" />
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
															class="border-l border-neutral-200 px-3 py-2 text-center align-middle dark:border-neutral-800"
														>
															{#if typePass}
																<div
																	class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900"
																>
																	<Check size={14} class="text-emerald-600 dark:text-emerald-400" />
																</div>
															{:else}
																<div
																	class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-100 dark:bg-red-900"
																>
																	<X size={14} class="text-red-600 dark:text-red-400" />
																</div>
															{/if}
														</td>
													{/if}
													{#if typeIndex === 0 && condIndex === 0}
														<td
															rowspan={row.conditions.length}
															class="border-l border-neutral-200 px-3 py-2 text-center align-middle dark:border-neutral-800"
														>
															{#if row.should_match}
																<div
																	class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900"
																>
																	<Check size={24} class="text-emerald-600 dark:text-emerald-400" />
																</div>
																<div
																	class="mt-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400"
																>
																	MATCH
																</div>
															{:else}
																<div
																	class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900"
																>
																	<X size={24} class="text-red-600 dark:text-red-400" />
																</div>
																<div
																	class="mt-1 text-[10px] font-medium text-red-600 dark:text-red-400"
																>
																	NO MATCH
																</div>
															{/if}
														</td>
														<td
															rowspan={row.conditions.length}
															class="border-l border-neutral-200 px-3 py-2 text-center align-middle dark:border-neutral-800"
														>
															{#if row.actual_match}
																<div
																	class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900"
																>
																	<Check size={24} class="text-emerald-600 dark:text-emerald-400" />
																</div>
																<div
																	class="mt-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400"
																>
																	MATCH
																</div>
															{:else}
																<div
																	class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900"
																>
																	<X size={24} class="text-red-600 dark:text-red-400" />
																</div>
																<div
																	class="mt-1 text-[10px] font-medium text-red-600 dark:text-red-400"
																>
																	NO MATCH
																</div>
															{/if}
														</td>
														<td
															rowspan={row.conditions.length}
															class="border-l border-neutral-200 px-3 py-2 text-center align-middle dark:border-neutral-800"
														>
															{#if row.result === 'pass'}
																<div
																	class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900"
																>
																	<Check size={24} class="text-emerald-600 dark:text-emerald-400" />
																</div>
																<div
																	class="mt-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400"
																>
																	PASS
																</div>
															{:else if row.result === 'fail'}
																<div
																	class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900"
																>
																	<X size={24} class="text-red-600 dark:text-red-400" />
																</div>
																<div
																	class="mt-1 text-[10px] font-medium text-red-600 dark:text-red-400"
																>
																	FAIL
																</div>
															{:else}
																<div
																	class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900"
																>
																	<span
																		class="text-lg font-medium text-amber-600 dark:text-amber-400"
																		>?</span
																	>
																</div>
																<div
																	class="mt-1 text-[10px] font-medium text-amber-600 dark:text-amber-400"
																>
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
										class="cursor-pointer text-xs font-semibold tracking-wider text-neutral-500 uppercase hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
									>
										Parsed Values
									</summary>
									<div class="mt-2 flex flex-wrap gap-2">
										<div class="flex items-center gap-1.5">
											<span class="text-xs text-neutral-500 dark:text-neutral-400">Source:</span>
											<Badge variant="neutral" size="md">{row.parsed.source}</Badge>
										</div>
										<div class="flex items-center gap-1.5">
											<span class="text-xs text-neutral-500 dark:text-neutral-400">Resolution:</span
											>
											<Badge variant="neutral" size="md">{row.parsed.resolution}</Badge>
										</div>
										<div class="flex items-center gap-1.5">
											<span class="text-xs text-neutral-500 dark:text-neutral-400">Modifier:</span>
											<Badge variant="neutral" size="md">{row.parsed.modifier}</Badge>
										</div>
										<div class="flex items-center gap-1.5">
											<span class="text-xs text-neutral-500 dark:text-neutral-400">Languages:</span>
											<Badge variant="neutral" size="md"
												>{row.parsed.languages.length > 0
													? row.parsed.languages.join(', ')
													: 'None'}</Badge
											>
										</div>
										{#if row.parsed.releaseGroup}
											<div class="flex items-center gap-1.5">
												<span class="text-xs text-neutral-500 dark:text-neutral-400"
													>Release Group:</span
												>
												<Badge variant="neutral" size="md">{row.parsed.releaseGroup}</Badge>
											</div>
										{/if}
										{#if row.parsed.year}
											<div class="flex items-center gap-1.5">
												<span class="text-xs text-neutral-500 dark:text-neutral-400">Year:</span>
												<Badge variant="neutral" size="md">{row.parsed.year}</Badge>
											</div>
										{/if}
										{#if row.parsed.edition}
											<div class="flex items-center gap-1.5">
												<span class="text-xs text-neutral-500 dark:text-neutral-400">Edition:</span>
												<Badge variant="neutral" size="md">{row.parsed.edition}</Badge>
											</div>
										{/if}
										{#if row.parsed.releaseType}
											<div class="flex items-center gap-1.5">
												<span class="text-xs text-neutral-500 dark:text-neutral-400"
													>Release Type:</span
												>
												<Badge variant="neutral" size="md">{row.parsed.releaseType}</Badge>
											</div>
										{/if}
									</div>
								</details>
							{/if}
						{:else if !row.parsed}
							<div class="text-sm text-neutral-500 dark:text-neutral-400">
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
							iconColor="text-accent-600 dark:text-accent-400"
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
								iconColor="text-red-600 dark:text-red-400"
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
