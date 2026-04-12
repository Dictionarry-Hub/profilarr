<script lang="ts">
	import { Download, RefreshCw, FileText, Filter, Layers, BrushCleaning } from 'lucide-svelte';
	import ActionsBar from '$ui/actions/ActionsBar.svelte';
	import SearchAction from '$ui/actions/SearchAction.svelte';
	import ActionButton from '$ui/actions/ActionButton.svelte';
	import Dropdown from '$ui/dropdown/Dropdown.svelte';
	import DropdownItem from '$ui/dropdown/DropdownItem.svelte';
	import DropdownHeader from '$ui/dropdown/DropdownHeader.svelte';
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
		<svelte:fragment slot="dropdown" let:dropdownPosition>
			<Dropdown position={dropdownPosition} minWidth="16rem">
				<DropdownHeader label="Log Files" />
				<div class="max-h-64 overflow-y-auto">
					{#each logFiles as file}
						<DropdownItem
							label={file.filename}
							secondaryText={formatFileSize(file.size)}
							selected={selectedFile === file.filename}
							on:click={() => onChangeFile(file.filename)}
						/>
					{/each}
				</div>
			</Dropdown>
		</svelte:fragment>
	</ActionButton>

	<!-- Download -->
	<Tooltip text="Download">
		<ActionButton icon={Download} on:click={onDownload} />
	</Tooltip>

	<!-- Level Filter -->
	<ActionButton icon={Filter} hasDropdown={true} dropdownPosition="right">
		<svelte:fragment slot="dropdown" let:dropdownPosition>
			<Dropdown position={dropdownPosition} minWidth="8rem">
				<DropdownHeader label="Level" />
				{#each logLevels as level}
					<DropdownItem
						label={level}
						selected={selectedLevel === level}
						labelClass="font-mono {levelColors[level]}"
						on:click={() => onChangeLevel(level)}
					/>
				{/each}
			</Dropdown>
		</svelte:fragment>
	</ActionButton>

	<!-- Source Filter -->
	<ActionButton icon={Layers} hasDropdown={true} dropdownPosition="right">
		<svelte:fragment slot="dropdown" let:dropdownPosition>
			<Dropdown position={dropdownPosition} minWidth="12rem">
				<DropdownHeader label="Source" />
				<div class="max-h-64 overflow-y-auto">
					{#each uniqueSources as source}
						<DropdownItem
							label={source}
							labelClass="font-mono"
							selected={selectedSources.has(source)}
							on:click={() => onToggleSource(source)}
						/>
					{/each}
				</div>
			</Dropdown>
		</svelte:fragment>
	</ActionButton>

	<!-- Refresh -->
	<Tooltip text="Refresh">
		<ActionButton on:click={onRefresh}>
			<RefreshCw
				size={20}
				class="text-neutral-700 dark:text-neutral-300 {isRefreshing ? 'animate-spin' : ''}"
			/>
		</ActionButton>
	</Tooltip>

	<!-- Cleanup -->
	{#if onCleanup}
		<Tooltip text="Cleanup">
			<ActionButton icon={BrushCleaning} on:click={onCleanup} />
		</Tooltip>
	{/if}
</ActionsBar>
