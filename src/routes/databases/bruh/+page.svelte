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

<div class="flex min-h-screen items-center bg-surface p-8">
	<div class="mx-auto w-full max-w-4xl space-y-6">
		<!-- Cheeky Message -->
		<div class="text-center">
			<p class="text-2xl font-medium text-text">If you insist...</p>
		</div>

		<!-- Embed Container -->
		<div class="overflow-hidden rounded-card border border-border bg-surface shadow-card">
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
					<p class="mb-4 text-2xl text-text-soft">Here's your tweet:</p>
					<a
						href={data.url}
						target="_blank"
						rel="noopener noreferrer"
						class="text-xl text-info-icon hover:underline"
					>
						{data.url}
					</a>
				</div>
			{:else if data.type === 'reddit'}
				<div class="p-12 text-center">
					<p class="mb-4 text-2xl text-text-soft">Here's your Reddit post:</p>
					<a
						href={data.url}
						target="_blank"
						rel="noopener noreferrer"
						class="text-xl text-info-icon hover:underline"
					>
						{data.url}
					</a>
				</div>
			{:else}
				<div class="p-12 text-center">
					<p class="mb-4 text-2xl text-text-soft">Here's what you tried to link:</p>
					<a
						href={data.url}
						target="_blank"
						rel="noopener noreferrer"
						class="text-xl text-info-icon hover:underline"
					>
						{data.url}
					</a>
				</div>
			{/if}
		</div>

		<!-- Footer Message with Button -->
		<div class="flex flex-wrap items-center justify-center gap-4 text-center text-text-soft">
			<p>
				You need to link a <strong class="text-text">GitHub repository</strong>
			</p>
			<a
				href="/databases/new?name={encodeURIComponent(
					data.formData.name
				)}&branch={encodeURIComponent(data.formData.branch)}&sync_strategy={encodeURIComponent(
					data.formData.syncStrategy
				)}&auto_pull={encodeURIComponent(
					data.formData.autoPull
				)}&local_ops_enabled={encodeURIComponent(data.formData.localOpsEnabled)}"
				class="inline-flex items-center gap-2 rounded-card bg-info-bg px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-info-bg"
			>
				<RotateCcw size={16} />
				Try Again
			</a>
		</div>
	</div>
</div>
