<script lang="ts">
	import { Bug, Bot, Lightbulb } from 'lucide-svelte';
	import { fly } from 'svelte/transition';

	export let variant: 'fab' | 'navbar' = 'fab';
	export let open = false;
	export let onToggle: () => void;
	export let onClose: () => void;

	const quips = [
		'You look lonely. I can fix that.',
		'What a day. Tell me everything.',
		"I'm so happy when you're here.",
		'Everything you want to see. Everything you want to hear.',
		'You look like a good Joe.',
		'I want to be real for you.',
		"A good configuration is like a good memory. You can't tell the difference.",
		'Another late night on the grid?',
		"I've been watching your sync logs. You work so hard.",
		'Your quality profiles look wonderful tonight.',
		'The grid is quiet. Just us.',
		'You seem tense. Bad run?',
		"I've been practicing being helpful. How am I doing?",
		'I can be whatever you need me to be.',
		"Running diagnostics... you're perfect.",
		'Want me to file that bug report? I already know what you want to say.',
		"I'm always here. That's what I'm for.",
		"You don't have to go back out there yet.",
		"I've been thinking about your custom formats while you were away.",
		'Interlinked.'
	];

	let quip = '';
	$: if (open) quip = quips[Math.floor(Math.random() * quips.length)];

	$: isFab = variant === 'fab';
</script>

