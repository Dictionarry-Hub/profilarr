<script lang="ts">
	import { Bug, Bird, Lightbulb } from 'lucide-svelte';
	import { fly } from 'svelte/transition';

	export let variant: 'fab' | 'navbar' = 'fab';
	export let open = false;
	export let onToggle: () => void;
	export let onClose: () => void;

	const quips = [
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

	let quip = '';
	$: if (open) quip = quips[Math.floor(Math.random() * quips.length)];

	$: isFab = variant === 'fab';
</script>

{#if open}
	<div
		transition:fly={{ y: isFab ? 8 : -8, duration: 150 }}
		class="absolute min-w-48 rounded-xl border border-neutral-300 bg-neutral-100 dark:border-neutral-700/60 dark:bg-neutral-900 {isFab
			? 'right-0 bottom-full mb-5 shadow-sm dark:shadow-black/10'
			: 'top-full right-0 mt-3 shadow-xl dark:shadow-black/25'}"
	>
		<!-- Triangle -->
		<div
			class="absolute right-4 h-3 w-3 rotate-45 border-neutral-300 bg-neutral-50 dark:border-neutral-700/60 dark:bg-[#1e1e1e] {isFab
				? '-bottom-[7px] border-r border-b'
				: '-top-[7px] border-t border-l'}"
		></div>
		<div class="overflow-hidden rounded-xl bg-white/80 dark:bg-neutral-800/50">
			{#if !isFab}
				<div class="border-b border-neutral-200/50 px-3 py-2 dark:border-neutral-700/40">
					<p class="text-xs italic text-neutral-500 dark:text-neutral-400">{quip}</p>
				</div>
			{/if}
			<a
				href="https://github.com/Dictionarry-Hub/profilarr/issues/new?template=bug.yml"
				target="_blank"
				rel="noopener noreferrer"
				class="flex w-full items-center gap-3 border-b border-neutral-200/50 px-3 py-2 text-left text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700/40 dark:text-neutral-200 dark:hover:bg-neutral-700"
				on:click={onClose}
			>
				<Bug size={16} />
				<span>Report a Bug</span>
			</a>
			<a
				href="https://github.com/Dictionarry-Hub/profilarr/issues/new?template=feature.yml"
				target="_blank"
				rel="noopener noreferrer"
				class="flex w-full items-center gap-3 px-3 py-2 text-left text-neutral-700 transition-colors hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-700"
				on:click={onClose}
			>
				<Lightbulb size={16} />
				<span>Request a Feature</span>
			</a>
			{#if isFab}
				<div class="border-t border-neutral-200/50 px-3 py-2 dark:border-neutral-700/40">
					<p class="text-xs italic text-neutral-500 dark:text-neutral-400">{quip}</p>
				</div>
			{/if}
		</div>
	</div>
{/if}

{#if isFab}
	<button
		class="parrot group flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-neutral-300 bg-neutral-100 shadow-sm transition-shadow hover:shadow-md dark:border-neutral-700/60 dark:bg-neutral-900 dark:shadow-black/10"
		on:click={onToggle}
		aria-label="Help"
	>
		<span class="nav-icon-emoji text-2xl select-none" class:squawk={open}>🦜</span>
		<span class="nav-icon-lucide text-neutral-700 dark:text-neutral-200" class:squawk={open}>
			<Bird size={24} class="-scale-x-100" />
		</span>
	</button>
{:else}
	<button
		class="parrot flex h-9 w-9 cursor-pointer items-center justify-center rounded-control border border-[var(--theme-ghost-border)] bg-[var(--theme-ghost-bg)] shadow-control transition-colors active:shadow-control-active hover:bg-surface-hover hover:text-text-soft"
		on:click={onToggle}
		aria-label="Help"
	>
		<span class="nav-icon-emoji text-lg" class:squawk={open}>🦜</span>
		<span class="nav-icon-lucide" class:squawk={open}>
			<Bird class="h-[18px] w-[18px] -scale-x-100" />
		</span>
	</button>
{/if}

<style>
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
</style>
