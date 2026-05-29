<script lang="ts">
	import { Bug, Orbit, Lightbulb } from 'lucide-svelte';
	import { fly } from 'svelte/transition';

	export let variant: 'fab' | 'navbar' = 'fab';
	export let open = false;
	export let onToggle: () => void;
	export let onClose: () => void;

	const quips = [
		'Dig for fire. Or just click the button.',
		'Is it weird? Is it working? I can never tell.',
		'All over the world, instances are syncing.',
		'The happening is happening.',
		'Stormy weather in your sync logs.',
		'Blown away by your configuration choices.',
		'I was down in the well when you called.',
		'Havalina, havalina... sorry, what did you need?',
		"Rock music won't fix your quality profiles. But I might.",
		"Cecilia Ann isn't here right now. Can I help instead?",
		'I came from the planet of sound.',
		"Something's happening and it involves your custom formats.",
		'Transmitting from somewhere in space.',
		"There's a planet of sound and you're on it.",
		"Ana, don't you know? Your profiles need attention.",
		'Riding a wave of quality definitions.',
		'If man is five, then your config is six.',
		"This ain't no holiday. Your sync is failing.",
		'Where is my mind? Checking your quality profiles.',
		'Here comes your man. With the bug report.'
	];

	let quip = '';
	$: if (open) quip = quips[Math.floor(Math.random() * quips.length)];

	$: isFab = variant === 'fab';
</script>

