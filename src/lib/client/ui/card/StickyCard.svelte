<script lang="ts">
	import Breadcrumb from '$ui/navigation/breadcrumb/Breadcrumb.svelte';

	export let position: 'top' | 'bottom' = 'top';
	export let variant: 'default' | 'transparent' | 'blur' = 'default';
	export let breadcrumbItems: { label: string; href: string }[] = [];
	export let breadcrumbCurrent: string = '';
	export let stickyBreadcrumb: boolean = true;

	$: bgClass =
		variant === 'default'
			? 'bg-surface-muted'
			: variant === 'blur'
				? 'backdrop-blur-sm bg-surface-muted/50'
				: '';
	$: hasBreadcrumb = breadcrumbItems.length > 0;
	$: stickyPositionClass =
		position === 'bottom'
			? 'bottom-0'
			: hasBreadcrumb && !stickyBreadcrumb
				? 'top-[-37px]'
				: 'top-0';
</script>

<div class="sticky z-10 -mx-4 md:-mx-8 {bgClass} {stickyPositionClass}">
	{#if hasBreadcrumb}
		<div class="px-4 py-2 md:px-12">
			<Breadcrumb items={breadcrumbItems} current={breadcrumbCurrent} />
		</div>
		<div class="mx-4 border-b border-border-muted md:mx-8"></div>
	{/if}
	<div class="px-4 py-3 md:px-12 md:py-4">
		<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
			<div
				class="min-w-0 [&_h1]:text-base [&_h1]:font-semibold [&_h1]:md:text-xl [&_p]:text-xs [&_p]:md:text-sm"
			>
				<slot name="left" />
			</div>
			<div class="border-t border-border-muted pt-3 md:border-0 md:pt-0">
				<div class="flex flex-shrink-0 flex-wrap items-center gap-2">
					<slot name="right" />
				</div>
			</div>
		</div>
	</div>
	{#if variant === 'default'}
		{#if position === 'top'}
			<div class="mx-4 border-b border-border-muted md:mx-8"></div>
		{:else}
			<div class="mx-4 border-t border-border-muted md:mx-8"></div>
		{/if}
	{/if}
</div>
