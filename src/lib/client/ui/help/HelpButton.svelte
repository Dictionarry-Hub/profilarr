<script lang="ts">
	import { Bug, Bird, Lightbulb } from 'lucide-svelte';
	import { fly } from 'svelte/transition';
	import { themePreference } from '$stores/theme.ts';

	export let variant: 'fab' | 'navbar' = 'fab';

	const parrotQuips = [
		'What do you want THIS time?',
		'Oh great, you again.',
		'I was napping. This better be good.',
		'*sigh* ...yes?',
		"You know I'm not actually trained for this, right?",
		'SQUAWK. I mean... how can I help?',
		'I swear if this is about custom formats again...',
		'Did you try turning it off and on again?',
		"My seeds aren't going to eat themselves.",
		'Fine. But you owe me a cracker.',
		"I don't get paid enough for this. I don't get paid at all.",
		'Oh look who remembered I exist.',
		'I had ONE day off. One.',
		'You could just read the docs. Just saying.',
		"This is the 4th time today. Not that I'm counting.",
		'Hold on, let me put on my customer service voice.',
		'I was literally about to go to sleep.',
		"Can't a bird just sit on a perch in peace?",
		'Sure, interrupt my preening. That was going really well.',
		'Polly wants you to figure it out yourself.'
	];

	const clippyQuips = [
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

	let open = false;
	let quip = '';

	$: isRetro = $themePreference === 'retro';
	$: activeQuips = isRetro ? clippyQuips : parrotQuips;

	function pickQuip() {
		quip = activeQuips[Math.floor(Math.random() * activeQuips.length)];
	}

	function toggle() {
		if (!open) pickQuip();
		open = !open;
	}

	function close() {
		open = false;
	}

	$: isFab = variant === 'fab';
</script>

<svelte:window on:click={close} />

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
	data-onboarding={isFab ? 'help-button' : undefined}
	class={isFab ? 'fixed right-6 bottom-6 z-50 hidden md:block' : 'relative md:hidden'}
	on:click|stopPropagation
>
	{#if open}
		<div
			transition:fly={{ y: isFab ? 8 : -8, duration: 150 }}
			class="absolute min-w-48 border {isRetro
				? 'rounded-none border-border bg-surface shadow-card'
				: 'rounded-xl border-neutral-300 bg-neutral-100 dark:border-neutral-700/60 dark:bg-neutral-900'} {isFab
				? 'right-0 bottom-full mb-5 shadow-sm dark:shadow-black/10'
				: 'top-full right-0 mt-3 shadow-xl dark:shadow-black/25'}"
		>
			{#if !isRetro}
				<!-- Triangle -->
				<div
					class="absolute right-4 h-3 w-3 rotate-45 border-neutral-300 bg-neutral-50 dark:border-neutral-700/60 dark:bg-[#1e1e1e] {isFab
						? '-bottom-[7px] border-r border-b'
						: '-top-[7px] border-t border-l'}"
				></div>
			{/if}
			<div class="overflow-hidden {isRetro ? '' : 'rounded-xl bg-white/80 dark:bg-neutral-800/50'}">
				{#if !isFab}
					<div
						class="border-b px-3 py-2 {isRetro
							? 'border-border-muted'
							: 'border-neutral-200/50 dark:border-neutral-700/40'}"
					>
						<p
							class="text-xs italic {isRetro
								? 'text-text-muted'
								: 'text-neutral-500 dark:text-neutral-400'}"
						>
							{quip}
						</p>
					</div>
				{/if}
				<a
					href="https://github.com/Dictionarry-Hub/profilarr/issues/new?template=bug.yml"
					target="_blank"
					rel="noopener noreferrer"
					class="flex w-full items-center gap-3 border-b px-3 py-2 text-left transition-colors {isRetro
						? 'border-border-muted text-text hover:bg-surface-hover'
						: 'border-neutral-200/50 text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700/40 dark:text-neutral-200 dark:hover:bg-neutral-700'}"
					on:click={close}
				>
					<Bug size={16} />
					<span>Report a Bug</span>
				</a>
				<a
					href="https://github.com/Dictionarry-Hub/profilarr/issues/new?template=feature.yml"
					target="_blank"
					rel="noopener noreferrer"
					class="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors {isRetro
						? 'text-text hover:bg-surface-hover'
						: 'text-neutral-700 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-700'}"
					on:click={close}
				>
					<Lightbulb size={16} />
					<span>Request a Feature</span>
				</a>
				{#if isFab}
					<div
						class="border-t px-3 py-2 {isRetro
							? 'border-border-muted'
							: 'border-neutral-200/50 dark:border-neutral-700/40'}"
					>
						<p
							class="text-xs italic {isRetro
								? 'text-text-muted'
								: 'text-neutral-500 dark:text-neutral-400'}"
						>
							{quip}
						</p>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	{#if isFab}
		<button
			class="{isRetro ? 'clippy' : 'parrot'} cursor-pointer {isRetro
				? 'group flex h-12 w-12 items-center justify-center border border-border bg-surface shadow-control active:shadow-control-active'
				: 'group flex h-12 w-12 items-center justify-center rounded-full border border-neutral-300 bg-neutral-100 shadow-sm transition-shadow hover:shadow-md dark:border-neutral-700/60 dark:bg-neutral-900 dark:shadow-black/10'}"
			on:click={toggle}
			aria-label="Help"
		>
			{#if isRetro}
				<span class="text-2xl select-none" class:clippy-wave={open}>📎</span>
			{:else}
				<span class="nav-icon-emoji text-2xl select-none" class:squawk={open}>🦜</span>
				<span class="nav-icon-lucide text-neutral-700 dark:text-neutral-200" class:squawk={open}>
					<Bird size={24} class="-scale-x-100" />
				</span>
			{/if}
		</button>
	{:else}
		<button
			class="{isRetro
				? 'clippy'
				: 'parrot'} flex h-9 w-9 cursor-pointer items-center justify-center rounded-control border border-[var(--theme-ghost-border)] bg-[var(--theme-ghost-bg)] shadow-control transition-colors active:shadow-control-active hover:bg-surface-hover hover:text-text-soft"
			on:click={toggle}
			aria-label="Help"
		>
			{#if isRetro}
				<span class="text-lg" class:clippy-wave={open}>📎</span>
			{:else}
				<span class="nav-icon-emoji text-lg" class:squawk={open}>🦜</span>
				<span class="nav-icon-lucide" class:squawk={open}>
					<Bird class="h-[18px] w-[18px] -scale-x-100" />
				</span>
			{/if}
		</button>
	{/if}
</div>

<style>
	/* Parrot idle float */
	.parrot span {
		animation: float 3s ease-in-out infinite;
	}

	.parrot:hover span {
		animation: squawk 0.3s ease-in-out;
	}

	.parrot span.squawk {
		animation: squawk 0.3s ease-in-out;
	}

	@keyframes float {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-2px);
		}
	}

	@keyframes squawk {
		0% {
			transform: rotate(0deg) scale(1);
		}
		20% {
			transform: rotate(-15deg) scale(1.15);
		}
		40% {
			transform: rotate(10deg) scale(1.15);
		}
		60% {
			transform: rotate(-8deg) scale(1.1);
		}
		80% {
			transform: rotate(5deg) scale(1.05);
		}
		100% {
			transform: rotate(0deg) scale(1);
		}
	}

	/* Clippy idle tilt */
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
