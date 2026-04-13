<script lang="ts">
	export let isDragging = false;
	export let onDragHandlePointerDown: ((e: PointerEvent) => void) | undefined = undefined;
	export let className = '';
	export let contentClass = 'p-3';
</script>

<div
	class="relative flex overflow-hidden rounded-xl border border-neutral-300 bg-white select-none dark:border-neutral-700/60 dark:bg-neutral-800/50 {isDragging
		? 'scale-[0.98] opacity-50'
		: ''} {className}"
	style="transition: opacity 100ms, transform 100ms;"
	on:click
	on:keydown
	{...$$restProps}
>
	<!-- Drag head — desktop only -->
	<div
		class="group hidden w-7 shrink-0 items-center justify-center border-r border-neutral-100 md:flex dark:border-neutral-700/40 {isDragging
			? 'cursor-grabbing'
			: 'cursor-grab'}"
		on:pointerdown={onDragHandlePointerDown}
		on:click|stopPropagation|preventDefault
		on:keydown|stopPropagation
		role="button"
		tabindex="-1"
		aria-label="Drag to reorder"
	>
		<svg
			width="8"
			height="14"
			viewBox="0 0 8 14"
			fill="currentColor"
			class="text-neutral-300 transition-colors group-hover:text-neutral-400 dark:text-neutral-600 dark:group-hover:text-neutral-500"
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
