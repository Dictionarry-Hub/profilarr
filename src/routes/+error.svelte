<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import gif404 from '$assets/404.gif';

	$: statusCode = $page.status;
	$: errorMessage = $page.error?.message || 'An unexpected error occurred';
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-neutral-50 px-4 dark:bg-neutral-900"
>
	<div class="flex max-w-6xl items-center gap-12">
		<!-- Left column: Error info and button -->
		<div class="flex-1">
			<h1 class="mb-4 text-9xl font-bold text-neutral-900 dark:text-neutral-50">
				{statusCode}
			</h1>

			<p class="mb-8 text-lg text-neutral-600 dark:text-neutral-400">
				{errorMessage}
			</p>

			<a
				href={resolve('/')}
				class="inline-block rounded-lg bg-neutral-900 px-6 py-3 font-semibold text-white transition-colors hover:bg-neutral-700 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
			>
				Go Home
			</a>
		</div>

		<!-- Right column: 404 gif -->
		{#if statusCode === 404}
			<div class="flex-1">
				<img src={gif404} alt="404 Not Found" class="h-auto w-full rounded-lg" />
			</div>
		{/if}
	</div>
</div>
