<script lang="ts">
	import { cutscene } from './store';
	import Modal from '$ui/modal/Modal.svelte';
	import Button from '$ui/button/Button.svelte';
	import { Sparkles, X } from 'lucide-svelte';

	const { onboardingShown } = cutscene;

	$: state = $cutscene;
	$: shown = $onboardingShown;
	$: open = !shown && !state.active;

	function start(): void {
		cutscene.dismiss();
		cutscene.startPipeline('getting-started', false);
	}

	function skip(): void {
		cutscene.dismiss();
	}
</script>

<Modal {open} header="Welcome to Profilarr!" size="md" on:cancel={skip} on:confirm={start}>
	<div slot="body">
		<div class="mb-4 text-center text-4xl">
			<span class="nav-icon-emoji">🦜</span>
			<span class="nav-icon-lucide">👋</span>
		</div>
		<p class="text-center text-sm text-neutral-600 dark:text-neutral-400">
			Want a quick guided tour? A very patient parrot will show you the basics.
		</p>
	</div>
	<div slot="footer" class="flex w-full justify-between">
		<Button text="I'll figure it out myself" icon={X} on:click={skip} />
		<Button text="Show me around!" icon={Sparkles} variant="primary" on:click={start} />
	</div>
</Modal>
