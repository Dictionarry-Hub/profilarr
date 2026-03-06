<script lang="ts">
	import { onMount } from 'svelte';

	export let name: string;
	export let repoUrl: string;
	export let size: 'sm' | 'md' = 'sm';

	const sizeClasses = {
		sm: 'h-8 w-8',
		md: 'h-10 w-10'
	};

	let loaded = false;
	let failed = false;
	let retryCount = 0;
	let avatarVersion: number | null = null;
	let imgEl: HTMLImageElement | null = null;
	let lastSrc = '';

	function getGitHubAvatar(url: string): string {
		const match = url.match(/github\.com\/([^\/]+)\//);
		if (match) {
			return `/api/github/avatar/${match[1]}`;
		}
		return '';
	}

	$: baseSrc = getGitHubAvatar(repoUrl);
	$: avatarSrc = baseSrc ? (avatarVersion ? `${baseSrc}?v=${avatarVersion}` : baseSrc) : '';
	$: if (!avatarSrc && !loaded) {
		loaded = true;
		failed = true;
	}

	function handleLoad() {
		loaded = true;
		failed = false;
	}

	function handleError() {
		if (retryCount < 1) {
			retryCount += 1;
			avatarVersion = Date.now();
			return;
		}
		loaded = true;
		failed = true;
	}

	function checkImageState() {
		if (!imgEl || !avatarSrc) return;
		if (!imgEl.complete) return;
		if (imgEl.naturalWidth > 0) {
			handleLoad();
		} else {
			handleError();
		}
	}

	onMount(() => {
		queueMicrotask(checkImageState);
	});

	$: if (avatarSrc && avatarSrc !== lastSrc) {
		lastSrc = avatarSrc;
		queueMicrotask(checkImageState);
	}
</script>

<div class="relative {sizeClasses[size]}">
	{#if !loaded}
		<div class="absolute inset-0 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-700"></div>
	{/if}
	{#if failed}
		<div
			class="flex {sizeClasses[
				size
			]} items-center justify-center rounded-lg bg-neutral-200 text-xs font-semibold text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300"
		>
			{name?.slice(0, 1) ?? '?'}
		</div>
	{:else}
		<img
			bind:this={imgEl}
			src={avatarSrc}
			alt="{name} avatar"
			class="{sizeClasses[size]} rounded-lg {loaded ? 'opacity-100' : 'opacity-0'}"
			on:load={handleLoad}
			on:error={handleError}
		/>
	{/if}
</div>
