<script lang="ts">
	import { Bold, Italic, List, ListOrdered, Link, Code, Eye, Edit3 } from 'lucide-svelte';
	import { marked } from 'marked';
	import { sanitizeHtml } from '$shared/utils/sanitize';

	// Props
	export let value: string = '';
	export let placeholder: string = '';
	export let label: string = '';
	export let description: string = '';
	export let rows: number = 8;
	export let multiline: boolean = true;
	export let markdown: boolean = true;
	export let required: boolean = false;
	export let disabled: boolean = false;
	export let name: string = '';
	export let id: string = name;
	export let onchange: ((value: string) => void) | undefined = undefined;

	// State
	let showPreview = false;
	let textareaElement: HTMLTextAreaElement;
	let inputElement: HTMLInputElement;

	$: stateClass = disabled
		? 'bg-neutral-100 text-neutral-500 cursor-not-allowed dark:bg-neutral-800/40 dark:text-neutral-500'
		: 'bg-white focus:border-neutral-400 dark:bg-neutral-800/50 dark:focus:border-neutral-600';

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement | HTMLTextAreaElement;
		value = target.value;
		onchange?.(value);
	}

	function insertMarkdown(before: string, after: string = '') {
		const element = multiline ? textareaElement : inputElement;
		if (!element) return;

		const start = element.selectionStart ?? 0;
		const end = element.selectionEnd ?? 0;
		const selectedText = value.substring(start, end);

		const newValue =
			value.substring(0, start) + before + selectedText + after + value.substring(end);

		value = newValue;
		onchange?.(value);

		// Restore cursor position
		requestAnimationFrame(() => {
			element.focus();
			element.setSelectionRange(start + before.length, start + before.length + selectedText.length);
		});
	}

	function insertBold() {
		insertMarkdown('**', '**');
	}

	function insertItalic() {
		insertMarkdown('*', '*');
	}

	function insertCode() {
		insertMarkdown('`', '`');
	}

	function insertLink() {
		const element = multiline ? textareaElement : inputElement;
		if (!element) return;

		const start = element.selectionStart ?? 0;
		const end = element.selectionEnd ?? 0;
		const selectedText = value.substring(start, end);

		if (selectedText) {
			insertMarkdown('[', '](url)');
		} else {
			insertMarkdown('[link text](url)');
		}
	}

	function insertList() {
		const element = multiline ? textareaElement : inputElement;
		if (!element) return;

		const start = element.selectionStart ?? 0;
		const lines = value.substring(0, start).split('\n');
		const isStartOfLine = lines[lines.length - 1].length === 0 || start === 0;

		if (isStartOfLine) {
			insertMarkdown('- ');
		} else {
			insertMarkdown('\n- ');
		}
	}

	function insertOrderedList() {
		const element = multiline ? textareaElement : inputElement;
		if (!element) return;

		const start = element.selectionStart ?? 0;
		const lines = value.substring(0, start).split('\n');
		const isStartOfLine = lines[lines.length - 1].length === 0 || start === 0;

		if (isStartOfLine) {
			insertMarkdown('1. ');
		} else {
			insertMarkdown('\n1. ');
		}
	}

	// Markdown to HTML renderer for preview using marked
	function renderMarkdown(text: string): string {
		if (!text)
			return '<p class="text-neutral-400 dark:text-neutral-500 italic">Nothing to preview</p>';
		return sanitizeHtml(marked.parse(text) as string); // nosemgrep: profilarr.xss.marked-unsanitized
	}

	const toolbarButtons = [
		{ action: insertBold, icon: Bold, title: 'Bold (Ctrl+B)', shortcut: 'b' },
		{ action: insertItalic, icon: Italic, title: 'Italic (Ctrl+I)', shortcut: 'i' },
		{ action: insertCode, icon: Code, title: 'Code', shortcut: null },
		{ action: insertLink, icon: Link, title: 'Link', shortcut: null },
		{ action: insertList, icon: List, title: 'Bullet List', shortcut: null },
		{ action: insertOrderedList, icon: ListOrdered, title: 'Numbered List', shortcut: null }
	];

	function handleKeydown(e: KeyboardEvent) {
		if (!markdown) return;

		if (e.ctrlKey || e.metaKey) {
			switch (e.key.toLowerCase()) {
				case 'b':
					e.preventDefault();
					insertBold();
					break;
				case 'i':
					e.preventDefault();
					insertItalic();
					break;
			}
		}
	}
</script>

<div class="space-y-2">
	{#if label}
		<label for={id} class="block text-sm font-medium text-neutral-900 dark:text-neutral-100">
			{label}
			{#if required}
				<span class="text-red-500">*</span>
			{/if}
		</label>
	{/if}

	{#if description}
		<p class="text-xs text-neutral-600 dark:text-neutral-400">
			{description}
		</p>
	{/if}

	<!-- Input container - no gap between toolbar and input -->
	<div>
		{#if markdown}
			<!-- Toolbar -->
			<div
				class="flex items-center justify-between rounded-t-xl border border-neutral-300 bg-neutral-50/80 px-2 py-1 dark:border-neutral-700/60 dark:bg-neutral-800/40 {showPreview
					? 'border-b-0'
					: ''}"
			>
				<div class="flex items-center gap-1">
					{#each toolbarButtons as btn}
						<button
							type="button"
							onclick={btn.action}
							title={btn.title}
							disabled={disabled || showPreview}
							class="rounded-md p-1.5 text-neutral-600 transition-colors hover:bg-neutral-200 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-100"
						>
							<svelte:component this={btn.icon} size={16} />
						</button>
					{/each}
				</div>
				<button
					type="button"
					onclick={() => (showPreview = !showPreview)}
					title={showPreview ? 'Edit' : 'Preview'}
					class="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors {showPreview
						? 'bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100'
						: 'text-neutral-600 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-700'}"
				>
					{#if showPreview}
						<Edit3 size={14} />
						Edit
					{:else}
						<Eye size={14} />
						Preview
					{/if}
				</button>
			</div>
		{/if}

		{#if showPreview && markdown}
			<!-- Preview -->
			<div
				class="prose prose-sm max-w-none rounded-b-xl border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700/60 dark:bg-neutral-800/50 dark:text-neutral-100"
			>
				<!-- nosemgrep: profilarr.xss.at-html-usage -->
				{@html renderMarkdown(value)}
			</div>
			{#if name}
				<input type="hidden" {name} {value} />
			{/if}
		{:else if multiline}
			<!-- Textarea -->
			<textarea
				bind:this={textareaElement}
				{id}
				{name}
				{value}
				{placeholder}
				{rows}
				{disabled}
				{required}
				oninput={handleInput}
				onkeydown={handleKeydown}
				class="{markdown
					? 'rounded-t-none rounded-b-xl border-t-0'
					: 'rounded-xl'} block w-full border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 transition-colors focus:outline-none dark:border-neutral-700/60 dark:text-neutral-50 dark:placeholder-neutral-500 {stateClass}"
			></textarea>
		{:else}
			<!-- Single-line input -->
			<input
				bind:this={inputElement}
				type="text"
				{id}
				{name}
				{value}
				{placeholder}
				{disabled}
				{required}
				oninput={handleInput}
				onkeydown={handleKeydown}
				class="{markdown
					? 'rounded-t-none rounded-b-xl border-t-0'
					: 'rounded-xl'} block w-full border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 transition-colors focus:outline-none dark:border-neutral-700/60 dark:text-neutral-50 dark:placeholder-neutral-500 {stateClass}"
			/>
		{/if}
	</div>
</div>
