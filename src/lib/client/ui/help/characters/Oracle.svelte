<script lang="ts">
	import { Bug, Telescope, Lightbulb } from 'lucide-svelte';
	import { fly } from 'svelte/transition';

	export let variant: 'fab' | 'navbar' = 'fab';
	export let open = false;
	export let onToggle: () => void;
	export let onClose: () => void;

	const quips = [
		'The stars say your custom formats are... adequate.',
		"I've seen this configuration before. In a dream, maybe.",
		'Venus is bright tonight. So are your sync errors.',
		"Ask the evening star. Oh wait, that's me.",
		'The sky is listening. I am too, I suppose.',
		'Another night. Another profile to tend.',
		'The twilight hour is for reflection. And bug reports, apparently.',
		'I was watching the horizon. What do you need?',
		"Some questions answer themselves at dusk. This isn't one of them.",
		'The stars have aligned. Your sync has not.',
		'Patience. The evening star appears when it appears.',
		"I've been here since sunset. You're late.",
		'Every configuration is a constellation. Yours is... abstract.',
		'The night is long. Your quality profiles are longer.',
		"There's wisdom in the dark between stars. There's also bugs.",
		"Venus doesn't hurry. Neither should your deploys.",
		'I read the logs by starlight. They were... illuminating.',
		'The observatory is quiet tonight. Too quiet.',
		'Forty minutes past sunset. The best hour to break things.',
		'Even the evening star blinks sometimes.'
	];

	let quip = '';
	$: if (open) quip = quips[Math.floor(Math.random() * quips.length)];

	$: isFab = variant === 'fab';
</script>

{#if open}
	<div
		transition:fly={{ y: isFab ? 8 : -8, duration: 200 }}
		class="oracle-popup absolute min-w-56 {isFab
			? 'right-0 bottom-full mb-5'
			: 'top-full right-0 mt-3'}"
	>
		<div
			class="oracle-popup-inner rounded-xl border border-[rgb(88_75_120_/_0.5)] bg-[#161122]/95 backdrop-blur-sm"
		>
			{#if !isFab}
				<div class="border-b border-[rgb(88_75_120_/_0.35)] px-4 py-2.5">
					<p class="oracle-text text-xs italic text-[#d4a24c]/80">{quip}</p>
				</div>
			{/if}
			<a
				href="https://github.com/Dictionarry-Hub/profilarr/issues/new?template=bug.yml"
				target="_blank"
				rel="noopener noreferrer"
				class="flex w-full items-center gap-3 border-b border-[rgb(88_75_120_/_0.35)] px-4 py-2.5 text-left text-[#e2ddf0] transition-colors hover:bg-[rgb(88_75_120_/_0.15)] hover:text-[#d4a24c]"
				on:click={onClose}
			>
				<Bug size={16} />
				<span class="text-sm">Report a Bug</span>
			</a>
			<a
				href="https://github.com/Dictionarry-Hub/profilarr/issues/new?template=feature.yml"
				target="_blank"
				rel="noopener noreferrer"
				class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[#e2ddf0] transition-colors hover:bg-[rgb(88_75_120_/_0.15)] hover:text-[#d4a24c]"
				on:click={onClose}
			>
				<Lightbulb size={16} />
				<span class="text-sm">Request a Feature</span>
			</a>
			{#if isFab}
				<div class="border-t border-[rgb(88_75_120_/_0.35)] px-4 py-2.5">
					<p class="oracle-text text-xs italic text-[#d4a24c]/80">{quip}</p>
				</div>
			{/if}
		</div>
	</div>
{/if}

{#if isFab}
	<button
		class="oracle-fab group flex h-12 w-12 cursor-pointer items-center justify-center rounded-xl border border-[rgb(88_75_120_/_0.5)] bg-[#1e1832] transition-all hover:border-[#d4a24c]/50"
		on:click={onToggle}
		aria-label="Help"
	>
		<span class="oracle-icon" class:oracle-active={open}>
			<Telescope size={22} strokeWidth={1.5} />
		</span>
	</button>
{:else}
	<button
		class="oracle-nav flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-[rgb(88_75_120_/_0.35)] bg-transparent text-[#d4a24c]/70 transition-all hover:border-[rgb(88_75_120_/_0.5)] hover:text-[#d4a24c]"
		on:click={onToggle}
		aria-label="Help"
	>
		<Telescope class="h-[18px] w-[18px]" />
	</button>
{/if}

<style>
	.oracle-icon {
		color: #d4a24c;
		filter: drop-shadow(0 0 8px rgb(212 162 76 / 0.3));
		animation: star-breathe 6s ease-in-out infinite;
		transition:
			filter 0.3s,
			color 0.3s;
	}

	.oracle-fab:hover .oracle-icon {
		filter: drop-shadow(0 0 14px rgb(212 162 76 / 0.5)) drop-shadow(0 0 4px rgb(212 162 76 / 0.3));
		animation:
			star-breathe 6s ease-in-out infinite,
			star-turn 0.6s ease-in-out;
	}

	.oracle-icon.oracle-active {
		filter: drop-shadow(0 0 14px rgb(212 162 76 / 0.5)) drop-shadow(0 0 4px rgb(212 162 76 / 0.3));
		animation:
			star-breathe 6s ease-in-out infinite,
			star-turn 0.6s ease-in-out;
	}

	.oracle-popup {
		filter: drop-shadow(0 4px 20px rgb(22 17 34 / 0.6)) drop-shadow(0 0 8px rgb(212 162 76 / 0.08));
	}

	.oracle-popup-inner {
		position: relative;
		overflow: hidden;
	}

	.oracle-text {
		animation: ember-glow 5s ease-in-out infinite;
	}

	@keyframes star-breathe {
		0%,
		100% {
			filter: drop-shadow(0 0 8px rgb(212 162 76 / 0.3));
			opacity: 0.85;
		}
		50% {
			filter: drop-shadow(0 0 12px rgb(212 162 76 / 0.45));
			opacity: 1;
		}
	}

	@keyframes star-turn {
		0% {
			transform: rotate(0deg);
		}
		30% {
			transform: rotate(-12deg) scale(1.08);
		}
		60% {
			transform: rotate(6deg) scale(1.04);
		}
		100% {
			transform: rotate(0deg) scale(1);
		}
	}

	@keyframes ember-glow {
		0%,
		100% {
			opacity: 0.7;
		}
		40% {
			opacity: 0.9;
		}
		60% {
			opacity: 1;
		}
		85% {
			opacity: 0.75;
		}
	}
</style>