{#if open}
	<div
		transition:fly={{ y: isFab ? 8 : -8, duration: 200 }}
		class="planet-popup absolute min-w-56 {isFab
			? 'right-0 bottom-full mb-5'
			: 'top-full right-0 mt-3'}"
	>
		<div
			class="planet-popup-inner rounded-xl border border-[rgb(140_70_60_/_0.3)] bg-[#1e1418]/95 backdrop-blur-sm"
		>
			{#if !isFab}
				<div class="border-b border-[rgb(140_70_60_/_0.18)] px-4 py-2.5">
					<p class="planet-quip text-xs italic text-[#e63a1e]/70">{quip}</p>
				</div>
			{/if}
			<a
				href="https://github.com/Dictionarry-Hub/profilarr/issues/new?template=bug.yml"
				target="_blank"
				rel="noopener noreferrer"
				class="flex w-full items-center gap-3 border-b border-[rgb(140_70_60_/_0.18)] px-4 py-2.5 text-left text-[#ede4da] transition-colors hover:bg-[rgb(140_70_60_/_0.08)] hover:text-[#e63a1e]"
				on:click={onClose}
			>
				<Bug size={16} />
				<span class="text-sm">Report a Bug</span>
			</a>
			<a
				href="https://github.com/Dictionarry-Hub/profilarr/issues/new?template=feature.yml"
				target="_blank"
				rel="noopener noreferrer"
				class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[#ede4da] transition-colors hover:bg-[rgb(140_70_60_/_0.08)] hover:text-[#e63a1e]"
				on:click={onClose}
			>
				<Lightbulb size={16} />
				<span class="text-sm">Request a Feature</span>
			</a>
			{#if isFab}
				<div class="border-t border-[rgb(140_70_60_/_0.18)] px-4 py-2.5">
					<p class="planet-quip text-xs italic text-[#e63a1e]/70">{quip}</p>
				</div>
			{/if}
		</div>
	</div>
{/if}

{#if isFab}
	<!-- The red planet -->
	<div
		class="planet-fab cursor-pointer"
		on:click={onToggle}
		role="button"
		tabindex="0"
		aria-label="Help"
	>
		<!-- The warm ambient glow cast by the planet -->
		<div class="planet-aura" class:planet-active={open}></div>
		<!-- The planet surface -->
		<div class="planet-body" class:planet-active={open}>
			<div class="planet-icon" class:planet-active={open}>
				<Orbit size={22} strokeWidth={1.5} />
			</div>
		</div>
		<!-- Surface highlight: light catching the upper atmosphere -->
		<div class="planet-shine"></div>
	</div>
{:else}
	<button
		class="planet-nav flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[rgb(140_70_60_/_0.3)] bg-transparent text-[#e63a1e]/60 transition-all hover:text-[#e63a1e] hover:shadow-[0_0_10px_rgb(212_68_42_/_0.15)]"
		on:click={onToggle}
		aria-label="Help"
	>
		<Orbit class="h-[18px] w-[18px]" />
	</button>
{/if}

<style>
	/* ===== The Red Planet ===== */

	.planet-fab {
		position: relative;
		width: 48px;
		height: 48px;
	}

	/* Ambient glow: the planet's light bleeding into the void */
	.planet-aura {
		position: absolute;
		inset: -6px;
		border-radius: 50%;
		background: radial-gradient(
			circle at center,
			rgb(230 58 30 / 0.2) 0%,
			rgb(230 58 30 / 0.08) 40%,
			transparent 70%
		);
		animation: planet-pulse 6s ease-in-out infinite;
		transition: opacity 0.3s;
	}

	.planet-aura.planet-active {
		animation:
			planet-pulse 6s ease-in-out infinite,
			planet-flare 0.5s ease-out;
	}

	.planet-fab:hover .planet-aura {
		opacity: 1.3;
	}

	/* The planet itself */
	.planet-body {
		position: absolute;
		inset: 2px;
		border-radius: 50%;
		background: radial-gradient(
			ellipse at 35% 30%,
			#f04e30 0%,
			#e63a1e 30%,
			#b82c16 60%,
			#8a2010 100%
		);
		box-shadow:
			inset 0 -4px 8px rgb(0 0 0 / 0.3),
			inset 0 2px 4px rgb(255 200 180 / 0.15),
			0 2px 8px rgb(230 58 30 / 0.3),
			0 0 20px rgb(230 58 30 / 0.15);
		transition:
			box-shadow 0.3s,
			transform 0.3s;
	}

	.planet-fab:hover .planet-body {
		box-shadow:
			inset 0 -4px 8px rgb(0 0 0 / 0.3),
			inset 0 2px 4px rgb(255 200 180 / 0.15),
			0 2px 12px rgb(230 58 30 / 0.4),
			0 0 30px rgb(230 58 30 / 0.2);
		transform: scale(1.04);
	}

	.planet-body.planet-active {
		box-shadow:
			inset 0 -4px 8px rgb(0 0 0 / 0.3),
			inset 0 2px 4px rgb(255 200 180 / 0.15),
			0 2px 12px rgb(230 58 30 / 0.4),
			0 0 30px rgb(230 58 30 / 0.2);
	}

	/* The orbit icon */
	.planet-icon {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: rgb(255 220 200 / 0.7);
		filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.3));
		animation: planet-orbit 20s linear infinite;
		transition: color 0.3s;
	}

	.planet-fab:hover .planet-icon {
		color: rgb(255 230 210 / 0.9);
	}

	.planet-icon.planet-active {
		color: rgb(255 230 210 / 0.9);
		animation:
			planet-orbit 20s linear infinite,
			planet-spin 0.6s ease-out;
	}

	/* Atmospheric highlight: light on the upper limb */
	.planet-shine {
		position: absolute;
		top: 6px;
		left: 10px;
		width: 14px;
		height: 8px;
		border-radius: 50%;
		background: radial-gradient(ellipse at center, rgb(255 220 190 / 0.25) 0%, transparent 70%);
		pointer-events: none;
	}

	/* ===== Popup ===== */

	.planet-popup {
		filter: drop-shadow(0 4px 16px rgb(18 12 14 / 0.5)) drop-shadow(0 0 6px rgb(230 58 30 / 0.06));
	}

	.planet-popup-inner {
		position: relative;
		overflow: hidden;
	}

	.planet-quip {
		animation: signal-fade 5s ease-in-out infinite;
	}

	/* ===== Keyframes ===== */

	/* Slow warm pulse: the planet radiating heat */
	@keyframes planet-pulse {
		0%,
		100% {
			opacity: 0.7;
			transform: scale(1);
		}
		50% {
			opacity: 1;
			transform: scale(1.06);
		}
	}

	/* Flare on click: a burst of warmth */
	@keyframes planet-flare {
		0% {
			opacity: 0.7;
			transform: scale(1);
		}
		30% {
			opacity: 1.5;
			transform: scale(1.25);
		}
		100% {
			opacity: 1;
			transform: scale(1.06);
		}
	}

	/* The orbit icon slowly rotating */
	@keyframes planet-orbit {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	/* Faster spin on interact */
	@keyframes planet-spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(180deg);
		}
	}

	/* Quip text: radio signal fading in and out */
	@keyframes signal-fade {
		0%,
		100% {
			opacity: 0.6;
		}
		30% {
			opacity: 0.9;
		}
		60% {
			opacity: 0.7;
		}
	}
</style>
