<script lang="ts">
	export let isDragging = false;
	export let onDragHandlePointerDown: ((e: PointerEvent) => void) | undefined = undefined;
	export let variant: 'default' | 'ghost' | 'outline' = 'ghost';
	export let className = '';
	export let contentClass = 'p-3';
	export let dragHandleOnboarding: string | undefined = undefined;

	const variantClasses = {
		default: 'border border-neutral-300 bg-white dark:border-neutral-700/60 dark:bg-neutral-800/50',
		ghost: 'bg-neutral-100/60 dark:bg-neutral-800/40',
		outline: 'border border-neutral-300 dark:border-neutral-700/60'
	};
</script>

<div
	class="relative flex overflow-hidden rounded-xl select-none {variantClasses[variant]} {isDragging
		? 'scale-[0.98] opacity-50'
		: ''} {className}"
	style="transition: opacity 100ms, transform 100ms;"
	on:click
	on:keydown
	{...$$restProps}
>
	<!-- Drag handle — desktop only -->
	<div class="hidden shrink-0 items-center pl-2 md:flex">
		<div
			class="flex h-7 w-7 items-center justify-center rounded-xl transition-colors {isDragging
				? 'cursor-grabbing bg-neutral-100 dark:bg-neutral-700/50'
				: 'cursor-grab hover:bg-neutral-100 dark:hover:bg-neutral-700/50'}"
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
				class="text-neutral-400 dark:text-neutral-500"
			>
				<circle cx="2" cy="2" r="1.25" />
				<circle cx="6" cy="2" r="1.25" />
				<circle cx="2" cy="7" r="1.25" />
				<circle cx="6" cy="7" r="1.25" />
				<circle cx="2" cy="12" r="1.25" />
				<circle cx="6" cy="12" r="1.25" />
			</svg>
		</div>
	</div>

	<!-- Content -->
	<div class="min-w-0 flex-1 {contentClass}">
		<slot />
	</div>
</div>
