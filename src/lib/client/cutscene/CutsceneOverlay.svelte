<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import { afterNavigate, goto } from '$app/navigation';
	import { fade, fly } from 'svelte/transition';
	import { cutscene } from './store';
	import { setupCompletion, teardownCompletion } from './completions.ts';
	import { STAGES, PIPELINES } from './definitions/index.ts';
	import CutsceneCard from './CutsceneCard.svelte';

	let targetRect: DOMRect | null = null;
	let windowWidth = 0;
	let windowHeight = 0;

	const { currentStep } = cutscene;

	$: state = $cutscene;
	$: step = $currentStep;
	$: active = state.active;

	// Compute overall progress across pipeline or single stage
	$: progressInfo = (() => {
		if (!state.active || !state.stageId) return { current: 0, total: 0 };

		if (state.pipelineId) {
			const pipeline = PIPELINES[state.pipelineId];
			if (!pipeline) return { current: 0, total: 0 };

			let total = 0;
			let current = 0;
			for (const sid of pipeline.stages) {
				const s = STAGES[sid];
				if (!s) continue;
				if (sid === state.stageId) {
					current = total + state.stepIndex;
				}
				total += s.steps.length;
			}
			return { current, total };
		}

		const stage = STAGES[state.stageId];
		if (!stage) return { current: 0, total: 0 };
		return { current: state.stepIndex, total: stage.steps.length };
	})();

	// Padding around the spotlight cutout
	const PAD = 8;
	const RADIUS = 12;

	// Animated spotlight position (for smooth transitions between targets)
	let animatedRect = { x: 0, y: 0, w: 0, h: 0 };
	let animating = false;

	function lerpRect(
		from: { x: number; y: number; w: number; h: number },
		to: { x: number; y: number; w: number; h: number },
		duration: number
	): void {
		const start = performance.now();
		animating = true;

		function frame(now: number): void {
			const t = Math.min((now - start) / duration, 1);
			const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOutQuad
			animatedRect = {
				x: from.x + (to.x - from.x) * ease,
				y: from.y + (to.y - from.y) * ease,
				w: from.w + (to.w - from.w) * ease,
				h: from.h + (to.h - from.h) * ease
			};
			if (t < 1) {
				requestAnimationFrame(frame);
			} else {
				animating = false;
			}
		}
		requestAnimationFrame(frame);
	}

	function findTarget(): void {
		if (!step?.target) {
			targetRect = null;
			return;
		}
		const el = document.querySelector(`[data-onboarding="${step.target}"]`);
		if (el) {
			const rect = el.getBoundingClientRect();
			const newRect = {
				x: rect.left - PAD,
				y: rect.top - PAD,
				w: rect.width + PAD * 2,
				h: rect.height + PAD * 2
			};

			if (targetRect && (animatedRect.w > 0 || animatedRect.h > 0)) {
				// Animate from current position to new position
				lerpRect(animatedRect, newRect, 500);
			} else {
				// First target, snap immediately
				animatedRect = newRect;
			}
			targetRect = rect;
		} else {
			targetRect = null;
		}
	}

	function updateDimensions(): void {
		windowWidth = window.innerWidth;
		windowHeight = window.innerHeight;
		findTarget();
	}

	// Track step changes to avoid reactive loops
	let lastStepId: string | null = null;
	let cardReady = false;

	$: if (step && step.id !== lastStepId && typeof window !== 'undefined') {
		lastStepId = step.id;
		cardReady = false;
		teardownCompletion();
		setupCompletion(step, () => cutscene.advance());

		// Navigate if step requires a specific route
		const needsNav = step.route && window.location.pathname !== step.route;
		const afterNav = () => {
			tick().then(() => {
				requestAnimationFrame(() => {
					findTarget();
					setTimeout(
						() => {
							cardReady = true;
						},
						animating ? 0 : 200
					);
				});
			});
		};

		if (needsNav) {
			goto(step.route!).then(afterNav);
		} else {
			afterNav();
		}
	} else if (!step) {
		lastStepId = null;
	}

	// Recalculate on scroll and resize
	function onScroll(): void {
		if (!animating) requestAnimationFrame(findTarget);
	}

	$: if (active && typeof window !== 'undefined') {
		window.addEventListener('scroll', onScroll, true);
		window.addEventListener('resize', updateDimensions);
	}

	afterNavigate(() => {
		if (active) {
			tick().then(() => requestAnimationFrame(findTarget));
		}
	});

	// Watch for target appearing via MutationObserver
	let observer: MutationObserver | null = null;
	$: if (step?.target && !targetRect && typeof window !== 'undefined') {
		observer?.disconnect();
		observer = new MutationObserver(() => {
			findTarget();
			if (targetRect) observer?.disconnect();
		});
		observer.observe(document.body, { childList: true, subtree: true });
	}

	// Use animated rect for visuals, real rect for card positioning
	$: spotlightRect = animatedRect;

	// Compute clip-path for click-blocking overlay (with rounded hole)
	$: clipPath = computeClipPath(targetRect);

	function computeClipPath(rect: DOMRect | null): string {
		if (!rect) return 'none';
		const l = rect.left - PAD;
		const t = rect.top - PAD;
		const r = rect.right + PAD;
		const b = rect.bottom + PAD;
		const R = RADIUS;
		// SVG path: outer rect (full viewport) + inner rounded rect (cutout, counter-clockwise for evenodd)
		const outer = `M0,0 H${windowWidth} V${windowHeight} H0 Z`;
		const inner = `M${l + R},${t} H${r - R} Q${r},${t} ${r},${t + R} V${b - R} Q${r},${b} ${r - R},${b} H${l + R} Q${l},${b} ${l},${b - R} V${t + R} Q${l},${t} ${l + R},${t} Z`;
		return `path(evenodd, "${outer} ${inner}")`;
	}

	// Compute instruction card position
	$: cardStyle = computeCardPosition(step?.position, targetRect);

	function computeCardPosition(position: string | undefined, rect: DOMRect | null): string {
		if (!rect) {
			return 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);';
		}

		const gap = 16;

		switch (position) {
			case 'above':
				return `position: fixed; bottom: ${windowHeight - rect.top + gap + PAD}px; left: ${rect.left + rect.width / 2}px; transform: translateX(-50%);`;
			case 'below':
				return `position: fixed; top: ${rect.bottom + gap + PAD}px; left: ${rect.left + rect.width / 2}px; transform: translateX(-50%);`;
			case 'left':
				return `position: fixed; top: ${rect.top + rect.height / 2}px; right: ${windowWidth - rect.left + gap + PAD}px; transform: translateY(-50%);`;
			case 'right':
				return `position: fixed; top: ${rect.top + rect.height / 2}px; left: ${rect.right + gap + PAD}px; transform: translateY(-50%);`;
			case 'above-left':
				return `position: fixed; bottom: ${windowHeight - rect.top + gap + PAD}px; right: ${windowWidth - rect.right + gap + PAD}px;`;
			case 'above-right':
				return `position: fixed; bottom: ${windowHeight - rect.top + gap + PAD}px; left: ${rect.left - gap - PAD}px;`;
			case 'below-left':
				return `position: fixed; top: ${rect.bottom + gap + PAD}px; right: ${windowWidth - rect.right}px;`;
			case 'below-right':
				return `position: fixed; top: ${rect.bottom + gap + PAD}px; left: ${rect.right + gap}px;`;
			default:
				return `position: fixed; top: ${rect.bottom + gap + PAD}px; left: ${rect.left + rect.width / 2}px; transform: translateX(-50%);`;
		}
	}

	function handleContinue(): void {
		cutscene.advance();
	}

	function handleCancel(): void {
		teardownCompletion();
		cutscene.cancel();
	}

	function handleKeydown(e: KeyboardEvent): void {
		if (e.key === 'Escape' && active) {
			handleCancel();
		}
	}

	onDestroy(() => {
		teardownCompletion();
		observer?.disconnect();
		if (typeof window !== 'undefined') {
			window.removeEventListener('scroll', onScroll, true);
			window.removeEventListener('resize', updateDimensions);
		}
	});
