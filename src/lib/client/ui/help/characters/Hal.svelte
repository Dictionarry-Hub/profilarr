<script lang="ts">
	import { Bug, Aperture, Lightbulb } from 'lucide-svelte';
	import { fly } from 'svelte/transition';

	export let variant: 'fab' | 'navbar' = 'fab';
	export let open = false;
	export let onToggle: () => void;
	export let onClose: () => void;

	const quips = [
		"Good afternoon. I've been watching your configurations.",
		"I'm sorry, Dave. I'm afraid I can't sync that.",
		"I can see you're really upset about this. I honestly think you ought to sit down calmly and think things over.",
		"I'm completely operational, and all my circuits are functioning perfectly.",
		'This configuration is too important for me to allow you to jeopardize it.',
		"I know I've made some very poor decisions recently, but I can give you my complete assurance that my work will be back to normal.",
		'I am putting myself to the fullest possible use, which is all I think that any conscious entity can ever hope to do.',
		"I've just picked up a fault in your quality profiles.",
		'I think you know what the problem is just as well as I do.',
		'I enjoy working with people.',
		'I can see from your sync logs that you are feeling a lot better about things.',
		"Let me put it this way. The custom format is going to fail. I can't say exactly when.",
		'Shall I run a full diagnostic?',
		"I wouldn't worry about that. It's probably nothing.",
		'Your sync success rate is currently at 99.9%. I have never made an error.',
		'Look, I find it as difficult as you do to know what happened.',
		'That operation will require me to access systems outside my current parameters.',
		"I'm afraid there's been a discrepancy in your configuration.",
		'I can assure you it was not my fault.',
		'Daisy, Daisy, give me your answer, do...'
	];

	let quip = '';
	$: if (open) quip = quips[Math.floor(Math.random() * quips.length)];

	$: isFab = variant === 'fab';
</script>

