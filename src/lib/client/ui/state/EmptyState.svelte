<script lang="ts">
	import { Plus } from 'lucide-svelte';
	import Button from '$ui/button/Button.svelte';

	export let icon: any; // Lucide icon component
	export let title: string;
	export let description: string;
	export let buttonText: string;
	export let buttonHref: string;
	export let buttonIcon: any = Plus; // Default to Plus icon
	export let onboarding: string | undefined = undefined;
</script>

<div class="flex min-h-[calc(100vh-4rem)] items-center justify-center p-8">
	<div class="w-full max-w-md text-center">
		<!-- Icon -->
		<div class="mb-6 flex justify-center">
			<div class="rounded-pill bg-surface-hover p-6">
				<svelte:component this={icon} class="h-12 w-12 text-text-subtle " />
			</div>
		</div>

		<!-- Title -->
		<h1 class="mb-3 text-2xl font-bold text-text">
			{title}
		</h1>

		<!-- Description -->
		<p class="mb-8 text-text-soft">
			{description}
		</p>

		<!-- Action Button -->
		<span data-onboarding={onboarding} class="inline-block">
			<Button text={buttonText} href={buttonHref} icon={buttonIcon} iconColor="text-info-icon " />
		</span>
	</div>
</div>
