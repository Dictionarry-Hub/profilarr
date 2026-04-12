<script lang="ts">
	import ExpandableTable from '$ui/table/ExpandableTable.svelte';
	import QualityProfileDiff from './components/QualityProfileDiff.svelte';
	import SectionRenderer from './components/SectionRenderer.svelte';
	import ActionsBar from '$ui/actions/ActionsBar.svelte';
	import ActionButton from '$ui/actions/ActionButton.svelte';
	import ActionInput from '$ui/actions/ActionInput.svelte';
	import Modal from '$ui/modal/Modal.svelte';
	import CodeBlock from '$ui/code/CodeBlock.svelte';
	import InlineCode from '$ui/code/InlineCode.svelte';
	import Label from '$ui/label/Label.svelte';
	import {
		Check,
		Send,
		Download,
		ExternalLink,
		FileText,
		Loader2,
		Upload,
		Trash2,
		FileCode,
		Layers,
		Files,
		Clock,
		User,
		CheckCircle,
		XCircle,
		GitBranch,
		Globe,
		FileCheck,
		UserCheck,
		GitCommit,
		X
	} from 'lucide-svelte';
	import goOnGit from '$assets/goOnGit.gif';
	import Button from '$ui/button/Button.svelte';
	import IconCheckbox from '$ui/form/IconCheckbox.svelte';
	import { afterNavigate } from '$app/navigation';
	import { deserialize } from '$app/forms';
	import { alertStore } from '$alerts/store';
	import type { PageData } from './$types';
	import type { GitStatus, IncomingChanges, Commit } from '$utils/git/types';
	import type { Column } from '$ui/table/types';
	import type { DraftEntityChange } from './components/types';
	import { parseUTC } from '$shared/utils/dates';

	export let data: PageData;

	type ExportPreflightChecks = {
		repoExists: boolean;
		manifestValid: boolean;
		remoteReachable: boolean;
		clean: boolean;
		upToDate: boolean;
		ahead: number;
		behind: number;
		identitySet: boolean;
		canWriteToBase: boolean;
		branch: string | null;
	};

	type ExportPreview = {
		ok: boolean;
		errors: string[];
		checks: ExportPreflightChecks;
		status?: GitStatus;
		filename?: string;
		filepath?: string;
		content?: string;
		contentHash?: string;
		opIds?: number[];
		opCount?: number;
		filePaths?: string[];
		exportedAt?: string;
		commitMessage?: string;
		gitIdentity?: { name: string; email: string };
	};

	let loading = true;
	let pulling = false;
	let status: GitStatus | null = null;
	let incomingChanges: IncomingChanges | null = null;
	let draftChanges: DraftEntityChange[] = [];
	let primarySelected = new Set<string>();
	let selected = new Set<string>();
	let commitMessage = '';
	let committing = false;
	let dropping = false;
	let showDropModal = false;
	let previewing = false;
	let showPreviewModal = false;
	let previewError: string | null = null;
	let previewData: ExportPreview | null = null;
	let previewSelectionKey: string | null = null;
	let selectionKey = '';
	let previewSelectionMismatch = false;
	let previewMessageMismatch = false;
	let previewConfirmDisabled = true;
	let previewOpCount = 0;

	$: isDeveloper = data.isDeveloper;
	$: hasIncomingChanges = incomingChanges?.hasUpdates ?? false;
	$: selectableChanges = draftChanges.filter((change) => !change.generated);
	$: selectableKeys = selectableChanges.map((change) => change.key);
	$: selectedPrimaryCount = selectableKeys.filter((key) => primarySelected.has(key)).length;
	$: selectedCount = Array.from(selected).length;
	$: allSelected = selectableKeys.length > 0 && selectedPrimaryCount === selectableKeys.length;
	$: primaryKeys = Array.from(primarySelected);
	$: selectedKeys = Array.from(selected);
	$: selectedChanges = draftChanges.filter((change) => selected.has(change.key));
	$: selectionKey = buildSelectionKey(collectOpIds()) + '|' + collectFilePaths().sort().join(',');
	$: previewSelectionMismatch =
		!!previewData?.ok && !!previewSelectionKey && selectionKey !== previewSelectionKey;
	$: previewMessageMismatch =
		!!previewData?.ok &&
		!!previewData?.commitMessage &&
		commitMessage.trim() !== previewData.commitMessage;
	$: previewConfirmDisabled =
		previewing ||
		committing ||
		!previewData?.ok ||
		previewSelectionMismatch ||
		previewMessageMismatch;
	$: previewOpCount = previewData?.opCount ?? previewData?.opIds?.length ?? 0;
	$: selectedOpCount = collectOpIds().length;

	$: allQuiet = !loading && draftChanges.length === 0 && !hasIncomingChanges;

	$: changeByKey = new Map(draftChanges.map((change) => [change.key, change]));
	$: groupMap = buildGroupMap(draftChanges);
	$: dependencyMap = buildDependencyMap(draftChanges);
	$: selected = expandSelection(primarySelected);
	$: autoSelectedKeys = buildAutoSelectedKeys(selected, primarySelected);

	async function fetchChanges() {
		loading = true;
		try {
			const response = await fetch(`/databases/${data.database.id}/changes/data`);
			if (response.ok) {
				const result = await response.json();
				status = result.status;
				incomingChanges = result.incomingChanges;
				draftChanges = result.draftChanges || [];
			}
		} finally {
			loading = false;
		}
	}

	afterNavigate(() => {
		fetchChanges();
	});

	async function parseActionResult(response: Response): Promise<any> {
		const text = await response.text();
		if (!text) return null;
		try {
			return deserialize(text);
		} catch {
			try {
				return JSON.parse(text);
			} catch {
				return null;
			}
		}
	}

	function toggleAll() {
		if (allSelected) {
			primarySelected = new Set();
		} else {
			primarySelected = new Set(selectableKeys);
		}
	}

	function toggleRow(key: string) {
		const change = changeByKey.get(key);
		if (!change || change.generated) return;

		const groupKeys = getSelectableGroupKeys(change, groupMap);
		const newSelected = new Set(primarySelected);
		const isSelected = groupKeys.some((groupKey) => newSelected.has(groupKey));
		for (const groupKey of groupKeys) {
			if (isSelected) {
				newSelected.delete(groupKey);
			} else {
				newSelected.add(groupKey);
			}
		}

		if (!isSelected) {
			const expanded = expandSelection(newSelected);
			const primaryAdded = new Set(groupKeys);
			const autoAdded = Array.from(expanded).filter(
				(expandedKey) => !selected.has(expandedKey) && !primaryAdded.has(expandedKey)
			);
			const autoAddedDetails = autoAdded
				.map((depKey) => changeByKey.get(depKey))
				.filter((dep): dep is DraftEntityChange => Boolean(dep) && !dep!.generated);

			if (autoAddedDetails.length > 0) {
				const label = autoAddedDetails
					.map((dep) => `${formatEntity(dep.entity)} "${dep.name}"`)
					.join(', ');
				const noun = autoAddedDetails.length === 1 ? 'dependency' : 'dependencies';
				alertStore.add('info', `Auto-selected ${autoAddedDetails.length} ${noun}: ${label}`);
			}
		}

		primarySelected = newSelected;
	}

	function collectOpIds(): number[] {
		const opIds = new Set<number>();
		for (const change of selectedChanges) {
			for (const op of change.ops) {
				opIds.add(op.id);
			}
		}
		return Array.from(opIds).sort((a, b) => a - b);
	}

	function collectFilePaths(): string[] {
		return selectedChanges
			.filter((change) => change.entity === 'file')
			.map((change) => change.name);
	}

	function buildSelectionKey(opIds: number[]): string {
		return [...opIds].sort((a, b) => a - b).join(',');
	}

	function buildGroupMap(changes: DraftEntityChange[]): Map<string, string[]> {
		const map = new Map<string, string[]>();
		for (const change of changes) {
			if (!change.groupId) continue;
			const list = map.get(change.groupId) ?? [];
			list.push(change.key);
			map.set(change.groupId, list);
		}
		return map;
	}

	function getGroupKeys(change: DraftEntityChange, map: Map<string, string[]>): string[] {
		if (!change.groupId) return [change.key];
		return map.get(change.groupId) ?? [change.key];
	}

	function getSelectableGroupKeys(change: DraftEntityChange, map: Map<string, string[]>): string[] {
		const keys = getGroupKeys(change, map);
		return keys.filter((key) => {
			const entry = changeByKey.get(key);
			return entry && !entry.generated;
		});
	}

	function buildDependencyMap(changes: DraftEntityChange[]): Map<string, string[]> {
		const map = new Map<string, string[]>();
		for (const change of changes) {
			if (!change.requires || change.requires.length === 0) continue;
			map.set(
				change.key,
				change.requires.map((requirement) => requirement.key)
			);
		}
		return map;
	}

	function expandSelection(keys: Set<string>): Set<string> {
		const expanded = new Set<string>();
		const queue = Array.from(keys);

		while (queue.length > 0) {
			const key = queue.pop();
			if (!key || expanded.has(key)) continue;
			expanded.add(key);

			const change = changeByKey.get(key);
			if (!change) continue;

			for (const groupKey of getGroupKeys(change, groupMap)) {
				if (!expanded.has(groupKey)) {
					queue.push(groupKey);
				}
			}

			const deps = dependencyMap.get(key) ?? [];
			for (const depKey of deps) {
				if (!expanded.has(depKey)) {
					queue.push(depKey);
				}
			}
		}

		return expanded;
	}

	function buildAutoSelectedKeys(
		currentSelected: Set<string>,
		primaryKeys: Set<string>
	): Set<string> {
		const autoSelected = new Set<string>();
		for (const key of currentSelected) {
			if (!primaryKeys.has(key)) {
				autoSelected.add(key);
			}
		}
		return autoSelected;
	}

	function buildDropKeys(): Set<string> {
		const keysToDrop = new Set<string>();
		for (const key of primaryKeys) {
			const change = changeByKey.get(key);
			if (!change) continue;
			if (change.groupId && groupMap.has(change.groupId)) {
				for (const groupKey of groupMap.get(change.groupId) ?? []) {
					keysToDrop.add(groupKey);
				}
			} else {
				keysToDrop.add(change.key);
			}
		}
		return keysToDrop;
	}

	async function handlePreview() {
		if (hasIncomingChanges) {
			alertStore.add('warning', 'Pull incoming changes before exporting.');
			return;
		}
		if (selectedChanges.length === 0) {
			alertStore.add('warning', 'Select at least one change to export.');
			return;
		}
		if (!commitMessage.trim()) {
			alertStore.add('warning', 'Commit message required before exporting.');
			return;
		}

		previewing = true;
		previewError = null;
		previewData = null;
		previewSelectionKey = null;
		showPreviewModal = true;
		try {
			const opIds = collectOpIds();
			const filePaths = collectFilePaths();

			const formData = new FormData();
			for (const opId of opIds) {
				formData.append('opIds', String(opId));
			}
			for (const fp of filePaths) {
				formData.append('filePaths', fp);
			}
			formData.append('message', commitMessage.trim());

			const response = await fetch('?/preview', {
				method: 'POST',
				body: formData,
				headers: { Accept: 'application/json' }
			});

			const result = await parseActionResult(response);

			const isSuccess =
				response.ok &&
				(result?.type === 'success' ||
					result?.type === 'redirect' ||
					result?.data?.success ||
					result?.success);
			const errorMessage = result?.data?.error || result?.error;
			const preview = result?.data?.preview ?? result?.preview;

			if (isSuccess && preview) {
				previewData = preview;
				previewSelectionKey = preview.ok ? selectionKey : null;
			} else if (isSuccess) {
				const detail = 'Preview response missing data.';
				previewError = detail;
				alertStore.add('error', detail);
			} else {
				const detail = errorMessage || `HTTP ${response.status}`;
				previewError = detail;
				alertStore.add('error', `Preview failed: ${detail}`);
			}
		} catch (err) {
			const detail = err instanceof Error ? err.message : 'Preview request failed.';
			previewError = detail;
			alertStore.add('error', detail);
		} finally {
			previewing = false;
		}
	}

	async function handleExportConfirm() {
		if (!previewData?.ok) return;
		if (previewSelectionMismatch || previewMessageMismatch) {
			alertStore.add('warning', 'Preview is out of date. Preview again before exporting.');
			return;
		}

		committing = true;
		try {
			const opIds = collectOpIds();
			const filePaths = collectFilePaths();

			const formData = new FormData();
			for (const opId of opIds) {
				formData.append('opIds', String(opId));
			}
			for (const fp of filePaths) {
				formData.append('filePaths', fp);
			}
			formData.append('message', commitMessage.trim());
			if (previewData?.exportedAt) {
				formData.append('exportedAt', previewData.exportedAt);
			}

			const response = await fetch('?/commit', {
				method: 'POST',
				body: formData,
				headers: { Accept: 'application/json' }
			});

			const result = await parseActionResult(response);

			const isSuccess =
				response.ok &&
				(result?.type === 'success' || result?.type === 'redirect' || result?.data?.success);
			const errorMessage = result?.data?.error || result?.error;

			if (isSuccess) {
				const droppedCount = result?.data?.dropped ?? opIds.length;
				const fileCount = result?.data?.fileCount ?? filePaths.length;
				const filename = result?.data?.filename;
				const parts: string[] = [];
				if (droppedCount > 0) {
					const noun = droppedCount === 1 ? 'op' : 'ops';
					parts.push(`${droppedCount} ${noun}`);
				}
				if (fileCount > 0) {
					const noun = fileCount === 1 ? 'file' : 'files';
					parts.push(`${fileCount} ${noun}`);
				}
				const summary = parts.length > 0 ? parts.join(' + ') : 'changes';
				const label = filename ? ` (${filename})` : '';
				alertStore.add('success', `Exported and pushed ${summary}${label}`);
				await fetchChanges();
				commitMessage = '';
				primarySelected = new Set();
				showPreviewModal = false;
				previewData = null;
				previewSelectionKey = null;
			} else {
				const detail = errorMessage || `HTTP ${response.status}`;
				alertStore.add('error', `Export failed: ${detail}`);
			}
		} finally {
			committing = false;
		}
	}

	function handlePreviewCancel() {
		showPreviewModal = false;
		previewError = null;
		previewData = null;
		previewSelectionKey = null;
	}

	function requestDrop() {
		if (!primaryKeys.length) {
			alertStore.add('warning', 'Select at least one change to drop.');
			return;
		}
		showDropModal = true;
	}

	async function handleDropConfirm() {
		if (!primaryKeys.length) return;
		dropping = true;
		try {
			const dropKeys = buildDropKeys();
			const opIds = new Set<number>();
			for (const key of dropKeys) {
				const change = changeByKey.get(key);
				if (!change) continue;
				for (const op of change.ops) {
					opIds.add(op.id);
				}
			}

			const formData = new FormData();
			for (const opId of opIds) {
				formData.append('opIds', String(opId));
			}

			const response = await fetch('?/drop', {
				method: 'POST',
				body: formData,
				headers: { Accept: 'application/json' }
			});

			const result = await parseActionResult(response);

			const isSuccess =
				response.ok &&
				(result?.type === 'success' || result?.type === 'redirect' || result?.data?.success);
			const droppedCount =
				typeof result?.data?.dropped === 'number'
					? result.data.dropped
					: typeof result?.dropped === 'number'
						? result.dropped
						: opIds.size;
			const errorMessage = result?.data?.error || result?.error;

			if (isSuccess) {
				alertStore.add('success', `Dropped ${droppedCount} ops`);
				await fetchChanges();
			} else {
				const detail = errorMessage || `HTTP ${response.status}`;
				alertStore.add('error', `Drop failed: ${detail}`);
			}
		} finally {
			dropping = false;
			showDropModal = false;
		}
	}

	function handleDropCancel() {
		showDropModal = false;
	}

	async function handlePull() {
		pulling = true;
		try {
			const response = await fetch('?/pull', {
				method: 'POST',
				body: new FormData(),
				headers: { Accept: 'application/json' }
			});

			const result = await parseActionResult(response);
			const isSuccess =
				result.type === 'success' || result.type === 'redirect' || result.data?.success;
			const errorMsg = result.data?.error || result.error;

			if (isSuccess && !errorMsg) {
				const commits = result.data?.commitsBehind || incomingChanges?.commitsBehind || 0;
				alertStore.add('success', `Pulled ${commits} commit${commits === 1 ? '' : 's'}`);
			} else {
				alertStore.add('error', `Pull failed: ${errorMsg || 'Unknown error'}`);
			}

			await fetchChanges();
		} finally {
			pulling = false;
		}
	}

	function formatTitle(value: string): string {
		const trimmed = value.replace(/[_-]+/g, ' ').trim();
		return trimmed.replace(/\b\w/g, (char) => char.toUpperCase());
	}

	function formatOperation(op: string | null): string {
		if (!op) return '-';
		return formatTitle(op);
	}

	function getOperationClass(op: string | null): string {
		switch (op) {
			case 'create':
				return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
			case 'update':
				return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
			case 'delete':
				return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
			default:
				return 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200';
		}
	}

	function formatEntity(entity: string | null): string {
		if (!entity) return '-';
		return formatTitle(entity);
	}

	function parseDate(dateStr: string): Date | null {
		const parsed = parseUTC(dateStr) ?? new Date(dateStr);
		if (Number.isNaN(parsed.getTime())) return null;
		return parsed;
	}

	function getDateSortValue(dateStr: string): number {
		const parsed = parseDate(dateStr);
		return parsed ? parsed.getTime() : Number.NEGATIVE_INFINITY;
	}

	function formatDate(dateStr: string): string {
		const date = parseDate(dateStr);
		if (!date) return '-';
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffMs < 0) return date.toLocaleDateString();
		if (diffDays === 0) {
			const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
			if (diffHours === 0) {
				const diffMins = Math.floor(diffMs / (1000 * 60));
				return `${diffMins}m ago`;
			}
			return `${diffHours}h ago`;
		}
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 7) return `${diffDays}d ago`;

		return date.toLocaleDateString();
	}

	function formatExportedAt(value: string | null | undefined): string {
		if (!value) return '-';
		const parsed = parseUTC(value);
		const date = parsed ?? new Date(value);
		if (Number.isNaN(date.getTime())) return value;
		return date.toLocaleString(undefined, {
			year: 'numeric',
			month: 'short',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function getCommitUrl(hash: string): string {
		return `${data.database.repository_url}/commit/${hash}`;
	}

	const incomingColumns: Column<Commit>[] = [
		{ key: 'shortHash', header: 'Commit', width: 'w-24' },
		{ key: 'message', header: 'Message' },
		{ key: 'author', header: 'Author', width: 'w-40' },
		{
			key: 'date',
			header: 'Date',
			width: 'w-28',
			align: 'right',
			sortable: true,
			sortAccessor: (row) => getDateSortValue(row.date)
		}
	];

	const outgoingColumns: Column<DraftEntityChange>[] = [
		{ key: 'select', header: '', width: 'w-12', align: 'center', hideOnMobile: true },
		{ key: 'operation', header: 'Operation', width: 'w-28' },
		{ key: 'entity', header: 'Entity', width: 'w-36' },
		{ key: 'name', header: 'Name' },
		{ key: 'summary', header: 'Summary' },
		{ key: 'updatedAt', header: 'Updated', width: 'w-28', align: 'right' }
	];
</script>

<svelte:head>
	<title>Changes - {data.database.name} - Profilarr</title>
</svelte:head>

{#if allQuiet}
	<div class="mt-6 flex h-[calc(100vh-12rem)] flex-col items-center justify-center text-center">
		<img src={goOnGit} alt="Go on, git!" class="mb-4 w-64 rounded-lg" />
		<p class="text-sm text-neutral-400 dark:text-neutral-500">
			No changes to pull or publish right now.
		</p>
	</div>
{:else}
	<div class="mt-6 space-y-6">
		<!-- Outgoing Changes Section (Developers Only) -->
		{#if isDeveloper}
			<section>
				<div class="mb-3 flex items-center gap-2">
					<h2
						class="flex items-center gap-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100"
					>
						<Send size={20} />
						Outgoing Changes
					</h2>
					{#if draftChanges.length > 0}
						<Label variant="info" size="sm">{draftChanges.length}</Label>
					{/if}
				</div>

				<!-- Actions Bar -->
				{#if loading}
					<div
						class="mb-4 animate-pulse rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800"
					>
						<div class="flex items-center gap-4">
							<div class="h-9 w-48 rounded-md bg-neutral-200 dark:bg-neutral-700"></div>
							<div class="h-9 w-24 rounded-md bg-neutral-200 dark:bg-neutral-700"></div>
							<div class="h-9 w-24 rounded-md bg-neutral-200 dark:bg-neutral-700"></div>
						</div>
					</div>
				{:else if draftChanges.length > 0}
					<div class="mb-4">
						<ActionsBar className="w-full">
							<div>
								<ActionButton square={false} on:click={toggleAll}>
									<div
										class="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300"
									>
										<IconCheckbox checked={allSelected} icon={Check} color="blue" shape="circle" />
										Select all ({selectableKeys.length})
									</div>
								</ActionButton>
							</div>

							<div class="flex-1">
								<ActionInput
									bind:value={commitMessage}
									placeholder={hasIncomingChanges
										? 'Pull incoming changes first...'
										: 'Commit message...'}
									disabled={hasIncomingChanges}
									mono
								/>
							</div>

							<div>
								<ActionButton
									icon={previewing ? Loader2 : Upload}
									iconClass={previewing ? 'animate-spin' : ''}
									title={previewing ? 'Preparing preview' : 'Preview export'}
									disabled={hasIncomingChanges || previewing || committing}
									on:click={handlePreview}
								/>
							</div>

							<div class="flex">
								<ActionButton
									icon={Trash2}
									variant="danger"
									title="Drop selected changes"
									disabled={dropping}
									on:click={requestDrop}
								/>
							</div>
						</ActionsBar>
					</div>
				{/if}

				<!-- Outgoing Table -->
				<ExpandableTable
					{loading}
					columns={outgoingColumns}
					data={draftChanges}
					getRowId={(row) => row.key}
					emptyMessage="Nothing to ship - go break something, then come back."
					responsive
					chevronPosition="right"
					expandOnRowClick={false}
					flushExpanded={true}
					onRowClick={(row) => toggleRow(row.key)}
					primaryColumnKey="name"
					disableExpandWhen={(row) => row.operation === 'delete'}
				>
					<svelte:fragment slot="cell" let:row let:column>
						{#if column.key === 'select'}
							{#if row.generated}
								<span class="inline-block h-5 w-5"></span>
							{:else}
								<IconCheckbox
									checked={selected.has(row.key)}
									icon={Check}
									color={autoSelectedKeys.has(row.key) ? '#f59e0b' : 'blue'}
									variant={autoSelectedKeys.has(row.key) ? 'filled' : 'filled'}
									shape="circle"
									stopPropagation
									on:click={() => toggleRow(row.key)}
									title={autoSelectedKeys.has(row.key)
										? 'Auto-selected (required by other changes)'
										: 'Selected'}
								/>
							{/if}
						{:else if column.key === 'operation'}
							<span
								class="inline-flex rounded px-2 py-0.5 font-mono text-xs {getOperationClass(
									row.operation
								)}"
							>
								{formatOperation(row.operation)}
							</span>
						{:else if column.key === 'entity'}
							<span class="text-sm text-neutral-700 dark:text-neutral-300">
								{formatEntity(row.entity)}
							</span>
						{:else if column.key === 'summary'}
							<span class="text-sm text-neutral-600 dark:text-neutral-400">
								{row.summary}
							</span>
						{:else if column.key === 'name'}
							<div class="flex flex-col gap-1">
								<span class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
									{row.name}
								</span>
								{#if row.requires && row.requires.length > 0}
									<span class="text-xs text-neutral-500 dark:text-neutral-400">
										Requires:{' '}
										{row.requires
											.map(
												(requirement) => `${formatEntity(requirement.entity)} "${requirement.name}"`
											)
											.join(', ')}
									</span>
								{/if}
							</div>
						{:else if column.key === 'updatedAt'}
							<span class="font-mono text-xs text-neutral-500 dark:text-neutral-400">
								{formatDate(row.updatedAt)}
							</span>
						{/if}
					</svelte:fragment>

					<svelte:fragment slot="expanded" let:row>
						<div class="px-4 py-3 md:px-6 md:py-4">
							{#if row.entity === 'quality_profile'}
								<QualityProfileDiff sections={row.sections} operation={row.operation} />
							{:else}
								<SectionRenderer sections={row.sections} operation={row.operation} />
							{/if}
						</div>
					</svelte:fragment>
				</ExpandableTable>
			</section>
		{/if}

		<!-- Incoming Changes Section -->
		<section>
			<div class="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div class="flex items-center gap-2">
					<h2
						class="flex items-center gap-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100"
					>
						<Download size={20} />
						Incoming Changes
					</h2>
					{#if incomingChanges?.hasUpdates && incomingChanges.commitsBehind > 0}
						<Label variant="warning" size="sm">{incomingChanges.commitsBehind}</Label>
					{/if}
				</div>
				{#if incomingChanges?.hasUpdates}
					<div class="w-full sm:w-auto">
						<Button
							text={pulling
								? 'Pulling...'
								: `Pull ${incomingChanges.commitsBehind} commit${incomingChanges.commitsBehind === 1 ? '' : 's'}`}
							variant="primary"
							loading={pulling}
							disabled={pulling}
							fullWidth
							on:click={handlePull}
						/>
					</div>
				{/if}
			</div>

			{#if loading}
				<div class="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
					<div class="animate-pulse p-8">
						<div class="h-4 w-48 rounded bg-neutral-200 dark:bg-neutral-700"></div>
					</div>
				</div>
			{:else if !incomingChanges?.hasUpdates}
				<div
					class="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900"
				>
					<p class="text-sm text-neutral-500 dark:text-neutral-400">
						{#if data.database.auto_pull}
							All caught up. Auto-pull will grab updates for you.
						{:else}
							All caught up. Nothing new from the remote.
						{/if}
					</p>
				</div>
			{:else}
				<ExpandableTable
					columns={incomingColumns}
					data={incomingChanges.commits}
					getRowId={(row) => row.hash}
					emptyMessage="No incoming changes"
					responsive
				>
					<svelte:fragment slot="cell" let:row let:column>
						{#if column.key === 'shortHash'}
							<a
								href={getCommitUrl(row.hash)}
								target="_blank"
								rel="noopener noreferrer"
								on:click|stopPropagation
								class="inline-flex items-center gap-1.5 font-mono text-xs text-accent-600 hover:underline dark:text-accent-400"
							>
								{row.shortHash}
								<ExternalLink size={12} />
							</a>
						{:else if column.key === 'message'}
							<span class="line-clamp-1 text-sm text-neutral-900 dark:text-neutral-100">
								{row.message}
							</span>
						{:else if column.key === 'author'}
							<span class="text-sm text-neutral-600 dark:text-neutral-400">
								{row.author}
							</span>
						{:else if column.key === 'date'}
							<span class="font-mono text-xs text-neutral-500 dark:text-neutral-400">
								{formatDate(row.date)}
							</span>
						{/if}
					</svelte:fragment>

					<svelte:fragment slot="expanded" let:row>
						<div class="space-y-2">
							<div class="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
								<FileText size={14} />
								<span>{row.files.length} file{row.files.length !== 1 ? 's' : ''} changed</span>
							</div>
							{#if row.files.length > 0}
								<div class="grid gap-1">
									{#each row.files as file}
										<code
											class="block rounded bg-neutral-100 px-2 py-1 font-mono text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
										>
											{file}
										</code>
									{/each}
								</div>
							{/if}
						</div>
					</svelte:fragment>
				</ExpandableTable>
			{/if}
		</section>
	</div>
{/if}

<Modal
	open={showDropModal}
	header="Drop changes"
	bodyMessage={`Drop ${primaryKeys.length} change${primaryKeys.length === 1 ? '' : 's'}? This cannot be undone.`}
	confirmText="Drop"
	cancelText="Cancel"
	confirmDanger={true}
	loading={dropping}
	on:confirm={handleDropConfirm}
	on:cancel={handleDropCancel}
/>

<Modal
	open={showPreviewModal}
	header="Export preview"
	confirmText="Approve & Export"
	cancelText="Close"
	confirmDisabled={previewConfirmDisabled}
	loading={committing}
	size="2xl"
	on:confirm={handleExportConfirm}
	on:cancel={handlePreviewCancel}
>
	<svelte:fragment slot="header-extra">
		{#if previewData}
			{#if !previewData.checks.clean}
				<Label variant="danger" size="sm" rounded="md"><XCircle size={11} /> Dirty</Label>
			{/if}
			{#if !previewData.checks.upToDate}
				<Label variant="warning" size="sm" rounded="md" mono>
					<GitBranch size={11} /> A{previewData.checks.ahead}/B{previewData.checks.behind}
				</Label>
			{/if}
			{#if !previewData.checks.remoteReachable}
				<Label variant="danger" size="sm" rounded="md"><XCircle size={11} /> Remote failed</Label>
			{/if}
			{#if !previewData.checks.manifestValid}
				<Label variant="danger" size="sm" rounded="md"><XCircle size={11} /> Manifest invalid</Label
				>
			{/if}
			{#if !previewData.checks.identitySet}
				<Label variant="danger" size="sm" rounded="md"><XCircle size={11} /> Identity missing</Label
				>
			{/if}
			{#if !previewData.checks.canWriteToBase}
				<Label variant="danger" size="sm" rounded="md"><XCircle size={11} /> Publish blocked</Label>
			{/if}
		{/if}
	</svelte:fragment>

	<svelte:fragment slot="body">
		{#if previewing}
			<div class="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
				<div
					class="h-4 w-4 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent"
				></div>
				Preparing preview...
			</div>
		{:else if previewError}
			<p class="text-sm text-red-600 dark:text-red-400">Preview failed: {previewError}</p>
		{:else if previewData}
			<div class="space-y-4">
				<!-- Commit message -->
				<InlineCode text={commitMessage.trim()} icon={GitCommit} rounded="md" />

				{#if previewData.errors.length > 0}
					<div
						class="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200"
					>
						{#each previewData.errors as error}
							<div>{error}</div>
						{/each}
					</div>
				{/if}

				{#if previewSelectionMismatch}
					<div
						class="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200"
					>
						Selection changed since preview. Preview again before exporting.
					</div>
				{/if}

				{#if previewMessageMismatch}
					<div
						class="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200"
					>
						Commit message changed since preview. Preview again before exporting.
					</div>
				{/if}

				{#if previewData.ok && previewData.content}
					<CodeBlock code={previewData.content} language="sql">
						<svelte:fragment slot="header">
							{#if previewOpCount > 0 || selectedOpCount > 0}
								<Label variant="secondary" size="sm" rounded="md" mono>
									<FileCode size={11} />
									{previewData.ok ? (previewData.filepath ?? 'ops/unknown.sql') : '-'}
								</Label>
							{/if}
							<Label variant="secondary" size="sm" rounded="md" mono>
								<Layers size={11} />
								{previewData.ok ? previewOpCount : selectedOpCount} ops
							</Label>
							{#if (previewData.filePaths?.length ?? 0) > 0}
								<Label variant="secondary" size="sm" rounded="md" mono>
									<Files size={11} />
									{previewData.filePaths?.length} files
								</Label>
							{/if}
							<Label variant="secondary" size="sm" rounded="md">
								<Clock size={11} />
								{formatExportedAt(previewData.exportedAt)}
							</Label>
							<Label variant="secondary" size="sm" rounded="md">
								<User size={11} />
								{previewData.gitIdentity?.name ?? '-'} &lt;{previewData.gitIdentity?.email ??
									'-'}&gt;
							</Label>
						</svelte:fragment>
					</CodeBlock>
				{:else if previewData.ok && (previewData.filePaths?.length ?? 0) > 0}
					<div
						class="rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400"
					>
						<div class="mb-1 font-semibold">Files to commit:</div>
						{#each previewData.filePaths ?? [] as fp}
							<code class="block font-mono">{fp}</code>
						{/each}
					</div>
				{:else if !previewData.ok}
					<p class="text-xs text-neutral-500 dark:text-neutral-400">
						Resolve the preflight errors, then preview again to see the export output.
					</p>
				{/if}
			</div>
		{:else}
			<p class="text-sm text-neutral-600 dark:text-neutral-400">No preview data returned.</p>
		{/if}
	</svelte:fragment>

	<svelte:fragment slot="footer">
		<Button
			text="Close"
			icon={X}
			iconColor="text-red-500"
			disabled={committing}
			on:click={handlePreviewCancel}
		/>
		<Button
			text="Approve & Export"
			icon={committing ? Loader2 : Check}
			iconColor={committing ? '' : 'text-blue-500'}
			disabled={previewConfirmDisabled || committing}
			loading={committing}
			on:click={handleExportConfirm}
		/>
	</svelte:fragment>
</Modal>
