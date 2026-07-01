<script lang="ts">
	export let variant:
		| 'default'
		| 'secondary'
		| 'destructive'
		| 'outline'
		| 'ghost'
		| 'success'
		| 'warning'
		| 'danger'
		| 'info'
		| 'link' = 'default';
	export let customVariant: string = '';
	export let size: 'sm' | 'md' | 'lg' = 'md';
	export let radius: 'sm' | 'md' | 'lg' | 'xl' | 'full' = 'full';
	export let mono: boolean = false;
	export let href: string | undefined = undefined;
	export let target: string | undefined = undefined;
	export let rel: string | undefined = undefined;

	const variantClasses = {
		default: 'bg-accent-solid text-on-accent',
		secondary: 'border border-border bg-surface text-text-soft shadow-control',
		destructive: 'bg-danger-solid text-on-danger',
		outline: 'border border-border text-text-soft',
		ghost: 'bg-[var(--theme-ghost-label-bg)] text-[var(--theme-ghost-label-text)]',
		success: 'bg-[var(--theme-success-bg)] text-[var(--theme-success-text)]',
		warning: 'bg-[var(--theme-warning-bg)] text-[var(--theme-warning-text)]',
		danger: 'bg-[var(--theme-danger-bg)] text-[var(--theme-danger-text)]',
		info: 'bg-[var(--theme-info-bg)] text-[var(--theme-info-text)]',
		link: 'bg-surface-hover text-[var(--theme-link-text)]'
	};

	const sizeClasses = {
		sm: 'gap-1 px-2 py-1 text-[10px]',
		md: 'gap-1 px-2.5 py-1 text-xs',
		lg: 'gap-1.5 px-3 py-1.5 text-sm'
	};

	const radiusClasses = {
		sm: 'rounded-control-sm',
		md: 'rounded-control-sm',
		lg: 'rounded-control',
		xl: 'rounded-control',
		full: 'rounded-pill'
	};

	$: resolvedVariantClasses = customVariant || variantClasses[variant];
	$: classes = `inline-flex items-center leading-none font-medium ${resolvedVariantClasses} ${sizeClasses[size]} ${radiusClasses[radius]} ${mono ? 'font-mono' : ''}`;
</script>

{#if href}
	<a {href} {target} {rel} class={classes}>
		<slot />
	</a>
{:else}
	<span class={classes}>
		<slot />
	</span>
{/if}
