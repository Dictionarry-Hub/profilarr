<script lang="ts">
	export let isDragging = false;
	export let onDragHandlePointerDown: ((e: PointerEvent) => void) | undefined = undefined;
	export let className = '';
	export let contentClass = 'p-3';
	export let dragHandleOnboarding: string | undefined = undefined;
</script>

<div
	class="relative flex overflow-hidden rounded-card border border-border bg-surface select-none {isDragging
		? 'scale-[0.98] opacity-50'
		: ''} {className}"
	style="transition: opacity 100ms, transform 100ms;"
	on:click
	on:keydown
	{...$$restProps}
>
	<!-- Drag head — desktop only -->
	<div
		class="group hidden w-7 shrink-0 items-center justify-center border-r border-border-muted md:flex {isDragging
			? 'cursor-grabbing'
			: 'cursor-grab'}"
		on:pointerdown={onDragHandlePointerDown}
		on:click|stopPropagation|preventDefault
		on:keydown|stopPropagation
		role="button"
		tabindex="-1"
		aria-label="Drag to reorder"
		data-onboarding={dragHandleOnboarding}
	>
		<svg
			width="8"
			height="14"
			viewBox="0 0 8 14"
			fill="currentColor"
			class="text-text-subtle transition-colors group-hover:text-text-muted"
		>
			<circle cx="2" cy="2" r="1.25" />
			<circle cx="6" cy="2" r="1.25" />
			<circle cx="2" cy="7" r="1.25" />
			<circle cx="6" cy="7" r="1.25" />
			<circle cx="2" cy="12" r="1.25" />
			<circle cx="6" cy="12" r="1.25" />
		</svg>
	</div>

	<!-- Content -->
	<div class="min-w-0 flex-1 {contentClass}">
		<slot />
	</div>
</div>
