<script lang="ts">
	import { X } from 'lucide-svelte';
	import Button from '$ui/button/Button.svelte';
	import InlineCode from '$ui/code/InlineCode.svelte';
	import CutsceneProgress from './CutsceneProgress.svelte';

	export let title: string;
	export let body: string;
	export let onBack: (() => void) | undefined = undefined;
	export let onForward: (() => void) | undefined = undefined;
	export let onCancel: (() => void) | undefined = undefined;
	export let showBack: boolean = true;
	export let currentStep: number = 0;
	export let totalSteps: number = 0;

	const cancelQuips = [
		'Wow. After all that.',
		'Fine. See if I care.',
		'I was just getting into it...',
		"Quitter. I'm not mad, just disappointed.",
		'My time means nothing to you, clearly.'
	];

	$: cancelTooltip = cancelQuips[Math.floor(Math.random() * cancelQuips.length)];

	// Split body into segments: even indices are plain text, odd indices are inline code.
	// Backticks without a closing pair stay as literal text.
	$: bodySegments = (() => {
		const parts = body.split('`');
		if (parts.length % 2 === 0) {
			// Unclosed backtick — render the whole body as text.
			return [{ code: false, text: body }];
		}
		return parts.map((text, i) => ({ code: i % 2 === 1, text }));
	})();
</script>

<div
	class="flex flex-col gap-3 rounded-xl border border-neutral-300 bg-neutral-100 p-4 dark:border-neutral-700/60 dark:bg-neutral-900"
>
	<div>
		<div class="flex items-start justify-between gap-2">
			<h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
				{title}
			</h3>
			{#if onCancel}
				<Button icon={X} variant="ghost" size="xs" title={cancelTooltip} on:click={onCancel} />
			{/if}
		</div>
		<p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
			{#each bodySegments as segment}
				{#if segment.code}
					<InlineCode text={segment.text} rounded="sm" />
				{:else}
					{segment.text}
				{/if}
			{/each}
		</p>
	</div>
	<CutsceneProgress {currentStep} {totalSteps} {onBack} {onForward} {showBack} />
</div>
