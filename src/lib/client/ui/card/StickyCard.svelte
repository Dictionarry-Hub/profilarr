<script lang="ts">
	import { onMount } from 'svelte';

	import Breadcrumb from '$ui/navigation/breadcrumb/Breadcrumb.svelte';

	export let position: 'top' | 'bottom' = 'top';
	export let variant: 'default' | 'transparent' | 'blur' = 'default';
	export let breadcrumbItems: { label: string; href: string }[] = [];
	export let breadcrumbCurrent: string = '';

	let isStuck = false;
	let sentinel: HTMLDivElement;

	onMount(() => {
		const observer = new IntersectionObserver(
			([entry]) => {
				isStuck = !entry.isIntersecting;
			},
			{ threshold: 0 }
		);

		if (sentinel) observer.observe(sentinel);

		return () => observer.disconnect();
	});

	$: bgClass =
		variant === 'default'
			? 'bg-neutral-50 dark:bg-neutral-900'
			: variant === 'blur'
				? 'backdrop-blur-sm bg-neutral-50/50 dark:bg-neutral-900/50'
				: '';
</script>

<div
	bind:this={sentinel}
	class="absolute {position === 'top' ? 'top-0' : 'bottom-0'} h-px w-px"
></div>

<div
	class="sticky z-10 -mx-4 md:-mx-8 {bgClass}
		{position === 'top' ? 'top-0' : 'bottom-0'}"
>
	{#if breadcrumbItems.length > 0}
		<div class="px-4 py-2 md:px-12">
			<Breadcrumb items={breadcrumbItems} current={breadcrumbCurrent} />
		</div>
		<div class="mx-4 border-b border-neutral-200 md:mx-8 dark:border-neutral-800"></div>
	{/if}
	<div class="px-4 py-3 md:px-12 md:py-4">
		<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
			<div
				class="min-w-0 [&_h1]:text-base [&_h1]:font-semibold [&_h1]:md:text-xl [&_p]:text-xs [&_p]:md:text-sm"
			>
				<slot name="left" />
			</div>
			<div class="border-t border-neutral-200 pt-3 md:border-0 md:pt-0 dark:border-neutral-800">
				<div class="flex flex-shrink-0 flex-wrap items-center gap-2">
					<slot name="right" />
				</div>
			</div>
		</div>
	</div>
	{#if variant === 'default'}
		{#if position === 'top'}
			<div class="mx-4 border-b border-neutral-200 md:mx-8 dark:border-neutral-800"></div>
		{:else}
			<div class="mx-4 border-t border-neutral-200 md:mx-8 dark:border-neutral-800"></div>
		{/if}
	{/if}
</div>
