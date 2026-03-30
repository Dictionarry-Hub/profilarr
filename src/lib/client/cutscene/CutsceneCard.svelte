<script lang="ts">
	import { ArrowRight, X } from 'lucide-svelte';
	import Button from '$ui/button/Button.svelte';

	export let title: string;
	export let body: string;
	export let showContinue: boolean = false;
	export let onContinue: (() => void) | undefined = undefined;
	export let onCancel: (() => void) | undefined = undefined;

	const cancelQuips = [
		'Wow. After all that.',
		'Fine. See if I care.',
		'I was just getting into it...',
		"Quitter. I'm not mad, just disappointed.",
		'My time means nothing to you, clearly.'
	];

	$: cancelTooltip = cancelQuips[Math.floor(Math.random() * cancelQuips.length)];
</script>

<div
	class="flex flex-col gap-3 rounded-xl border border-neutral-300 bg-neutral-100 p-4 dark:border-neutral-700/60 dark:bg-neutral-900"
>
	<div>
		<div class="flex items-start justify-between gap-2">
			<h3 class="mb-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
				{title}
			</h3>
			{#if onCancel}
				<Button icon={X} variant="ghost" size="xs" title={cancelTooltip} on:click={onCancel} />
			{/if}
		</div>
		<p class="text-sm text-neutral-600 dark:text-neutral-400">
			{body}
		</p>
	</div>
	{#if showContinue && onContinue}
		<div>
			<Button
				text="Continue"
				icon={ArrowRight}
				iconPosition="right"
				variant="primary"
				size="sm"
				on:click={onContinue}
			/>
		</div>
	{/if}
</div>
