<script lang="ts">
	import { Bug, Lightbulb } from 'lucide-svelte';
	import { Icon } from 'lucide-svelte';
	import { faceAlien } from '@lucide/lab';
	import { fly } from 'svelte/transition';

	export let variant: 'fab' | 'navbar' = 'fab';
	export let open = false;
	export let onToggle: () => void;
	export let onClose: () => void;

	const quips = [
		'We come in peace. Your configs, however...',
		'The truth is out there. It is in your sync logs.',
		'Subject appears to be configuring quality profiles. Fascinating.',
		"I've been probing your custom formats.",
		'This is not a weather balloon.',
		'Take me to your leader. Or your Radarr instance.',
		'Area 51 had better documentation than this.',
		'Motorway to Roswell. Population: you.',
		"We've been observing your species for some time now.",
		'Do not be alarmed. I am only here to help.',
		'Your signal has been detected across the galaxy.',
		'Interstellar customs require proper format definitions.',
		'I was just passing through your solar system.',
		'Another satisfied Earth customer.',
		'My people have much to teach you about quality profiles.',
		'Greetings, Earth-based configuration entity.',
		'I bring gifts from beyond the stars. And bug reports.',
		"This planet's sound is... adequate.",
		'Your atmosphere is surprisingly hospitable.',
		'Transmitting your sync status to the home world.'
	];

	let quip = '';
	$: if (open) quip = quips[Math.floor(Math.random() * quips.length)];

	$: isFab = variant === 'fab';
</script>

