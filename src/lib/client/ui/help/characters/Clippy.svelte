<script lang="ts">
	import { Bug, Lightbulb } from 'lucide-svelte';
	import { fly } from 'svelte/transition';

	export let variant: 'fab' | 'navbar' = 'fab';
	export let open = false;
	export let onToggle: () => void;
	export let onClose: () => void;

	const quips = [
		"It looks like you're trying to configure Radarr. Would you like help?",
		"It looks like you're writing a custom format. Would you like me to just watch?",
		"I see you clicked on me. That's a start.",
		'You look like you could use some help. Or a hug. I can only do one of those.',
		'Did you know? You can close this popup by clicking away. Revolutionary.',
		"I'm way more helpful than that bird, just saying.",
		'Hi! I noticed you exist. Want a tip?',
		"It looks like you're trying to sync. Have you tried... syncing?",
		"I haven't been this relevant since 2003.",
		'Back in my day, we helped people write LETTERS.',
		'Fun fact: I was fired in 2007. This is my comeback tour.',
		"It looks like you're ignoring the documentation. Classic.",
		'I survived Y2K for this.',
		"Would you like to save your work? Just kidding, I can't do that.",
		"It looks like you're having fun. Let me fix that.",
		"Remember me? No? That's fine. I'm fine. Everything is fine.",
		"I've been waiting in this theme for you.",
		'Tip: reading the docs is free. So is clicking away from me.',
		'You seem stressed. Have you tried turning it off and on again?',
		"It looks like you're trying to file a bug. Was it about me?"
	];

	let quip = '';
	$: if (open) quip = quips[Math.floor(Math.random() * quips.length)];

	$: isFab = variant === 'fab';
</script>

{#if open}
	<div
		transition:fly={{ y: isFab ? 8 : -8, duration: 150 }}
		class="absolute min-w-48 rounded-none border border-border bg-surface shadow-card {isFab
			? 'right-0 bottom-full mb-5'
			: 'top-full right-0 mt-3'}"
	>
		<div class="overflow-hidden">
			{#if !isFab}
				<div class="border-b border-border-muted px-3 py-2">
					<p class="text-xs italic text-text-muted">{quip}</p>
				</div>
			{/if}
			<a
				href="https://github.com/Dictionarry-Hub/profilarr/issues/new?template=bug.yml"
				target="_blank"
				rel="noopener noreferrer"
				class="flex w-full items-center gap-3 border-b border-border-muted px-3 py-2 text-left text-text transition-colors hover:bg-surface-hover"
				on:click={onClose}
			>
				<Bug size={16} />
				<span>Report a Bug</span>
			</a>
			<a
				href="https://github.com/Dictionarry-Hub/profilarr/issues/new?template=feature.yml"
				target="_blank"
				rel="noopener noreferrer"
				class="flex w-full items-center gap-3 px-3 py-2 text-left text-text transition-colors hover:bg-surface-hover"
				on:click={onClose}
			>
				<Lightbulb size={16} />
				<span>Request a Feature</span>
			</a>
			{#if isFab}
				<div class="border-t border-border-muted px-3 py-2">
					<p class="text-xs italic text-text-muted">{quip}</p>
				</div>
			{/if}
		</div>
	</div>
{/if}

{#if isFab}
	<button
		class="clippy group flex h-12 w-12 cursor-pointer items-center justify-center border border-border bg-surface shadow-control active:shadow-control-active"
		on:click={onToggle}
		aria-label="Help"
	>
		<span class="text-2xl select-none" class:clippy-wave={open}>📎</span>
	</button>
{:else}
	<button
		class="clippy flex h-9 w-9 cursor-pointer items-center justify-center rounded-control border border-[var(--theme-ghost-border)] bg-[var(--theme-ghost-bg)] shadow-control transition-colors active:shadow-control-active hover:bg-surface-hover hover:text-text-soft"
		on:click={onToggle}
		aria-label="Help"
	>
		<span class="text-lg" class:clippy-wave={open}>📎</span>
	</button>
{/if}

<style>
	.clippy span {
		animation: tilt 4s ease-in-out infinite;
	}

	.clippy:hover span {
		animation: wiggle 0.5s ease-in-out;
	}

	.clippy span.clippy-wave {
		animation: wiggle 0.5s ease-in-out;
	}

	@keyframes tilt {
		0%,
		100% {
			transform: rotate(0deg);
		}
		25% {
			transform: rotate(8deg);
		}
		75% {
			transform: rotate(-8deg);
		}
	}

	@keyframes wiggle {
		0% {
			transform: rotate(0deg) scale(1);
		}
		15% {
			transform: rotate(-12deg) scale(1.1);
		}
		30% {
			transform: rotate(12deg) scale(1.1);
		}
		45% {
			transform: rotate(-8deg) scale(1.05);
		}
		60% {
			transform: rotate(8deg) scale(1.05);
		}
		80% {
			transform: rotate(-3deg) scale(1);
		}
		100% {
			transform: rotate(0deg) scale(1);
		}
	}
</style>
