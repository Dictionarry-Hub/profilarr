<script lang="ts">
	import { page } from '$app/stores';
	import gif404 from '$assets/404.gif';

	$: statusCode = $page.status;
	$: errorMessage = $page.error?.message || 'An unexpected error occurred';
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-surface-muted px-4"
>
	<div class="flex max-w-6xl items-center gap-12">
		<!-- Left column: Error info and button -->
		<div class="flex-1">
			<h1 class="mb-4 text-9xl font-bold text-text">
				{statusCode}
			</h1>

			<p class="mb-8 text-lg text-text-soft">
				{errorMessage}
			</p>

			<a
				href="/"
				class="inline-block rounded-card bg-surface px-6 py-3 font-semibold text-on-accent transition-colors hover:bg-surface"
			>
				Go Home
			</a>
		</div>

		<!-- Right column: 404 gif -->
		{#if statusCode === 404}
			<div class="flex-1">
				<img src={gif404} alt="404 Not Found" class="h-auto w-full rounded-card" />
			</div>
		{/if}
	</div>
</div>