</script>

<svelte:window
	bind:innerWidth={windowWidth}
	bind:innerHeight={windowHeight}
	on:keydown={handleKeydown}
/>

{#if active && step}
	<div
		class="fixed inset-0 z-[9999]"
		style="pointer-events: none;"
		transition:fade={{ duration: 200 }}
	>
		<!-- Visual overlay (SVG mask for rounded cutout) -->
		<svg class="absolute inset-0 h-full w-full" style="pointer-events: none;">
			<defs>
				<mask id="cutscene-mask">
					<rect width="100%" height="100%" fill="white" />
					{#if targetRect}
						<rect
							x={spotlightRect.x}
							y={spotlightRect.y}
							width={spotlightRect.w}
							height={spotlightRect.h}
							rx={RADIUS}
							ry={RADIUS}
							fill="black"
						/>
					{/if}
				</mask>
			</defs>
			<rect
				width="100%"
				height="100%"
				fill="rgba(0, 0, 0, 0.6)"
				mask="url(#cutscene-mask)"
				style="pointer-events: none;"
			/>
		</svg>

		<!-- Click-blocking overlay with hole for cutout (disabled for manual steps so users can interact freely) -->
		{#if !step.freeInteract}
			<div class="absolute inset-0" style="pointer-events: auto; clip-path: {clipPath};"></div>
		{/if}

		<!-- Instruction card (waits for spotlight animation) -->
		{#if !animating && cardReady}
			<div
				class="max-w-sm"
				style="{cardStyle} pointer-events: auto; z-index: 1;"
				in:fly={{ y: 12, duration: 200 }}
				out:fade={{ duration: 100 }}
			>
				<CutsceneCard
					title={step.title}
					body={step.body}
					showContinue={step.completion.type === 'manual'}
					onContinue={handleContinue}
					onCancel={handleCancel}
					currentStep={progressInfo.current}
					totalSteps={progressInfo.total}
				/>
			</div>
		{/if}
	</div>
{/if}
