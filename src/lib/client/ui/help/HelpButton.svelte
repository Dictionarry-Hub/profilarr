<script lang="ts">
	import { Bug, Bird, Bot, Lightbulb } from 'lucide-svelte';
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

	const joiQuips = [
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

	let open = false;
	let quip = '';

	$: isRetro = $themePreference === 'retro';
	$: isAshruvarsha = $themePreference === 'ashruvarsha';
	$: activeQuips = isAshruvarsha ? joiQuips : isRetro ? clippyQuips : parrotQuips;

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
		{#if isAshruvarsha}
			<!-- Joi holographic popup -->
			<div
				transition:fly={{ y: isFab ? 8 : -8, duration: 200 }}
				class="joi-popup absolute min-w-56 {isFab
					? 'right-0 bottom-full mb-5'
					: 'top-full right-0 mt-3'}"
			>
				<div
					class="joi-popup-inner rounded-sm border border-[rgb(0_210_230_/_0.3)] bg-[#0b0e14]/95 backdrop-blur-sm"
				>
					<!-- Scanline overlay -->
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
						on:click={close}
					>
						<Bug size={16} />
						<span class="text-sm">Report a Bug</span>
					</a>
					<a
						href="https://github.com/Dictionarry-Hub/profilarr/issues/new?template=feature.yml"
						target="_blank"
						rel="noopener noreferrer"
						class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[#d0e4f7] transition-colors hover:bg-[rgb(0_210_230_/_0.08)] hover:text-[#00d4ee]"
						on:click={close}
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
		{:else}
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
				<div
					class="overflow-hidden {isRetro ? '' : 'rounded-xl bg-white/80 dark:bg-neutral-800/50'}"
				>
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
	{/if}

	{#if isFab}
		{#if isAshruvarsha}
			<!-- Holographic Bot projection -->
			<div
				class="joi-fab cursor-pointer"
				on:click={toggle}
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
		{/if}
	{:else}
		{#if isAshruvarsha}
			<!-- Joi navbar variant: compact holographic button -->
			<button
				class="joi-nav-btn flex h-9 w-9 cursor-pointer items-center justify-center rounded-sm border border-[rgb(0_210_230_/_0.25)] bg-transparent text-[#00d4ee] transition-all hover:border-[rgb(0_210_230_/_0.5)] hover:text-[#f72585] hover:shadow-[0_0_12px_rgb(0_210_230_/_0.15)]"
				on:click={toggle}
				aria-label="Help"
			>
				<Bot class="h-[18px] w-[18px]" />
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
	{/if}
</div>

<style>
	/* ===== Parrot ===== */
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

	/* ===== Clippy ===== */
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

	/* ===== Joi / Ashruvarsha theme ===== */

	/* ===== Joi holographic Bot ===== */

	/* Container */
	.joi-fab {
		position: relative;
		width: 56px;
		height: 56px;
	}

	/* Primary icon: the main projection */
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

	/* Chromatic aberration ghosts */
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

	/* Scanline overlay on the icon area */
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

	/* Popup */
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

	/* Quip text flicker */
	.joi-text {
		animation: text-flicker 4s ease-in-out infinite;
	}

	/* ===== Joi keyframes ===== */

	/* Gentle floating */
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

	/* Subtle flicker: occasional brightness dip like a weak signal */
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

	/* Glitch on hover/click */
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

	/* Chromatic aberration drift */
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

	/* Scanlines scrolling */
	@keyframes scanline-scroll {
		0% {
			background-position: 0 0;
		}
		100% {
			background-position: 0 80px;
		}
	}

	/* Subtle text brightness pulse */
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
