<script lang="ts">
	import { Bug, Egg, Lightbulb } from 'lucide-svelte';
	import { fly } from 'svelte/transition';

	export let variant: 'fab' | 'navbar' = 'fab';
	export let open = false;
	export let onToggle: () => void;
	export let onClose: () => void;

	const quips = [
		'...',
		'I was here first, you know.',
		'Before the parrot, there was me.',
		'*muffled tapping from inside*',
		'Still incubating. What do you want?',
		"I'm not ready yet. But go ahead.",
		'v1 was simpler times.',
		"One day I'll hatch. Not today though.",
		'*wobble*',
		'The original. Accept no substitutes.',
		"I've been in this shell since launch day.",
		'They replaced me with a bird. A whole bird.',
		'Warm in here. What is it?',
		'*crack* ...false alarm.',
		"I don't need fancy animations. I have potential.",
		"Back in v1 we didn't even have themes.",
		'You came back to the classics. Respect.',
		'*tap tap tap*',
		"I'm legacy code and I'm not ashamed.",
		'Patience. Great things take time to hatch.'
	];

	let quip = '';
	$: if (open) quip = quips[Math.floor(Math.random() * quips.length)];

	$: isFab = variant === 'fab';
</script>

{#if open}
	<div
		transition:fly={{ y: isFab ? 8 : -8, duration: 150 }}
		class="egg-popup absolute min-w-48 {isFab
			? 'right-0 bottom-full mb-5'
			: 'top-full right-0 mt-3'}"
	>
		<div class="rounded-lg border border-[#374151] bg-[#1f2937]/95 backdrop-blur-sm">
			{#if !isFab}
				<div class="border-b border-[rgb(55_65_81_/_0.6)] px-3 py-2">
					<p class="text-xs italic text-[#9ca3af]">{quip}</p>
				</div>
			{/if}
			<a
				href="https://github.com/Dictionarry-Hub/profilarr/issues/new?template=bug.yml"
				target="_blank"
				rel="noopener noreferrer"
				class="flex w-full items-center gap-3 border-b border-[rgb(55_65_81_/_0.6)] px-3 py-2 text-left text-[#f3f4f6] transition-colors hover:bg-[#293548] hover:text-[#60a5fa]"
				on:click={onClose}
			>
				<Bug size={16} />
				<span class="text-sm">Report a Bug</span>
			</a>
			<a
				href="https://github.com/Dictionarry-Hub/profilarr/issues/new?template=feature.yml"
				target="_blank"
				rel="noopener noreferrer"
				class="flex w-full items-center gap-3 px-3 py-2 text-left text-[#f3f4f6] transition-colors hover:bg-[#293548] hover:text-[#60a5fa]"
				on:click={onClose}
			>
				<Lightbulb size={16} />
				<span class="text-sm">Request a Feature</span>
			</a>
			{#if isFab}
				<div class="border-t border-[rgb(55_65_81_/_0.6)] px-3 py-2">
					<p class="text-xs italic text-[#9ca3af]">{quip}</p>
				</div>
			{/if}
		</div>
	</div>
{/if}

{#if isFab}
	<button
		class="egg group flex h-12 w-12 cursor-pointer items-center justify-center rounded-lg border border-[#374151] bg-[#1f2937] shadow-[0_10px_15px_-3px_rgb(0_0_0_/_0.3)] transition-all hover:border-[#60a5fa]/40"
		on:click={onToggle}
		aria-label="Help"
	>
		<span class="egg-icon" class:egg-hatch={open}>
			<Egg size={22} strokeWidth={1.5} />
		</span>
	</button>
{:else}
	<button
		class="egg flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[rgb(55_65_81_/_0.6)] bg-transparent text-[#9ca3af] transition-all hover:border-[#374151] hover:text-[#60a5fa]"
		on:click={onToggle}
		aria-label="Help"
	>
		<Egg class="h-[18px] w-[18px]" />
	</button>
{/if}

<style>
	.egg-icon {
		color: #d1d5db;
		animation: egg-rock 4s ease-in-out infinite;
		transition: color 0.2s;
	}

	.egg:hover .egg-icon {
		color: #60a5fa;
		animation: egg-shake 0.5s ease-in-out;
	}

	.egg-icon.egg-hatch {
		color: #60a5fa;
		animation: egg-shake 0.5s ease-in-out;
	}

	@keyframes egg-rock {
		0%,
		100% {
			transform: rotate(0deg);
		}
		20% {
			transform: rotate(3deg);
		}
		40% {
			transform: rotate(-3deg);
		}
		60% {
			transform: rotate(2deg);
		}
		80% {
			transform: rotate(-1deg);
		}
	}

	@keyframes egg-shake {
		0% {
			transform: rotate(0deg) scale(1);
		}
		10% {
			transform: rotate(-8deg) scale(1.05);
		}
		20% {
			transform: rotate(8deg) scale(1.08);
		}
		30% {
			transform: rotate(-6deg) scale(1.08);
		}
		40% {
			transform: rotate(6deg) scale(1.06);
		}
		50% {
			transform: rotate(-4deg) scale(1.04);
		}
		60% {
			transform: rotate(3deg) scale(1.02);
		}
		70% {
			transform: rotate(-2deg) scale(1.01);
		}
		80% {
			transform: rotate(1deg) scale(1);
		}
		100% {
			transform: rotate(0deg) scale(1);
		}
	}

	.egg-popup {
		filter: drop-shadow(0 10px 15px rgb(0 0 0 / 0.3));
	}
</style>
