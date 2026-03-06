<script lang="ts">
	import {
		GitBranch,
		ArrowUp,
		ArrowDown,
		ExternalLink,
		Star,
		GitFork,
		CircleDot,
		ChevronDown,
		Check,
		Database,
		RefreshCw
	} from 'lucide-svelte';
	import { invalidateAll } from '$app/navigation';
	import type { GitStatus, RepoInfo } from '$utils/git/types';
	import type { DatabaseInstancePublic } from '$db/queries/databaseInstances.ts';

	export let status: GitStatus;
	export let repoInfo: RepoInfo | null;
	export let branches: string[];
	export let database: DatabaseInstancePublic;
	export let onSync: (() => Promise<void>) | undefined = undefined;

	let branchDropdownOpen = false;
	let switching = false;
	let syncing = false;

	async function handleBranchSwitch(branch: string) {
		if (branch === status.branch || switching) return;

		switching = true;
		branchDropdownOpen = false;

		const formData = new FormData();
		formData.append('branch', branch);

		try {
			const response = await fetch('?/checkout', {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				await invalidateAll();
			}
		} finally {
			switching = false;
		}
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.branch-dropdown')) {
			branchDropdownOpen = false;
		}
	}

	async function handleSync() {
		if (syncing) return;

		syncing = true;
		try {
			// Just refresh the data (fetches from remote to check for updates)
			if (onSync) await onSync();
		} finally {
			syncing = false;
		}
	}
</script>

<svelte:window on:click={handleClickOutside} />

<div
	class="mt-6 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800"
>
	<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
		<!-- Left: Repo info -->
		<div class="flex items-center gap-4">
			{#if repoInfo}
				<img src={repoInfo.ownerAvatarUrl} alt={repoInfo.owner} class="h-8 w-8 rounded-lg" />
				<div class="flex flex-col gap-1">
					<code class="font-mono text-sm text-neutral-700 dark:text-neutral-300">
						{repoInfo.owner}/{repoInfo.repo}
					</code>
					<div class="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
						<span class="flex items-center gap-1">
							<Star size={12} />
							<code class="font-mono">{repoInfo.stars.toLocaleString()}</code>
						</span>
						<span class="flex items-center gap-1">
							<GitFork size={12} />
							<code class="font-mono">{repoInfo.forks.toLocaleString()}</code>
						</span>
						<span class="flex items-center gap-1">
							<CircleDot size={12} />
							<code class="font-mono">{repoInfo.openIssues.toLocaleString()}</code>
						</span>
					</div>
				</div>
			{:else}
				<div
					class="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-700"
				>
					<Database size={16} class="text-neutral-500 dark:text-neutral-400" />
				</div>
				<div class="flex flex-col gap-1">
					<span class="text-sm font-medium text-neutral-700 dark:text-neutral-300">
						{database.name}
					</span>
					<code class="font-mono text-xs text-neutral-500 dark:text-neutral-400">
						{database.repository_url.replace('https://github.com/', '')}
					</code>
				</div>
			{/if}
		</div>

		<!-- Right: Branch, status, action buttons -->
		<div class="flex w-full items-center justify-between gap-2 md:w-auto">
			<!-- Left group: Ahead/Behind + Branch -->
			<div class="flex items-center gap-2">
				{#if status.ahead > 0}
					<div class="flex items-center gap-1 text-sm text-yellow-600 dark:text-yellow-400">
						<ArrowUp size={14} />
						<code class="font-mono">{status.ahead}</code>
					</div>
				{/if}

				{#if status.behind > 0}
					<div class="flex items-center gap-1 text-sm text-orange-600 dark:text-orange-400">
						<ArrowDown size={14} />
						<code class="font-mono">{status.behind}</code>
					</div>
				{/if}

				<!-- Branch dropdown -->
				<div class="branch-dropdown relative">
					<button
						type="button"
						on:click|stopPropagation={() => (branchDropdownOpen = !branchDropdownOpen)}
						disabled={switching}
						class="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm transition-colors hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700"
					>
						<GitBranch size={14} class="text-neutral-500 dark:text-neutral-400" />
						<code class="font-mono text-neutral-700 dark:text-neutral-300">{status.branch}</code>
						<ChevronDown
							size={14}
							class="text-neutral-400 transition-transform {branchDropdownOpen ? 'rotate-180' : ''}"
						/>
					</button>

					{#if branchDropdownOpen}
						<div
							class="absolute top-full left-0 z-50 mt-1 max-h-60 w-48 overflow-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
						>
							{#each branches as branch}
								<button
									type="button"
									on:click={() => handleBranchSwitch(branch)}
									class="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700"
								>
									<code
										class="font-mono {branch === status.branch
											? 'text-blue-600 dark:text-blue-400'
											: 'text-neutral-700 dark:text-neutral-300'}">{branch}</code
									>
									{#if branch === status.branch}
										<Check size={14} class="text-blue-600 dark:text-blue-400" />
									{/if}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<!-- Right group: External link + Sync -->
			<div class="flex items-center gap-2">
				<a
					href={repoInfo?.htmlUrl ?? database.repository_url}
					target="_blank"
					rel="noopener noreferrer"
					title="Open in GitHub"
					class="flex items-center justify-center rounded-md border border-neutral-200 bg-white p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
				>
					<ExternalLink size={16} />
				</a>

				<button
					type="button"
					on:click={handleSync}
					disabled={syncing}
					title="Sync now"
					class="flex items-center justify-center rounded-md border border-neutral-200 bg-white p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
				>
					<RefreshCw size={16} class={syncing ? 'animate-spin' : ''} />
				</button>
			</div>
		</div>
	</div>
</div>
