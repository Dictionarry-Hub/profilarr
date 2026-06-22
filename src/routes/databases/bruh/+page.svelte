<script lang="ts">
	import { RotateCcw } from 'lucide-svelte';
	import { alertStore } from '$alerts/store';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	onMount(() => {
		alertStore.add('error', 'bruh', 8000);
	});

	// Extract YouTube video ID from URL and add autoplay
	function getYouTubeEmbedUrl(url: string): string {
		const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
		if (videoIdMatch) {
			return `https://www.youtube.com/embed/${videoIdMatch[1]}?autoplay=1`;
		}
		return '';
	}

	$: embedUrl = data.type === 'youtube' ? getYouTubeEmbedUrl(data.url) : '';
</script>

<svelte:head>
	<title>Bruh - Profilarr</title>
</svelte:head>

<div class="flex min-h-screen items-center bg-white p-8 dark:bg-neutral-950">
	<div class="mx-auto w-full max-w-4xl space-y-6">
		<!-- Cheeky Message -->
		<div class="text-center">
			<p class="text-2xl font-medium text-neutral-900 dark:text-neutral-50">If you insist...</p>
		</div>

		<!-- Embed Container -->
		<div
			class="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900"
		>
			{#if data.type === 'youtube' && embedUrl}
				<div class="aspect-video w-full">
					<iframe
						src={embedUrl}
						title="YouTube video"
						frameborder="0"
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
						allowfullscreen
						class="h-full w-full"
					></iframe>
				</div>
			{:else if data.type === 'twitter'}
				<div class="p-12 text-center">
					<p class="mb-4 text-2xl text-neutral-700 dark:text-neutral-300">Here's your tweet:</p>
					<a
						href={data.url}
						target="_blank"
						rel="noopener noreferrer"
						class="text-xl text-blue-600 hover:underline dark:text-blue-400"
					>
						{data.url}
					</a>
				</div>
			{:else if data.type === 'reddit'}
				<div class="p-12 text-center">
					<p class="mb-4 text-2xl text-neutral-700 dark:text-neutral-300">
						Here's your Reddit post:
					</p>
					<a
						href={data.url}
						target="_blank"
						rel="noopener noreferrer"
						class="text-xl text-blue-600 hover:underline dark:text-blue-400"
					>
						{data.url}
					</a>
				</div>
			{:else}
				<div class="p-12 text-center">
					<p class="mb-4 text-2xl text-neutral-700 dark:text-neutral-300">
						Here's what you tried to link:
					</p>
					<a
						href={data.url}
						target="_blank"
						rel="noopener noreferrer"
						class="text-xl text-blue-600 hover:underline dark:text-blue-400"
					>
						{data.url}
					</a>
				</div>
			{/if}
		</div>

		<!-- Footer Message with Button -->
		<div
			class="flex flex-wrap items-center justify-center gap-4 text-center text-neutral-600 dark:text-neutral-400"
		>
			<p>
				You need to link a <strong class="text-neutral-900 dark:text-neutral-50"
					>GitHub repository</strong
				>
			</p>
			<a
				href="/databases/new?name={encodeURIComponent(
					data.formData.name
				)}&branch={encodeURIComponent(data.formData.branch)}&sync_strategy={encodeURIComponent(
					data.formData.syncStrategy
				)}&auto_pull={encodeURIComponent(
					data.formData.autoPull
				)}&local_ops_enabled={encodeURIComponent(data.formData.localOpsEnabled)}"
				class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
			>
				<RotateCcw size={16} />
				Try Again
			</a>
		</div>
	</div>
</div>
