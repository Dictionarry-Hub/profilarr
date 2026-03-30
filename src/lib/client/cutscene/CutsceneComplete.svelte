<script lang="ts">
	import { goto } from '$app/navigation';
	import { cutscene } from './store';
	import Modal from '$ui/modal/Modal.svelte';
	import Button from '$ui/button/Button.svelte';
	import { X, ArrowRight } from 'lucide-svelte';

	const { justCompleted } = cutscene;

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
		<div class="mb-4 text-center text-4xl">
			<span class="nav-icon-emoji">🦜</span>
			<span class="nav-icon-lucide">👏</span>
		</div>
		<p class="text-center text-sm text-neutral-500 italic dark:text-neutral-400">ANOTHER ONE?</p>
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
