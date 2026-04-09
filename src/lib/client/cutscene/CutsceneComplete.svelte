<script lang="ts">
	import { goto } from '$app/navigation';
	import { cutscene } from './store';
	import Modal from '$ui/modal/Modal.svelte';
	import Button from '$ui/button/Button.svelte';
	import { X, ArrowRight, Bird } from 'lucide-svelte';

	const { justCompleted } = cutscene;

	const quips = [
		'ANOTHER ONE?',
		"We're done already? That was painless. For you.",
		'Look at you go. A natural.',
		"Great, you finished. I'm billing you for overtime.",
		"That wasn't so bad, was it? Don't answer that.",
		'Achievement unlocked: tolerated a parrot.',
		"Congrats. I'll add it to your resume.",
		'One down. Only... several more to go.',
		"Alright, what's next? I was just getting comfortable.",
		"If you click 'Back to Onboarding' I swear..."
	];

	let quip = quips[0];

	$: if ($justCompleted) {
		quip = quips[Math.floor(Math.random() * quips.length)];
	}

	$: open = $justCompleted;

	function goToOnboarding(): void {
		cutscene.dismissCompleted();
		goto('/onboarding');
	}

	function close(): void {
		cutscene.dismissCompleted();
	}
</script>

<Modal {open} header="Stage Complete" size="sm" on:cancel={close} on:confirm={goToOnboarding}>
	<div slot="body">
		<div class="mb-4 flex justify-center text-4xl">
			<span class="nav-icon-emoji">🦜</span>
			<span class="nav-icon-lucide"
				><Bird size={36} class="-scale-x-100 text-neutral-700 dark:text-neutral-200" /></span
			>
		</div>
		<p class="text-center text-sm text-neutral-500 italic dark:text-neutral-400">
			{quip}
		</p>
	</div>
	<div slot="footer" class="flex w-full justify-between">
		<Button text="I'm done" icon={X} on:click={close} />
		<Button
			text="Back to Onboarding"
			icon={ArrowRight}
			variant="primary"
			on:click={goToOnboarding}
		/>
	</div>
</Modal>
