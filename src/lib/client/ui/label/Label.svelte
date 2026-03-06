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
	export let rounded: 'sm' | 'md' | 'lg' | 'xl' | 'full' = 'full';
	export let mono: boolean = false;
	export let href: string | undefined = undefined;
	export let target: string | undefined = undefined;
	export let rel: string | undefined = undefined;

	const variantClasses = {
		default: 'bg-accent-600 text-white dark:bg-accent-500 dark:text-white',
		secondary: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
		destructive: 'bg-red-600 text-white dark:bg-red-500 dark:text-white',
		outline:
			'border border-neutral-300 text-neutral-700 dark:border-neutral-600 dark:text-neutral-300',
		ghost: 'bg-neutral-100/60 text-neutral-600 dark:bg-neutral-800/40 dark:text-neutral-400',
		success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
		warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
		danger: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
		info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
		link: 'bg-neutral-100 text-blue-700 dark:bg-neutral-800 dark:text-blue-300'
	};

	const sizeClasses = {
		sm: 'gap-1 px-2 py-1 text-[10px]',
		md: 'gap-1 px-2.5 py-1 text-xs',
		lg: 'gap-1.5 px-3 py-1.5 text-sm'
	};

	const roundedClasses = {
		sm: 'rounded',
		md: 'rounded-md',
		lg: 'rounded-lg',
		xl: 'rounded-xl',
		full: 'rounded-full'
	};

	$: resolvedVariantClasses = customVariant || variantClasses[variant];
	$: classes = `inline-flex items-center leading-none font-medium ${resolvedVariantClasses} ${sizeClasses[size]} ${roundedClasses[rounded]} ${mono ? 'font-mono' : ''}`;
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