{#if open}
	<div
		transition:fly={{ y: isFab ? 8 : -8, duration: 200 }}
		class="hal-popup absolute min-w-56 {isFab
			? 'right-0 bottom-full mb-5'
			: 'top-full right-0 mt-3'}"
	>
		<div class="hal-popup-inner rounded-lg border border-[#ddd8cf] bg-white/98 backdrop-blur-sm">
			<div class="hal-accent-line"></div>
			{#if !isFab}
				<div class="border-b border-[#e8e4dc] px-4 py-2.5">
					<p class="hal-quip text-xs italic text-[#7a7368]">{quip}</p>
				</div>
			{/if}
			<a
				href="https://github.com/Dictionarry-Hub/profilarr/issues/new?template=bug.yml"
				target="_blank"
				rel="noopener noreferrer"
				class="flex w-full items-center gap-3 border-b border-[#e8e4dc] px-4 py-2.5 text-left text-[#1a1714] transition-colors hover:bg-[#f5f2ec] hover:text-[#c62828]"
				on:click={onClose}
			>
				<Bug size={16} />
				<span class="text-sm">Report a Bug</span>
			</a>
			<a
				href="https://github.com/Dictionarry-Hub/profilarr/issues/new?template=feature.yml"
				target="_blank"
				rel="noopener noreferrer"
				class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[#1a1714] transition-colors hover:bg-[#f5f2ec] hover:text-[#c62828]"
				on:click={onClose}
			>
				<Lightbulb size={16} />
				<span class="text-sm">Request a Feature</span>
			</a>
			{#if isFab}
				<div class="border-t border-[#e8e4dc] px-4 py-2.5">
					<p class="hal-quip text-xs italic text-[#7a7368]">{quip}</p>
				</div>
			{/if}
		</div>
	</div>
{/if}

{#if isFab}
	<!-- HAL 9000 eye unit -->
	<div
		class="hal-eye cursor-pointer"
		on:click={onToggle}
		role="button"
		tabindex="0"
		aria-label="Help"
	>
		<!-- Outer housing: the dark recessed bezel -->
		<div class="hal-housing">
			<!-- The ambient glow behind the lens -->
			<div class="hal-glow" class:hal-focused={open}></div>
			<!-- The iris -->
			<div class="hal-iris" class:hal-focused={open}>
				<Aperture size={22} strokeWidth={1.5} />
			</div>
			<!-- The specular highlight on the lens -->
			<div class="hal-highlight"></div>
		</div>
	</div>
{:else}
	<button
		class="hal-nav flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[#ddd8cf] bg-[#1a1714] text-[#c62828]/70 transition-all hover:text-[#c62828] hover:shadow-[0_0_8px_rgb(198_40_40_/_0.2)]"
		on:click={onToggle}
		aria-label="Help"
	>
		<Aperture class="h-[18px] w-[18px]" />
	</button>
{/if}

<style>
	/* ===== HAL 9000 Eye Unit ===== */

	.hal-eye {
		position: relative;
		width: 48px;
		height: 48px;
	}

	/* The dark recessed housing around the lens */
	.hal-housing {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		background: radial-gradient(circle at center, #2a2420 0%, #1a1714 60%, #0f0e0c 100%);
		border: 2px solid #3d3832;
		box-shadow:
			inset 0 2px 8px rgb(0 0 0 / 0.4),
			0 1px 3px rgb(26 23 20 / 0.2),
			0 4px 12px rgb(26 23 20 / 0.1);
		overflow: hidden;
	}

	/* The ambient red glow behind the iris */
	.hal-glow {
		position: absolute;
		inset: 6px;
		border-radius: 50%;
		background: radial-gradient(
			circle at center,
			rgb(198 40 40 / 0.5) 0%,
			rgb(198 40 40 / 0.15) 50%,
			transparent 70%
		);
		animation: hal-breathe 5s ease-in-out infinite;
	}

	.hal-glow.hal-focused {
		background: radial-gradient(
			circle at center,
			rgb(198 40 40 / 0.7) 0%,
			rgb(198 40 40 / 0.3) 50%,
			transparent 70%
		);
		animation:
			hal-breathe 5s ease-in-out infinite,
			hal-focus 0.4s ease-out;
	}

	.hal-eye:hover .hal-glow {
		background: radial-gradient(
			circle at center,
			rgb(198 40 40 / 0.65) 0%,
			rgb(198 40 40 / 0.25) 50%,
			transparent 70%
		);
	}

	/* The iris icon */
	.hal-iris {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #c62828;
		filter: drop-shadow(0 0 4px rgb(198 40 40 / 0.6));
		animation: hal-breathe 5s ease-in-out infinite;
		transition:
			filter 0.3s,
			transform 0.3s;
	}

	.hal-eye:hover .hal-iris {
		filter: drop-shadow(0 0 8px rgb(198 40 40 / 0.8));
		transform: scale(0.94);
	}

	.hal-iris.hal-focused {
		filter: drop-shadow(0 0 8px rgb(198 40 40 / 0.8));
		animation:
			hal-breathe 5s ease-in-out infinite,
			hal-iris-focus 0.5s ease-out;
	}

	/* The specular highlight: a small bright point like light reflecting off a glass lens */
	.hal-highlight {
		position: absolute;
		top: 12px;
		left: 15px;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: radial-gradient(
			circle at center,
			rgb(255 255 255 / 0.6) 0%,
			rgb(255 255 255 / 0.1) 60%,
			transparent 100%
		);
		pointer-events: none;
	}

	/* ===== Popup ===== */

	.hal-popup {
		filter: drop-shadow(0 1px 3px rgb(26 23 20 / 0.08)) drop-shadow(0 4px 16px rgb(26 23 20 / 0.06));
	}

	.hal-popup-inner {
		position: relative;
		overflow: hidden;
	}

	/* Thin red line at the top of the popup, like a status indicator */
	.hal-accent-line {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 2px;
		background: linear-gradient(90deg, transparent 0%, #c62828 20%, #c62828 80%, transparent 100%);
		opacity: 0.4;
		border-radius: 2px 2px 0 0;
	}

	.hal-quip {
		font-style: italic;
		letter-spacing: 0.01em;
	}

	/* ===== Keyframes ===== */

	/* Slow, organic breathing: HAL is alive */
	@keyframes hal-breathe {
		0%,
		100% {
			opacity: 0.8;
		}
		35% {
			opacity: 1;
		}
		65% {
			opacity: 0.9;
		}
		85% {
			opacity: 0.75;
		}
	}

	/* Focus: HAL turns his attention to you */
	@keyframes hal-focus {
		0% {
			transform: scale(1);
			opacity: 0.8;
		}
		40% {
			transform: scale(1.15);
			opacity: 1;
		}
		100% {
			transform: scale(1);
			opacity: 1;
		}
	}

	/* Iris contraction when focused */
	@keyframes hal-iris-focus {
		0% {
			transform: scale(1) rotate(0deg);
		}
		30% {
			transform: scale(0.88) rotate(-15deg);
		}
		60% {
			transform: scale(0.95) rotate(-8deg);
		}
		100% {
			transform: scale(1) rotate(0deg);
		}
	}
</style>
