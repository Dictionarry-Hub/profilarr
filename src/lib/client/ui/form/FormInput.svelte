<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Eye, EyeOff } from 'lucide-svelte';
	import { alertStore } from '$alerts/store';

	export let label: string;
	export let description: string = '';
	export let placeholder: string = '';
	export let value: string = '';
	export let textarea: boolean = false;
	export let rows: number = 6;
	export let type: 'text' | 'number' | 'email' | 'password' | 'url' | 'time' | 'date' = 'text';
	export let required: boolean = false;
	export let hideLabel: boolean = false;
	export let name: string = '';
	export let autocomplete: string = '';
	export let private_: boolean = false;
	export let readonly: boolean = false;
	export let mono: boolean = false;
	export let disabled: boolean = false;
	export let wrap: boolean = false;
	export let size: 'sm' | 'md' | 'lg' = 'md';
	export let inputClass: string = '';
	export let inputElement: HTMLInputElement | HTMLTextAreaElement | null = null;
	export let lowercase: boolean = false;

	const dispatch = createEventDispatcher<{ input: string; focus: void; blur: void }>();

	$: fontClass = mono ? 'font-mono' : '';
	$: pickerClass = type === 'time' || type === 'date' ? 'dark:[color-scheme:dark]' : '';
	$: stateClass =
		readonly || disabled
			? 'bg-neutral-100 text-neutral-500 cursor-not-allowed dark:bg-neutral-800/40 dark:text-neutral-500'
			: 'bg-white focus:border-neutral-400 dark:bg-neutral-800/50 dark:focus:border-neutral-600';
	$: containerClass = hideLabel && !description ? 'space-y-0' : 'space-y-2';
	$: hasSuffix = !!$$slots.suffix;

	let showPassword = false;

	$: inputType = private_ ? (showPassword ? 'text' : 'password') : type;
	$: sizeClasses = {
		sm: 'rounded-lg px-2.5 py-1.5 text-xs',
		md: 'rounded-xl px-3 py-2 text-sm',
		lg: 'rounded-xl px-4 py-2.5 text-base'
	}[size];
	$: privatePaddingClass = hasSuffix ? 'pr-16' : 'pr-10';

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement | HTMLTextAreaElement;
		if (lowercase && target.value !== target.value.toLowerCase()) {
			target.value = target.value.toLowerCase();
			alertStore.add('warning', 'Tags must be lowercase');
		}
		value = target.value;
		dispatch('input', value);
	}

	function handleFocus() {
		dispatch('focus');
	}

	function handleBlur() {
		dispatch('blur');
	}

	function autoResize(node: HTMLTextAreaElement, _value: string) {
		function resize() {
			node.style.height = 'auto';
			node.style.height = node.scrollHeight + 'px';
		}
		resize();
		return {
			update() {
				resize();
			}
		};
	}
</script>

<div class={containerClass}>
	<label
		for={name}
		class="block text-sm font-medium text-neutral-900 dark:text-neutral-100 {hideLabel
			? 'sr-only'
			: ''}"
	>
		{label}{#if required}<span class="text-red-500">*</span>{/if}
	</label>

	{#if description}
		<p class="text-xs text-neutral-600 dark:text-neutral-400">
			{description}
		</p>
	{/if}

	{#if textarea}
		<div class={hasSuffix ? 'relative' : ''}>
			<textarea
				id={name}
				{name}
				{value}
				{placeholder}
				{required}
				{disabled}
				{readonly}
				{rows}
				bind:this={inputElement}
				oninput={handleInput}
				onfocus={handleFocus}
				onblur={handleBlur}
				class="block w-full border border-neutral-300 text-neutral-900 placeholder-neutral-400 transition-colors focus:border-neutral-300 focus:outline-none dark:border-neutral-700/60 dark:text-neutral-50 dark:placeholder-neutral-500 dark:focus:border-neutral-600 {sizeClasses} {fontClass} {pickerClass} {stateClass} {inputClass} {hasSuffix
					? 'pr-10'
					: ''}"
			></textarea>
			{#if hasSuffix}
				<div class="absolute top-3 right-3">
					<slot name="suffix" />
				</div>
			{/if}
		</div>
	{:else if private_}
		<div class="relative">
			<input
				id={name}
				{name}
				type={inputType}
				{value}
				{placeholder}
				{required}
				{disabled}
				{readonly}
				bind:this={inputElement}
				oninput={handleInput}
				onfocus={handleFocus}
				onblur={handleBlur}
				autocomplete={autocomplete
					? (autocomplete as typeof HTMLInputElement.prototype.autocomplete)
					: undefined}
				class="block w-full border border-neutral-300 text-neutral-900 placeholder-neutral-400 transition-colors focus:outline-none dark:border-neutral-700/60 dark:text-neutral-50 dark:placeholder-neutral-500 {sizeClasses} {fontClass} {pickerClass} {stateClass} {inputClass} {privatePaddingClass}"
			/>
			{#if hasSuffix}
				<div class="absolute top-1/2 right-10 -translate-y-1/2">
					<slot name="suffix" />
				</div>
			{/if}
			<button
				type="button"
				class="absolute top-1/2 right-3 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
				onclick={() => (showPassword = !showPassword)}
			>
				{#if showPassword}
					<EyeOff size={18} />
				{:else}
					<Eye size={18} />
				{/if}
			</button>
		</div>
	{:else if wrap}
		<div class={hasSuffix ? 'relative' : ''}>
			<textarea
				id={name}
				{name}
				{value}
				{placeholder}
				{required}
				{disabled}
				{readonly}
				rows={1}
				bind:this={inputElement}
				oninput={handleInput}
				onfocus={handleFocus}
				onblur={handleBlur}
				class="block w-full resize-none overflow-hidden border border-neutral-300 text-neutral-900 placeholder-neutral-400 transition-colors focus:outline-none dark:border-neutral-700/60 dark:text-neutral-50 dark:placeholder-neutral-500 {sizeClasses} {fontClass} {pickerClass} {stateClass} {inputClass} {hasSuffix
					? 'pr-10'
					: ''}"
				use:autoResize={value}
			></textarea>
			{#if hasSuffix}
				<div class="absolute top-3 right-3">
					<slot name="suffix" />
				</div>
			{/if}
		</div>
	{:else}
		<div class={hasSuffix ? 'relative' : ''}>
			<input
				id={name}
				{name}
				{type}
				{value}
				{placeholder}
				{required}
				{disabled}
				{readonly}
				bind:this={inputElement}
				oninput={handleInput}
				onfocus={handleFocus}
				onblur={handleBlur}
				autocomplete={autocomplete
					? (autocomplete as typeof HTMLInputElement.prototype.autocomplete)
					: undefined}
				class="block w-full border border-neutral-300 text-neutral-900 placeholder-neutral-400 transition-colors focus:outline-none dark:border-neutral-700/60 dark:text-neutral-50 dark:placeholder-neutral-500 {sizeClasses} {fontClass} {pickerClass} {stateClass} {inputClass} {hasSuffix
					? 'pr-10'
					: ''}"
			/>
			{#if hasSuffix}
				<div class="absolute top-1/2 right-3 -translate-y-1/2">
					<slot name="suffix" />
				</div>
			{/if}
		</div>
	{/if}
</div>
