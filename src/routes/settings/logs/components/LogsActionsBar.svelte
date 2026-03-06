<script lang="ts">
	import {
		Download,
		RefreshCw,
		FileText,
		Filter,
		Layers,
		Check,
		BrushCleaning
	} from 'lucide-svelte';
	import ActionsBar from '$ui/actions/ActionsBar.svelte';
	import SearchAction from '$ui/actions/SearchAction.svelte';
	import ActionButton from '$ui/actions/ActionButton.svelte';
	import Dropdown from '$ui/dropdown/Dropdown.svelte';
	import Tooltip from '$ui/tooltip/Tooltip.svelte';
	import { type SearchStore } from '$stores/search';

	interface LogFile {
		filename: string;
		size: number;
		modified: Date;
	}

	export let searchStore: SearchStore;
	export let logFiles: LogFile[];
	export let selectedFile: string;
	type LogLevel = 'ALL' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
	export let selectedLevel: LogLevel;
	export let selectedSources: Set<string>;
	export let uniqueSources: string[];

	export let isRefreshing: boolean = false;

	export let onChangeFile: (filename: string) => void;
	export let onChangeLevel: (level: LogLevel) => void;
	export let onToggleSource: (source: string) => void;
	export let onRefresh: () => void;
	export let onDownload: () => void;
	export let onCleanup: (() => void) | undefined = undefined;

	const logLevels = ['ALL', 'DEBUG', 'INFO', 'WARN', 'ERROR'] as const;

	const levelColors: Record<string, string> = {
		ALL: 'text-neutral-600 dark:text-neutral-400',
		DEBUG: 'text-cyan-600 dark:text-cyan-400',
		INFO: 'text-green-600 dark:text-green-400',
		WARN: 'text-yellow-600 dark:text-yellow-400',
		ERROR: 'text-red-600 dark:text-red-400'
	};

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function formatDate(date: Date): string {
		const d = new Date(date);
		return d.toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<ActionsBar className="justify-end">
	<SearchAction {searchStore} placeholder="Search logs..." responsive />

	<!-- Log File Selector -->
	<ActionButton icon={FileText} hasDropdown={true} dropdownPosition="right">
		<svelte:fragment slot="dropdown" let:dropdownPosition let:open>
			<Dropdown position={dropdownPosition} minWidth="20rem">
				<div class="max-h-64 overflow-y-auto">
					{#each logFiles as file}
						<button
							type="button"
							on:click={() => onChangeFile(file.filename)}
							class="flex w-full items-center justify-between gap-4 border-b border-neutral-200 px-4 py-2.5 text-left transition-colors first:rounded-t-lg last:rounded-b-lg last:border-b-0 dark:border-neutral-700
								{selectedFile === file.filename
								? 'bg-neutral-100 dark:bg-neutral-700'
								: 'hover:bg-neutral-100 dark:hover:bg-neutral-700'}"
						>
							<div class="flex flex-col gap-0.5">
								<span class="font-mono text-sm text-neutral-900 dark:text-neutral-100">
									{file.filename}
								</span>
								<span class="text-xs text-neutral-500 dark:text-neutral-400">
									{formatDate(file.modified)}
								</span>
							</div>
							<span class="text-xs text-neutral-400 dark:text-neutral-500">
								{formatFileSize(file.size)}
							</span>
						</button>
					{/each}
				</div>
			</Dropdown>
		</svelte:fragment>
	</ActionButton>

	<!-- Level Filter -->
	<ActionButton icon={Filter} hasDropdown={true} dropdownPosition="right">
		<svelte:fragment slot="dropdown" let:dropdownPosition let:open>
			<Dropdown position={dropdownPosition} minWidth="8rem">
				{#each logLevels as level}
					<button
						type="button"
						on:click={() => onChangeLevel(level)}
						class="flex w-full items-center justify-between gap-3 border-b border-neutral-200 px-4 py-2 text-left transition-colors first:rounded-t-lg last:rounded-b-lg last:border-b-0 dark:border-neutral-700
							{selectedLevel === level
							? 'bg-neutral-100 dark:bg-neutral-700'
							: 'hover:bg-neutral-100 dark:hover:bg-neutral-700'}"
					>
						<span class="font-medium {levelColors[level]}">{level}</span>
					</button>
				{/each}
			</Dropdown>
		</svelte:fragment>
	</ActionButton>

	<!-- Source Filter -->
	<ActionButton icon={Layers} hasDropdown={true} dropdownPosition="right">
		<svelte:fragment slot="dropdown" let:dropdownPosition let:open>
			<Dropdown position={dropdownPosition} minWidth="12rem">
				<div class="max-h-64 overflow-y-auto">
					{#each uniqueSources as source}
						<button
							type="button"
							on:click={() => onToggleSource(source)}
							class="flex w-full items-center justify-between gap-3 border-b border-neutral-200 px-4 py-2 text-left text-sm transition-colors first:rounded-t-lg last:rounded-b-lg last:border-b-0 dark:border-neutral-700
								{selectedSources.has(source)
								? 'bg-neutral-100 dark:bg-neutral-700'
								: 'hover:bg-neutral-100 dark:hover:bg-neutral-700'}"
						>
							<span class="text-neutral-700 dark:text-neutral-300">{source}</span>
							{#if selectedSources.has(source)}
								<Check size={16} class="text-accent-600 dark:text-accent-400" />
							{/if}
						</button>
					{/each}
				</div>
			</Dropdown>
		</svelte:fragment>
	</ActionButton>

	<!-- Refresh -->
	<Tooltip text="Refresh logs">
		<ActionButton on:click={onRefresh}>
			<RefreshCw
				size={20}
				class="text-neutral-700 dark:text-neutral-300 {isRefreshing ? 'animate-spin' : ''}"
			/>
		</ActionButton>
	</Tooltip>

	<!-- Cleanup -->
	{#if onCleanup}
		<Tooltip text="Run log cleanup">
			<ActionButton icon={BrushCleaning} on:click={onCleanup} />
		</Tooltip>
	{/if}

	<!-- Download -->
	<Tooltip text="Download logs as JSON">
		<ActionButton icon={Download} on:click={onDownload} />
	</Tooltip>
</ActionsBar>
