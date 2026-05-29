<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { ComponentType } from 'svelte';
	import { Check, Info } from 'lucide-svelte';
	import IconCheckbox from '$lib/client/ui/form/IconCheckbox.svelte';
	import InfoModal from '$lib/client/ui/modal/InfoModal.svelte';
	import Button from '$lib/client/ui/button/Button.svelte';

	export let checked: boolean = false;
	export let disabled: boolean = false;
	export let label: string = '';
	export let ariaLabel: string = 'Toggle';
	// Legacy color prop (mapped to IconCheckbox color)
	export let color: 'accent' | 'amber' | 'green' | 'red' | 'neutral' = 'accent';
	// IconCheckbox passthrough props
	export let icon: ComponentType = Check;
	export let checkboxColor:
		| 'accent'
		| 'blue'
		| 'green'
		| 'red'
		| 'neutral'
		| `#${string}`
		| `var(--${string})`
		| '' = '';
	export let shape: 'square' | 'circle' | 'rounded' = 'circle';
	export let variant: 'filled' | 'outline' = 'filled';
	export let iconColor: string = '';
	export let fullWidth: boolean = false;
	export let infoHeader: string = '';
	export let infoBody: string = '';

	const dispatch = createEventDispatcher<{ change: boolean; checked: boolean }>();

	let showInfoModal = false;

	$: resolvedLabel = label || ariaLabel;
	$: resolvedCheckboxColor = checkboxColor ? checkboxColor : color === 'amber' ? '#F59E0B' : color;
	$: hasInfo = infoHeader.trim() !== '' || infoBody.trim() !== '';

	function handleToggle() {
		if (disabled) return;
		checked = !checked;
		dispatch('checked', checked);
		dispatch('change', checked);
	}

	function handleInfoClick(event: MouseEvent) {
		event.stopPropagation();
		showInfoModal = true;
	}
</script>

<div
	role="switch"
	aria-checked={checked}
	aria-label={resolvedLabel}
	aria-disabled={disabled}
	tabindex={disabled ? undefined : 0}
	on:click={handleToggle}
	on:keydown={(event) => {
		if (disabled) return;
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleToggle();
		}
	}}
	class="flex {fullWidth
		? 'w-full justify-between'
		: 'w-fit'} items-center gap-3 rounded-control border border-border bg-surface px-3 py-2 text-sm text-text-soft shadow-control transition-colors {disabled
		? 'cursor-not-allowed opacity-50'
		: 'cursor-pointer hover:bg-surface-hover'}"
>
	<div class="flex min-w-0 items-center gap-2">
		{#if label}
			<span class="min-w-0">{label}</span>
		{/if}
		{#if hasInfo}
			<Button
				icon={Info}
				variant="secondary"
				size="xs"
				ariaLabel="More information about {resolvedLabel}"
				on:click={handleInfoClick}
			/>
		{/if}
	</div>
	<IconCheckbox
		{checked}
		{icon}
		color={resolvedCheckboxColor || 'accent'}
		{shape}
		{variant}
		{iconColor}
		{disabled}
		stopPropagation
		on:click={handleToggle}
	/>
</div>

{#if hasInfo}
	<InfoModal bind:open={showInfoModal} header={infoHeader || resolvedLabel}>
		<p class="text-sm leading-6 text-text-soft">{infoBody}</p>
	</InfoModal>
{/if}
