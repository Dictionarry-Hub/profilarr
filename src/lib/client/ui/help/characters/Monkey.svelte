<script lang="ts">
	import { Bug, Lightbulb } from 'lucide-svelte';
	import { fly } from 'svelte/transition';

	export let variant: 'fab' | 'navbar' = 'fab';
	export let open = false;
	export let onToggle: () => void;
	export let onClose: () => void;

	const quips = [
		"This monkey's gone to heaven. But I'm still here.",
		'If man is five and the devil is six, then God is seven.',
		'Got me a movie. I want you to know.',
		'Slicing up eyeballs. And your quality profiles.',
		"Tame? I've never been tame.",
		'Wave of mutilation in your sync logs.',
		'I bleed. Mostly when the configs break.',
		'Here comes your man. With the documentation.',
		'Mr. Grieves, your sync has failed.',
		'Crackity Jones says fix your formats.',
		'La la love you. And your quality profiles.',
		'There goes my gun. And your unsaved changes.',
		'Hey. Been trying to sync. No way to get through.',
		'Number 13, baby. Your configs are cursed.',
		'Gouge away. You can gouge away.',
		'Rock me, Joe. But first, check your formats.',
		'Dead. Like your last sync attempt.',
		'I was swimming in the Caribbean...',
		"Un chien andalou. That's me.",
		'This monkey knows your config better than you do.'
	];

	let quip = '';
	$: if (open) quip = quips[Math.floor(Math.random() * quips.length)];

	$: isFab = variant === 'fab';
</script>