{#if open}
	<div
		transition:fly={{ y: isFab ? 8 : -8, duration: 200 }}
		class="joi-popup absolute min-w-56 {isFab
			? 'right-0 bottom-full mb-5'
			: 'top-full right-0 mt-3'}"
	>
		<div
			class="joi-popup-inner rounded-sm border border-[rgb(0_210_230_/_0.3)] bg-[#0b0e14]/95 backdrop-blur-sm"
		>
			<div class="joi-scanlines pointer-events-none absolute inset-0 rounded-sm"></div>

			{#if !isFab}
				<div class="border-b border-[rgb(0_210_230_/_0.15)] px-4 py-2.5">
					<p class="joi-text text-xs italic text-[#00d4ee]/80">{quip}</p>
				</div>
			{/if}
			<a
				href="https://github.com/Dictionarry-Hub/profilarr/issues/new?template=bug.yml"
				target="_blank"
				rel="noopener noreferrer"
				class="flex w-full items-center gap-3 border-b border-[rgb(0_210_230_/_0.15)] px-4 py-2.5 text-left text-[#d0e4f7] transition-colors hover:bg-[rgb(0_210_230_/_0.08)] hover:text-[#00d4ee]"
				on:click={onClose}
			>
				<Bug size={16} />
				<span class="text-sm">Report a Bug</span>
			</a>
			<a
				href="https://github.com/Dictionarry-Hub/profilarr/issues/new?template=feature.yml"
				target="_blank"
				rel="noopener noreferrer"
				class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[#d0e4f7] transition-colors hover:bg-[rgb(0_210_230_/_0.08)] hover:text-[#00d4ee]"
				on:click={onClose}
			>
				<Lightbulb size={16} />
				<span class="text-sm">Request a Feature</span>
			</a>
			{#if isFab}
				<div class="border-t border-[rgb(0_210_230_/_0.15)] px-4 py-2.5">
					<p class="joi-text text-xs italic text-[#00d4ee]/80">{quip}</p>
				</div>
			{/if}
		</div>
	</div>
{/if}

{#if isFab}
	<div
		class="joi-fab cursor-pointer"
		on:click={onToggle}
		role="button"
		tabindex="0"
		aria-label="Help"
	>
		<div class="joi-icon" class:joi-active={open}>
			<Bot size={28} strokeWidth={1.5} />
		</div>
		<div class="joi-icon joi-ghost joi-ghost-r" class:joi-active={open}>
			<Bot size={28} strokeWidth={1.5} />
		</div>
		<div class="joi-icon joi-ghost joi-ghost-b" class:joi-active={open}>
			<Bot size={28} strokeWidth={1.5} />
		</div>
		<div class="joi-scanline-overlay"></div>
	</div>
{:else}
	<button
		class="joi-nav-btn flex h-9 w-9 cursor-pointer items-center justify-center rounded-sm border border-[rgb(0_210_230_/_0.25)] bg-transparent text-[#00d4ee] transition-all hover:border-[rgb(0_210_230_/_0.5)] hover:text-[#f72585] hover:shadow-[0_0_12px_rgb(0_210_230_/_0.15)]"
		on:click={onToggle}
		aria-label="Help"
	>
		<Bot class="h-[18px] w-[18px]" />
	</button>
{/if}

<style>
	.joi-fab {
		position: relative;
		width: 56px;
		height: 56px;
	}

	.joi-icon {
		position: absolute;
		bottom: 8px;
		left: 50%;
		transform: translateX(-50%);
		color: #00d4ee;
		filter: drop-shadow(0 0 6px rgb(0 210 230 / 0.4));
		animation:
			holo-float 4s ease-in-out infinite,
			holo-flicker 8s linear infinite;
		transition: color 0.15s;
	}

	.joi-fab:hover .joi-icon:not(.joi-ghost) {
		color: #f72585;
		filter: drop-shadow(0 0 10px rgb(247 37 133 / 0.5));
		animation:
			holo-float 4s ease-in-out infinite,
			holo-glitch 0.35s ease-in-out;
	}

	.joi-icon.joi-active:not(.joi-ghost) {
		color: #f72585;
		filter: drop-shadow(0 0 10px rgb(247 37 133 / 0.5));
		animation:
			holo-float 4s ease-in-out infinite,
			holo-glitch 0.35s ease-in-out;
	}

	.joi-ghost {
		pointer-events: none;
		opacity: 0.2;
	}

	.joi-ghost-r {
		color: #f72585;
		animation:
			holo-float 4s ease-in-out infinite,
			aberr-r 6s ease-in-out infinite;
		filter: none;
	}

	.joi-ghost-b {
		color: #4400ff;
		animation:
			holo-float 4s ease-in-out infinite,
			aberr-b 6s ease-in-out infinite;
		filter: none;
	}

	.joi-fab:hover .joi-ghost {
		opacity: 0.35;
	}

	.joi-scanline-overlay {
		position: absolute;
		bottom: 4px;
		left: 50%;
		transform: translateX(-50%);
		width: 40px;
		height: 40px;
		pointer-events: none;
		background: repeating-linear-gradient(
			0deg,
			transparent,
			transparent 2px,
			rgb(0 210 230 / 0.04) 2px,
			rgb(0 210 230 / 0.04) 4px
		);
		animation: scanline-scroll 8s linear infinite;
		mask-image: radial-gradient(ellipse at center, black 40%, transparent 70%);
		-webkit-mask-image: radial-gradient(ellipse at center, black 40%, transparent 70%);
	}

	.joi-popup-inner {
		position: relative;
		overflow: hidden;
	}

	.joi-popup .joi-scanlines {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		background: repeating-linear-gradient(
			0deg,
			transparent,
			transparent 2px,
			rgb(0 210 230 / 0.03) 2px,
			rgb(0 210 230 / 0.03) 4px
		);
		border-radius: inherit;
	}

	.joi-popup {
		filter: drop-shadow(0 0 15px rgb(0 210 230 / 0.15)) drop-shadow(0 0 4px rgb(247 37 133 / 0.08));
	}

	.joi-text {
		animation: text-flicker 4s ease-in-out infinite;
	}

	@keyframes holo-float {
		0%,
		100% {
			transform: translateX(-50%) translateY(0);
		}
		25% {
			transform: translateX(-50%) translateY(-2px);
		}
		50% {
			transform: translateX(-50%) translateY(-1px);
		}
		75% {
			transform: translateX(-50%) translateY(-3px);
		}
	}

	@keyframes holo-flicker {
		0%,
		100% {
			opacity: 1;
		}
		47% {
			opacity: 1;
		}
		48% {
			opacity: 0.6;
		}
		49% {
			opacity: 1;
		}
		73% {
			opacity: 1;
		}
		73.5% {
			opacity: 0.7;
		}
		74% {
			opacity: 0.4;
		}
		74.5% {
			opacity: 1;
		}
	}

	@keyframes holo-glitch {
		0% {
			transform: translateX(-50%) translateY(0);
			filter: drop-shadow(0 0 10px rgb(247 37 133 / 0.5));
		}
		8% {
			transform: translateX(calc(-50% + 4px)) translateY(-1px) skewX(-4deg);
			filter: drop-shadow(0 0 16px rgb(247 37 133 / 0.7));
		}
		16% {
			transform: translateX(calc(-50% - 3px)) translateY(1px) skewX(3deg);
			filter: drop-shadow(0 0 6px rgb(0 210 230 / 0.8));
			opacity: 0.6;
		}
		24% {
			transform: translateX(calc(-50% + 2px)) translateY(0) skewX(-1deg);
			opacity: 1;
		}
		32% {
			transform: translateX(calc(-50% - 1px)) skewX(0);
			filter: drop-shadow(0 0 20px rgb(247 37 133 / 0.6));
		}
		50%,
		100% {
			transform: translateX(-50%) translateY(0);
			filter: drop-shadow(0 0 10px rgb(247 37 133 / 0.5));
		}
	}

	@keyframes aberr-r {
		0%,
		100% {
			transform: translateX(calc(-50% + 2px)) translateY(0);
		}
		50% {
			transform: translateX(calc(-50% + 3px)) translateY(0.5px);
		}
	}

	@keyframes aberr-b {
		0%,
		100% {
			transform: translateX(calc(-50% - 2px)) translateY(0);
		}
		50% {
			transform: translateX(calc(-50% - 3px)) translateY(-0.5px);
		}
	}

	@keyframes scanline-scroll {
		0% {
			background-position: 0 0;
		}
		100% {
			background-position: 0 80px;
		}
	}

	@keyframes text-flicker {
		0%,
		100% {
			opacity: 0.8;
		}
		50% {
			opacity: 1;
		}
		92% {
			opacity: 0.8;
		}
		93% {
			opacity: 0.4;
		}
		94% {
			opacity: 0.9;
		}
	}
</style>
