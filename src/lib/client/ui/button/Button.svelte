<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { ComponentType } from 'svelte';
	import { Loader2 } from 'lucide-svelte';
	import Tooltip from '$ui/tooltip/Tooltip.svelte';

	export let text: string = '';
	export let variant: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' = 'secondary';
	export let size: 'xs' | 'sm' | 'md' = 'sm';
	export let disabled: boolean = false;
	export let softDisabled: boolean = false;
	export let icon: ComponentType | null = null;
	export let leadingIcon: ComponentType | { path: string } | null = null;
	export let iconColor: string = '';
	export let textColor: string = '';
	export let iconPosition: 'left' | 'right' = 'left';
	export let type: 'button' | 'submit' = 'button';
	// Responsive: auto-switch to xs on smaller screens (< 768px)
	export let responsive: boolean = false;
	// Hide text on mobile (show icon only)
	export let hideTextOnMobile: boolean = false;
	export let fullWidth: boolean = false;
	// Optional href - renders as anchor instead of button
	export let href: string | undefined = undefined;
	export let target: string | undefined = undefined;
	export let rel: string | undefined = undefined;
	// Alignment for content (center or between for dropdowns)
	export let justify: 'center' | 'between' = 'center';
	export let title: string = '';
	export let ariaLabel: string = '';
	export let tooltip: string = '';
	export let tooltipPosition: 'top' | 'bottom' | 'left' | 'right' = 'bottom';
	export let tooltipAlign: 'left' | 'middle' | 'right' = 'middle';
	export let loading: boolean = false;
	// Optional data-onboarding attribute for cutscene targeting
	export let onboarding: string | undefined = undefined;

	let isSmallScreen = false;
	let mediaQuery: MediaQueryList | null = null;

	onMount(() => {
		if (responsive && typeof window !== 'undefined') {
			mediaQuery = window.matchMedia('(max-width: 767px)');
			isSmallScreen = mediaQuery.matches;
			mediaQuery.addEventListener('change', handleMediaChange);
		}
	});

	onDestroy(() => {
		if (mediaQuery) {
			mediaQuery.removeEventListener('change', handleMediaChange);
		}
	});

	function handleMediaChange(e: MediaQueryListEvent) {
		isSmallScreen = e.matches;
	}

	$: justifyClass = justify === 'between' ? 'justify-between' : 'justify-center';

	$: disabledClass = disabled || softDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer';
	$: baseClasses = `inline-flex items-center ${justifyClass} font-medium shadow-control active:shadow-control-active transition-colors ${disabledClass}`;

	const sizeClasses = {
		xs: 'gap-1 rounded-control-sm px-2 py-1 text-xs',
		sm: 'gap-1.5 rounded-control px-3 py-1.5 text-sm md:py-2',
		md: 'gap-2 rounded-control px-4 py-2.5'
	};

	const iconOnlySizeClasses = {
		xs: 'rounded-control-sm p-1.5 text-xs',
		sm: 'rounded-control p-2 text-sm',
		md: 'rounded-control p-2.5'
	};

	const variantClasses = {
		primary: 'bg-accent-solid text-on-accent hover:bg-accent-solid-hover',
		secondary: 'border border-border bg-surface text-text-soft hover:bg-surface-hover',
		danger: 'bg-danger-solid text-on-danger hover:bg-danger-solid-hover',
		ghost: 'text-text-muted hover:bg-surface-hover hover:text-text-soft',
		outline: 'border border-border text-text-muted hover:bg-surface-hover hover:text-text-soft'
	};

	$: effectiveSize = responsive && isSmallScreen ? 'xs' : size;
	$: widthClass = fullWidth ? 'w-full' : '';
	$: baseTextColor =
		textColor || (variant === 'ghost' || variant === 'outline' ? 'text-text-soft' : '');
	$: baseIconColor =
		iconColor || (variant === 'ghost' || variant === 'outline' ? 'text-text-muted' : '');
	$: effectiveIcon = loading ? Loader2 : icon;
	$: effectiveIconColor = loading ? baseIconColor + ' animate-spin' : baseIconColor;
	$: isLeadingSvg = leadingIcon && typeof leadingIcon === 'object' && 'path' in leadingIcon;
	$: isIconOnly = !!((icon || leadingIcon) && !text);
	$: activeSizeClasses = isIconOnly ? iconOnlySizeClasses : sizeClasses;
	$: classes = `group ${baseClasses} ${activeSizeClasses[effectiveSize]} ${variantClasses[variant]} ${widthClass}`;
	$: iconSize = effectiveSize === 'xs' ? 12 : effectiveSize === 'sm' ? 14 : 16;
</script>

<Tooltip text={tooltip} position={tooltipPosition} align={tooltipAlign} {fullWidth}>
	{#if href}
		<a
			{href}
			{target}
			{rel}
			title={!tooltip && title ? title : undefined}
			aria-label={ariaLabel || tooltip || undefined}
			aria-disabled={softDisabled || disabled ? 'true' : undefined}
			class={classes}
			data-onboarding={onboarding}
			on:click
		>
			{#if effectiveIcon && iconPosition === 'left'}
				<svelte:component this={effectiveIcon} size={iconSize} class={effectiveIconColor} />
			{/if}
			{#if leadingIcon}
				<span class="inline-flex items-center gap-1.5">
					{#if isLeadingSvg}
						<svg
							role="img"
							viewBox="0 0 24 24"
							fill="currentColor"
							width={iconSize}
							height={iconSize}
						>
							<path d={(leadingIcon as { path: string }).path} />
						</svg>
					{:else}
						<svelte:component this={leadingIcon as ComponentType} size={iconSize} />
					{/if}
					{#if text}
						<span class="{baseTextColor} {hideTextOnMobile ? 'hidden md:inline' : ''}">{text}</span>
					{/if}
				</span>
			{:else if text}
				<span class="{baseTextColor} {hideTextOnMobile ? 'hidden md:inline' : ''}">{text}</span>
			{/if}
			<slot />
			{#if effectiveIcon && iconPosition === 'right'}
				<svelte:component this={effectiveIcon} size={iconSize} class={effectiveIconColor} />
			{/if}
		</a>
	{:else}
		<button
			{type}
			{disabled}
			title={!tooltip && title ? title : undefined}
			aria-label={ariaLabel || tooltip || undefined}
			aria-disabled={softDisabled || disabled ? 'true' : undefined}
			class={classes}
			data-onboarding={onboarding}
			on:click
		>
			{#if effectiveIcon && iconPosition === 'left'}
				<svelte:component this={effectiveIcon} size={iconSize} class={effectiveIconColor} />
			{/if}
			{#if leadingIcon}
				<span class="inline-flex items-center gap-1.5">
					{#if isLeadingSvg}
						<svg
							role="img"
							viewBox="0 0 24 24"
							fill="currentColor"
							width={iconSize}
							height={iconSize}
						>
							<path d={(leadingIcon as { path: string }).path} />
						</svg>
					{:else}
						<svelte:component this={leadingIcon as ComponentType} size={iconSize} />
					{/if}
					{#if text}
						<span class="{baseTextColor} {hideTextOnMobile ? 'hidden md:inline' : ''}">{text}</span>
					{/if}
				</span>
			{:else if text}
				<span class="{baseTextColor} {hideTextOnMobile ? 'hidden md:inline' : ''}">{text}</span>
			{/if}
			<slot />
			{#if effectiveIcon && iconPosition === 'right'}
				<svelte:component this={effectiveIcon} size={iconSize} class={effectiveIconColor} />
			{/if}
		</button>
	{/if}
</Tooltip>