{#if open}
	<div
		transition:fly={{ y: isFab ? 8 : -8, duration: 200 }}
		class="monkey-popup absolute min-w-56 {isFab
			? 'right-0 bottom-full mb-5'
			: 'top-full right-0 mt-3'}"
	>
		<div
			class="monkey-popup-inner rounded-lg border border-[#3a3028] bg-[#1c1714]/95 backdrop-blur-sm"
		>
			<div class="monkey-accent-line"></div>
			{#if !isFab}
				<div class="border-b border-[#2e261e] px-4 py-2.5">
					<p class="monkey-quip text-xs italic text-[#cc8800]/70">{quip}</p>
				</div>
			{/if}
			<a
				href="https://github.com/Dictionarry-Hub/profilarr/issues/new?template=bug.yml"
				target="_blank"
				rel="noopener noreferrer"
				class="flex w-full items-center gap-3 border-b border-[#2e261e] px-4 py-2.5 text-left text-[#ede4d8] transition-colors hover:bg-[rgb(204_136_0_/_0.06)] hover:text-[#cc8800]"
				on:click={onClose}
			>
				<Bug size={16} />
				<span class="text-sm">Report a Bug</span>
			</a>
			<a
				href="https://github.com/Dictionarry-Hub/profilarr/issues/new?template=feature.yml"
				target="_blank"
				rel="noopener noreferrer"
				class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[#ede4d8] transition-colors hover:bg-[rgb(204_136_0_/_0.06)] hover:text-[#cc8800]"
				on:click={onClose}
			>
				<Lightbulb size={16} />
				<span class="text-sm">Request a Feature</span>
			</a>
			{#if isFab}
				<div class="border-t border-[#2e261e] px-4 py-2.5">
					<p class="monkey-quip text-xs italic text-[#cc8800]/70">{quip}</p>
				</div>
			{/if}
		</div>
	</div>
{/if}

{#if isFab}
	<div
		class="monkey-fab cursor-pointer"
		on:click={onToggle}
		role="button"
		tabindex="0"
		aria-label="Help"
	>
		<!-- Amber glow behind the monkey -->
		<div class="monkey-glow" class:monkey-active={open}></div>
		<!-- The monkey -->
		<div class="monkey-body" class:monkey-active={open}>
			<span class="monkey-emoji" class:monkey-active={open}>🐒</span>
		</div>
	</div>
{:else}
	<button
		class="monkey-nav flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[#3a3028] bg-[#1c1714] transition-all hover:shadow-[0_0_10px_rgb(204_136_0_/_0.15)]"
		on:click={onToggle}
		aria-label="Help"
	>
		<span class="text-base leading-none">🐒</span>
	</button>
{/if}

<style>
	/* ===== The Monkey ===== */

	.monkey-fab {
		position: relative;
		width: 48px;
		height: 48px;
	}

	/* Warm amber glow: tube amp haze */
	.monkey-glow {
		position: absolute;
		inset: -4px;
		border-radius: 50%;
		background: radial-gradient(
			circle at center,
			rgb(204 136 0 / 0.15) 0%,
			rgb(204 136 0 / 0.06) 40%,
			transparent 70%
		);
		animation: monkey-pulse 5s ease-in-out infinite;
		transition: opacity 0.3s;
	}

	.monkey-glow.monkey-active {
		animation:
			monkey-pulse 5s ease-in-out infinite,
			monkey-flash 0.4s ease-out;
	}

	.monkey-fab:hover .monkey-glow {
		opacity: 1.3;
	}

	/* The monkey's perch: dark brown circle */
	.monkey-body {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		background: radial-gradient(ellipse at 40% 35%, #2e261e 0%, #1c1714 60%, #110e0c 100%);
		border: 1.5px solid #3a3028;
		box-shadow:
			inset 0 -3px 6px rgb(0 0 0 / 0.3),
			inset 0 1px 3px rgb(204 136 0 / 0.06),
			0 2px 8px rgb(0 0 0 / 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			box-shadow 0.3s,
			transform 0.3s;
	}

	.monkey-fab:hover .monkey-body {
		box-shadow:
			inset 0 -3px 6px rgb(0 0 0 / 0.3),
			inset 0 1px 3px rgb(204 136 0 / 0.06),
			0 2px 12px rgb(0 0 0 / 0.4),
			0 0 16px rgb(204 136 0 / 0.1);
		transform: scale(1.04);
	}

	.monkey-body.monkey-active {
		box-shadow:
			inset 0 -3px 6px rgb(0 0 0 / 0.3),
			inset 0 1px 3px rgb(204 136 0 / 0.06),
			0 2px 12px rgb(0 0 0 / 0.4),
			0 0 16px rgb(204 136 0 / 0.1);
	}

	/* The emoji */
	.monkey-emoji {
		font-size: 22px;
		line-height: 1;
		animation: monkey-swing 3s ease-in-out infinite;
		transition: transform 0.3s;
		filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.3));
	}

	.monkey-emoji.monkey-active {
		animation:
			monkey-swing 3s ease-in-out infinite,
			monkey-jump 0.5s ease-out;
	}

	/* ===== Popup ===== */

	.monkey-popup {
		filter: drop-shadow(0 4px 16px rgb(0 0 0 / 0.5)) drop-shadow(0 0 4px rgb(204 136 0 / 0.04));
	}

	.monkey-popup-inner {
		position: relative;
		overflow: hidden;
	}

	/* Thin amber line: VU meter */
	.monkey-accent-line {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 2px;
		background: linear-gradient(90deg, transparent 0%, #cc8800 20%, #cc8800 80%, transparent 100%);
		opacity: 0.4;
		border-radius: 2px 2px 0 0;
	}

	.monkey-quip {
		font-style: italic;
		letter-spacing: 0.01em;
	}

	/* ===== Keyframes ===== */

	/* Gentle sway: monkey on a branch */
	@keyframes monkey-swing {
		0%,
		100% {
			transform: rotate(0deg);
		}
		25% {
			transform: rotate(-5deg);
		}
		75% {
			transform: rotate(5deg);
		}
	}

	/* Ambient warmth pulse */
	@keyframes monkey-pulse {
		0%,
		100% {
			opacity: 0.6;
			transform: scale(1);
		}
		50% {
			opacity: 1;
			transform: scale(1.04);
		}
	}

	/* Excited jump on click */
	@keyframes monkey-jump {
		0% {
			transform: translateY(0) rotate(0deg);
		}
		20% {
			transform: translateY(-6px) rotate(-8deg);
		}
		40% {
			transform: translateY(-2px) rotate(4deg);
		}
		60% {
			transform: translateY(-4px) rotate(-3deg);
		}
		100% {
			transform: translateY(0) rotate(0deg);
		}
	}

	/* Flash on open */
	@keyframes monkey-flash {
		0% {
			opacity: 0.6;
			transform: scale(1);
		}
		30% {
			opacity: 1.5;
			transform: scale(1.2);
		}
		100% {
			opacity: 1;
			transform: scale(1.04);
		}
	}
</style>
