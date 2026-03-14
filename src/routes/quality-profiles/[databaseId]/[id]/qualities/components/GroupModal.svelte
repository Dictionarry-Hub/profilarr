<script lang="ts">
	import { createEventDispatcher, onDestroy, onMount } from 'svelte';
	import { Check, Grip, ChevronUp, ChevronDown } from 'lucide-svelte';
	import Modal from '$ui/modal/Modal.svelte';
	import IconCheckbox from '$lib/client/ui/form/IconCheckbox.svelte';
	import FormInput from '$lib/client/ui/form/FormInput.svelte';
	import Button from '$ui/button/Button.svelte';

	type GroupModalItem = {
		name: string;
		enabled: boolean;
		upgradeUntil: boolean;
	};

	export let open = false;
	export let title = 'Create Group';
	export let confirmText = 'Create Group';
	export let confirmDisabled = false;
	export let description =
		'Select at least two qualities to combine into a group. Groups share the same priority.';
	export let groupName = '';
	export let items: GroupModalItem[] = [];
	export let selectedNames: Set<string> = new Set();
	export let size: 'sm' | 'md' | 'lg' | 'xl' | '2xl' = 'lg';
	export let height: 'auto' | 'md' | 'lg' | 'xl' | 'full' = 'xl';

	const dispatch = createEventDispatcher<{
		confirm: void;
		cancel: void;
		toggle: { name: string };
		reorder: { items: GroupModalItem[] };
	}>();

	function handleToggle(name: string) {
		if (suppressToggleUntil > Date.now()) {
			return;
		}
		dispatch('toggle', { name });
	}

	function handleReorder(nextItems: GroupModalItem[]) {
		dispatch('reorder', { items: nextItems });
	}

	function moveItem(index: number, direction: 'up' | 'down') {
		const targetIndex = direction === 'up' ? index - 1 : index + 1;
		if (targetIndex < 0 || targetIndex >= items.length) return;

		const nextItems = [...items];
		const [movedItem] = nextItems.splice(index, 1);
		nextItems.splice(targetIndex, 0, movedItem);
		handleReorder(nextItems);
	}

	let isMobile = false;
	let mediaQuery: MediaQueryList | null = null;
	let draggedItem: { item: GroupModalItem; index: number } | null = null;
	let lastTargetIndex: number | null = null;
	let pointerStartPoint: { x: number; y: number } | null = null;
	let pointerDidDrag = false;
	let suppressToggleUntil = 0;

	onMount(() => {
		if (typeof window !== 'undefined') {
			mediaQuery = window.matchMedia('(max-width: 767px)');
			isMobile = mediaQuery.matches;
			mediaQuery.addEventListener('change', handleMediaChange);
		}
	});

	onDestroy(() => {
		if (mediaQuery) {
			mediaQuery.removeEventListener('change', handleMediaChange);
		}
		if (typeof document !== 'undefined') {
			document.removeEventListener('pointermove', handlePointerMove);
			document.removeEventListener('pointerup', handlePointerUp);
			document.body.classList.remove('dragging');
		}
	});

	function handleMediaChange(e: MediaQueryListEvent) {
		isMobile = e.matches;
	}

	function getTargetFromPoint(
		x: number,
		y: number
	): { item: GroupModalItem; index: number } | null {
		const el = document.elementFromPoint(x, y);
		const card = el?.closest('[data-group-modal-index]') as HTMLElement | null;
		if (!card) return null;
		const index = parseInt(card.dataset.groupModalIndex ?? '', 10);
		if (isNaN(index) || index < 0 || index >= items.length) return null;
		return { item: items[index], index };
	}

	function handlePointerDown(e: PointerEvent, item: GroupModalItem, index: number) {
		if (isMobile) return;
		e.preventDefault();
		e.stopPropagation();
		document.body.classList.add('dragging');
		draggedItem = { item, index };
		lastTargetIndex = index;
		pointerStartPoint = { x: e.clientX, y: e.clientY };
		pointerDidDrag = false;
		document.addEventListener('pointermove', handlePointerMove);
		document.addEventListener('pointerup', handlePointerUp);
	}

	function handlePointerMove(e: PointerEvent) {
		if (!draggedItem) return;
		if (pointerStartPoint) {
			const dx = Math.abs(e.clientX - pointerStartPoint.x);
			const dy = Math.abs(e.clientY - pointerStartPoint.y);
			if (dx > 4 || dy > 4) {
				pointerDidDrag = true;
			}
		}

		const target = getTargetFromPoint(e.clientX, e.clientY);
		if (!target || target.index === draggedItem.index) {
			return;
		}

		if (lastTargetIndex === target.index) return;
		lastTargetIndex = target.index;

		const nextItems = [...items];
		const sourceIndex = draggedItem.index;
		const [movedItem] = nextItems.splice(sourceIndex, 1);
		nextItems.splice(target.index, 0, movedItem);

		handleReorder(nextItems);
		draggedItem.index = target.index;
	}

	function handlePointerUp() {
		if (pointerDidDrag) {
			suppressToggleUntil = Date.now() + 200;
		}
		resetDragState();
	}

	function resetDragState() {
		draggedItem = null;
		lastTargetIndex = null;
		pointerStartPoint = null;
		pointerDidDrag = false;
		document.removeEventListener('pointermove', handlePointerMove);
		document.removeEventListener('pointerup', handlePointerUp);
		document.body.classList.remove('dragging');
	}