{#if open}
	<div
		transition:fly={{ y: isFab ? 8 : -8, duration: 200 }}
		class="alien-popup absolute min-w-56 {isFab
			? 'right-0 bottom-full mb-5'
			: 'top-full right-0 mt-3'}"
	>
		<div class="alien-popup-inner rounded-lg border border-[#d5cce5] bg-white/98 backdrop-blur-sm">
			<div class="alien-accent-line"></div>
			{#if !isFab}
				<div class="border-b border-[#e3ddef] px-4 py-2.5">
					<p class="alien-quip text-xs italic text-[#6e6088]">{quip}</p>
				</div>
			{/if}
			<a
				href="https://github.com/Dictionarry-Hub/profilarr/issues/new?template=bug.yml"
				target="_blank"
				rel="noopener noreferrer"
				class="flex w-full items-center gap-3 border-b border-[#e3ddef] px-4 py-2.5 text-left text-[#1a1528] transition-colors hover:bg-[#f3f0f9] hover:text-[#7c3aed]"
				on:click={onClose}
			>
				<Bug size={16} />
				<span class="text-sm">Report a Bug</span>
			</a>
			<a
				href="https://github.com/Dictionarry-Hub/profilarr/issues/new?template=feature.yml"
				target="_blank"
				rel="noopener noreferrer"
				class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[#1a1528] transition-colors hover:bg-[#f3f0f9] hover:text-[#7c3aed]"
				on:click={onClose}
			>
				<Lightbulb size={16} />
				<span class="text-sm">Request a Feature</span>
			</a>
			{#if isFab}
				<div class="border-t border-[#e3ddef] px-4 py-2.5">
					<p class="alien-quip text-xs italic text-[#6e6088]">{quip}</p>
				</div>
			{/if}
		</div>
	</div>
{/if}

{#if isFab}
	<!-- The visitor -->
	<div
		class="alien-fab cursor-pointer"
		on:click={onToggle}
		role="button"
		tabindex="0"
		aria-label="Help"
	>
		<!-- Containment field: the violet glow around the visitor -->
		<div class="alien-field" class:alien-active={open}></div>
		<!-- The visitor's form -->
		<div class="alien-body" class:alien-active={open}>
			<div class="alien-icon" class:alien-active={open}>
				<Icon iconNode={faceAlien} size={22} strokeWidth={1.5} />
			</div>
		</div>
		<!-- Specular highlight on the containment dome -->
		<div class="alien-shine"></div>
	</div>
{:else}
	<button
		class="alien-nav flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[#d5cce5] bg-[#f3f0f9] text-[#7c3aed]/60 transition-all hover:text-[#7c3aed] hover:shadow-[0_0_8px_rgb(124_58_237_/_0.2)]"
		on:click={onToggle}
		aria-label="Help"
	>
		<Icon iconNode={faceAlien} class="h-[18px] w-[18px]" />
	</button>
{/if}

<style>
	/* ===== The Visitor ===== */

	.alien-fab {
		position: relative;
		width: 48px;
		height: 48px;
		animation: alien-levitate 4s ease-in-out infinite;
	}

	/* Containment field: violet energy radiating outward */
	.alien-field {
		position: absolute;
		inset: -6px;
		border-radius: 50%;
		background: radial-gradient(
			circle at center,
			rgb(124 58 237 / 0.2) 0%,
			rgb(124 58 237 / 0.08) 40%,
			transparent 70%
		);
		animation: alien-pulse 5s ease-in-out infinite;
		transition: opacity 0.3s;
	}

	.alien-field.alien-active {
		animation:
			alien-pulse 5s ease-in-out infinite,
			alien-beam 0.5s ease-out;
	}

	.alien-fab:hover .alien-field {
		opacity: 1.3;
	}

	/* The visitor's form: a violet-tinted dome */
	.alien-body {
		position: absolute;
		inset: 2px;
		border-radius: 50%;
		background: radial-gradient(
			ellipse at 35% 30%,
			#a78bfa 0%,
			#8b5cf6 25%,
			#7c3aed 50%,
			#6d28d9 80%,
			#5b21b6 100%
		);
		box-shadow:
			inset 0 -4px 8px rgb(0 0 0 / 0.2),
			inset 0 2px 4px rgb(196 181 253 / 0.3),
			0 2px 8px rgb(124 58 237 / 0.3),
			0 0 20px rgb(124 58 237 / 0.12);
		transition:
			box-shadow 0.3s,
			transform 0.3s;
	}

	.alien-fab:hover .alien-body {
		box-shadow:
			inset 0 -4px 8px rgb(0 0 0 / 0.2),
			inset 0 2px 4px rgb(196 181 253 / 0.3),
			0 2px 12px rgb(124 58 237 / 0.4),
			0 0 30px rgb(124 58 237 / 0.18);
		transform: scale(1.04);
	}

	.alien-body.alien-active {
		box-shadow:
			inset 0 -4px 8px rgb(0 0 0 / 0.2),
			inset 0 2px 4px rgb(196 181 253 / 0.3),
			0 2px 12px rgb(124 58 237 / 0.4),
			0 0 30px rgb(124 58 237 / 0.18);
	}

	/* The alien face icon */
	.alien-icon {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: rgb(237 233 254 / 0.8);
		filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.2));
		transition: color 0.3s;
	}

	.alien-fab:hover .alien-icon {
		color: rgb(245 243 255 / 0.95);
	}

	.alien-icon.alien-active {
		color: rgb(245 243 255 / 0.95);
		animation: alien-tilt 0.5s ease-out;
	}

	/* Specular dome highlight */
	.alien-shine {
		position: absolute;
		top: 6px;
		left: 10px;
		width: 14px;
		height: 8px;
		border-radius: 50%;
		background: radial-gradient(ellipse at center, rgb(255 255 255 / 0.35) 0%, transparent 70%);
		pointer-events: none;
	}

	/* ===== Popup ===== */

	.alien-popup {
		filter: drop-shadow(0 1px 3px rgb(26 21 40 / 0.08)) drop-shadow(0 4px 16px rgb(26 21 40 / 0.06));
	}

	.alien-popup-inner {
		position: relative;
		overflow: hidden;
	}

	/* Thin violet line at the top: a frequency band */
	.alien-accent-line {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 2px;
		background: linear-gradient(90deg, transparent 0%, #7c3aed 20%, #7c3aed 80%, transparent 100%);
		opacity: 0.4;
		border-radius: 2px 2px 0 0;
	}

	.alien-quip {
		font-style: italic;
		letter-spacing: 0.01em;
	}

	/* ===== Keyframes ===== */

	/* Gentle hover: the visitor floats */
	@keyframes alien-levitate {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-3px);
		}
	}

	/* Containment field pulsing */
	@keyframes alien-pulse {
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

	/* Beam flash on click */
	@keyframes alien-beam {
		0% {
			opacity: 0.7;
			transform: scale(1);
		}
		30% {
			opacity: 1.5;
			transform: scale(1.3);
		}
		100% {
			opacity: 1;
			transform: scale(1.06);
		}
	}

	/* Head tilt on interact */
	@keyframes alien-tilt {
		0% {
			transform: rotate(0deg);
		}
		30% {
			transform: rotate(-12deg);
		}
		60% {
			transform: rotate(5deg);
		}
		100% {
			transform: rotate(0deg);
		}
	}
</style>
