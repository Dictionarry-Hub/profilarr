<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { createEventDispatcher } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { Search, X } from 'lucide-svelte';
	import type { SearchStore } from '$lib/client/stores/search';
	import Badge from '$ui/badge/Badge.svelte';

	export let searchStore: SearchStore;
	export let placeholder: string = 'Search...';
	export let activeQuery: string = '';
	export let responsive: boolean = false;
	export let hideIcon: boolean = false;

	const dispatch = createEventDispatcher<{ submit: string; clearQuery: void }>();

	let inputRef: HTMLInputElement;
	let modalInputRef: HTMLInputElement;
	let isFocused = false;
	let modalOpen = false;

	// Mobile detection
	let isMobile = false;
	let mediaQuery: MediaQueryList | null = null;

	onMount(() => {
		if (responsive && typeof window !== 'undefined') {
			mediaQuery = window.matchMedia('(max-width: 767px)');
			isMobile = mediaQuery.matches;
			mediaQuery.addEventListener('change', handleMediaChange);
		}
	});

	onDestroy(() => {
		if (mediaQuery) {
			mediaQuery.removeEventListener('change', handleMediaChange);
		}
	});

	function handleMediaChange(e: MediaQueryListEvent) {
		isMobile = e.matches;
		if (!isMobile && modalOpen) {
			modalOpen = false;
		}
	}

	$: useMobileMode = responsive && isMobile;

	// Reactive query binding
	$: query = $searchStore.query;

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		searchStore.setQuery(target.value);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && query.trim()) {
			dispatch('submit', query.trim());
			if (modalOpen) modalOpen = false;
		} else if (e.key === 'Backspace' && !query && activeQuery) {
			dispatch('clearQuery');
		} else if (e.key === 'Escape' && modalOpen) {
			modalOpen = false;
		}
	}

	function handleClear() {
		searchStore.clear();
		if (modalOpen) {
			modalInputRef?.focus();
		} else {
			inputRef?.focus();
		}
	}

	function handleClearQuery() {
		dispatch('clearQuery');
		if (modalOpen) {
			modalInputRef?.focus();
		} else {
			inputRef?.focus();
		}
	}

	async function openModal() {
		modalOpen = true;
		await tick();
		modalInputRef?.focus();
	}

	function closeModal() {
		modalOpen = false;
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			closeModal();
		}
	}
</script>

{#if useMobileMode}
	<!-- Mobile: Search button -->
	<div class="relative flex min-w-0 flex-1">
		<button
			type="button"
			on:click={openModal}
			class="relative flex h-10 w-full items-center justify-between rounded-xl border border-neutral-300 bg-white px-3 transition-colors hover:bg-neutral-50 dark:border-neutral-700/60 dark:bg-neutral-800/50 dark:hover:bg-neutral-800"
			title="Search"
		>
			<span class="flex items-center gap-2">
				{#if !hideIcon}
					<Search size={20} class="text-neutral-700 dark:text-neutral-300" />
				{/if}
				<span class="max-w-[14rem] truncate text-sm text-neutral-600 dark:text-neutral-300">
					{query || activeQuery || 'Search'}
				</span>
			</span>
			{#if query || activeQuery}
				<span class="h-2.5 w-2.5 rounded-full bg-accent-500"></span>
			{/if}
		</button>
	</div>

	<!-- Mobile: Search modal -->
	{#if modalOpen}
		<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
		<div
			class="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 px-4 pt-4"
			on:click={handleBackdropClick}
			transition:fade={{ duration: 150 }}
		>
			<div
				class="w-full max-w-lg rounded-xl border border-neutral-300 bg-white shadow-xl dark:border-neutral-700/60 dark:bg-neutral-800/50"
				transition:fly={{ y: -20, duration: 200 }}
			>
				<div class="relative flex items-center p-3">
					<!-- Search icon -->
					{#if !hideIcon}
						<div class="pointer-events-none absolute left-6 flex items-center">
							<Search size={18} class="text-neutral-500 dark:text-neutral-400" />
						</div>
					{/if}

					<!-- Active query badge -->
					{#if activeQuery}
						<div class="{hideIcon ? 'ml-3' : 'ml-10'} flex flex-shrink-0 items-center pr-2">
							<Badge variant="accent" size="sm">{activeQuery}</Badge>
						</div>
					{/if}

					<!-- Input -->
					<input
						bind:this={modalInputRef}
						type="text"
						value={query}
						on:input={handleInput}
						on:keydown={handleKeydown}
						{placeholder}
						class="h-10 w-full rounded-lg bg-transparent pr-10 text-sm text-neutral-900 placeholder-neutral-500 outline-none dark:text-neutral-100 dark:placeholder-neutral-400 {activeQuery
							? 'pl-2'
							: hideIcon
								? 'pl-3'
								: 'pl-10'}"
					/>

					<!-- Clear/Close button -->
					{#if query}
						<button
							on:click={handleClear}
							class="absolute right-6 flex h-8 w-8 items-center justify-center rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800"
						>
							<X size={18} class="text-neutral-500 dark:text-neutral-400" />
						</button>
					{:else if activeQuery}
						<button
							on:click={handleClearQuery}
							class="absolute right-6 flex h-8 w-8 items-center justify-center rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800"
						>
							<X size={18} class="text-neutral-500 dark:text-neutral-400" />
						</button>
					{:else}
						<button
							on:click={closeModal}
							class="absolute right-6 flex h-8 w-8 items-center justify-center rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800"
						>
							<X size={18} class="text-neutral-500 dark:text-neutral-400" />
						</button>
					{/if}
				</div>
			</div>
		</div>
	{/if}
{:else}
	<!-- Desktop: Inline search -->
	<div class="relative flex flex-1">
		<div
			class="relative flex h-10 w-full items-center rounded-xl border border-neutral-300 bg-white transition-colors dark:border-neutral-700/60 dark:bg-neutral-800/50"
		>
			<!-- Search icon -->
			{#if !hideIcon}
				<div class="pointer-events-none absolute left-3 flex items-center">
					<Search size={18} class="text-neutral-500 dark:text-neutral-400" />
				</div>
			{/if}

			<!-- Active query badge -->
			{#if activeQuery}
				<div class="{hideIcon ? 'ml-3' : 'ml-10'} flex h-full flex-shrink-0 items-center">
					<Badge variant="accent" size="sm">{activeQuery}</Badge>
				</div>
			{/if}

			<!-- Input -->
			<input
				bind:this={inputRef}
				type="text"
				value={query}
				on:input={handleInput}
				on:keydown={handleKeydown}
				on:focus={() => (isFocused = true)}
				on:blur={() => (isFocused = false)}
				placeholder={activeQuery ? '' : placeholder}
				class="h-full w-full bg-transparent pr-10 text-base text-neutral-900 placeholder-neutral-500 outline-none sm:text-sm dark:text-neutral-100 dark:placeholder-neutral-400 {activeQuery
					? 'pl-2'
					: hideIcon
						? 'pl-3'
						: 'pl-10'}"
			/>

			<!-- Clear button -->
			{#if query}
				<button
					on:click={handleClear}
					class="absolute right-2 flex h-6 w-6 items-center justify-center rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800"
				>
					<X size={14} class="text-neutral-500 dark:text-neutral-400" />
				</button>
			{:else if activeQuery}
				<button
					on:click={handleClearQuery}
					class="absolute right-2 flex h-6 w-6 items-center justify-center rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800"
				>
					<X size={14} class="text-neutral-500 dark:text-neutral-400" />
				</button>
			{/if}
		</div>
	</div>
{/if}