</script>

<Modal
	{open}
	header={title}
	{confirmText}
	cancelText="Cancel"
	{confirmDisabled}
	{size}
	{height}
	on:confirm={() => dispatch('confirm')}
	on:cancel={() => dispatch('cancel')}
>
	<div slot="body" class="flex h-full flex-col gap-4">
		<p class="text-sm text-neutral-600 dark:text-neutral-400">
			{description}
		</p>

		<FormInput
			label="Group Name"
			name="quality-group-name"
			placeholder="e.g. Web + Bluray"
			required
			value={groupName}
			on:input={(event) => {
				groupName = event.detail;
			}}
		/>

		{#if items.length >= 2}
			<div class="px-1 text-xs text-neutral-500 dark:text-neutral-400">
				{isMobile
					? 'Use the move buttons to reorder selected members before saving the group.'
					: 'Drag to reorder selected members before saving the group.'}
			</div>
		{/if}

		<div class="min-h-0 flex-1 overflow-y-auto pr-2 [scrollbar-gutter:stable]">
			{#if items.length < 2}
				<div class="px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400">
					At least two qualities are required for a group.
				</div>
			{:else}
				<div class="space-y-2 pb-1">
					{#each items as item, index (item.name)}
						<div
							data-group-modal-index={index}
							data-group-modal-name={item.name}
							data-group-modal-selected={selectedNames.has(item.name) ? 'true' : 'false'}
							on:click={() => handleToggle(item.name)}
							on:keydown={(event) => {
								if (event.key === 'Enter' || event.key === ' ') {
									event.preventDefault();
									handleToggle(item.name);
								}
							}}
							class="rounded-xl border border-neutral-300 bg-white px-3 py-2.5 transition-colors hover:bg-neutral-50 dark:border-neutral-700/60 dark:bg-neutral-800/50 dark:hover:bg-neutral-800 {draggedItem?.index ===
							index
								? 'scale-95 opacity-50'
								: ''} cursor-pointer"
							style="transition: opacity 100ms, transform 100ms;"
							role="button"
							tabindex="0"
						>
							<div class="flex items-center justify-between gap-2.5">
								<button
									type="button"
									class="hidden shrink-0 text-neutral-400 md:block dark:text-neutral-500 {draggedItem?.index ===
									index
										? 'cursor-grabbing'
										: isMobile
											? ''
											: 'cursor-grab'}"
									on:pointerdown={(e) => handlePointerDown(e, item, index)}
									on:click|stopPropagation|preventDefault
								>
									<Grip size={16} />
								</button>
								<div class="flex min-w-0 flex-1 items-center justify-between gap-2.5">
									<div class="min-w-0 flex-1 text-left">
										<div
											class="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100"
										>
											{item.name}
										</div>
									</div>
									<div class="flex items-center gap-2">
										{#if isMobile}
											<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
											<div class="flex items-center gap-1" on:click|stopPropagation>
												<Button
													icon={ChevronUp}
													size="xs"
													disabled={index === 0}
													title="Move member up"
													ariaLabel="Move member up"
													on:click={() => moveItem(index, 'up')}
												/>
												<Button
													icon={ChevronDown}
													size="xs"
													disabled={index === items.length - 1}
													title="Move member down"
													ariaLabel="Move member down"
													on:click={() => moveItem(index, 'down')}
												/>
											</div>
										{/if}
										<IconCheckbox
											checked={selectedNames.has(item.name)}
											icon={Check}
											color="blue"
											shape="circle"
										/>
									</div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</Modal>

<style>
	:global(body.dragging),
	:global(body.dragging *) {
		cursor: grabbing !important;
	}
</style>
