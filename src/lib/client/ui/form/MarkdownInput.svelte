<script lang="ts">
	import { Bold, Italic, List, ListOrdered, Link, Code, Eye, Edit3 } from 'lucide-svelte';
	import { marked } from 'marked';
	import { sanitizeHtml } from '$shared/utils/sanitize';
	import Button from '$ui/button/Button.svelte';

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

	$: stateClass = disabled ? 'bg-surface text-text-muted cursor-not-allowed' : 'bg-surface';

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
		if (!text) return '<p class="text-text-subtle italic">Nothing to preview</p>';
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
		<label for={id} class="block text-sm font-medium text-text">
			{label}
			{#if required}
				<span class="text-danger-solid">*</span>
			{/if}
		</label>
	{/if}

	{#if description}
		<p class="text-xs text-text-muted">
			{description}
		</p>
	{/if}

	<!-- Input container - no gap between toolbar and input -->
	<div>
		{#if markdown}
			<!-- Toolbar -->
			<div
				class="flex items-center justify-between rounded-t-card border border-border bg-surface px-3 py-2 {showPreview
					? 'border-b-0'
					: ''}"
			>
				<div class="flex items-center gap-1">
					{#each toolbarButtons as btn}
						<Button
							icon={btn.icon}
							size="sm"
							variant="ghost"
							disabled={disabled || showPreview}
							on:click={btn.action}
						/>
					{/each}
				</div>
				<Button
					icon={showPreview ? Edit3 : Eye}
					text={showPreview ? 'Edit' : 'Preview'}
					size="xs"
					variant="secondary"
					on:click={() => (showPreview = !showPreview)}
				/>
			</div>
		{/if}

		{#if showPreview && markdown}
			<!-- Preview -->
			<div
				class="prose prose-sm max-w-none rounded-b-card border border-border bg-surface px-3 py-2 text-text"
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
					? 'rounded-t-none rounded-bl-card border-t-0'
					: 'rounded-tl-card rounded-tr-card rounded-bl-card'} block w-full border border-border px-3 py-2 text-sm text-text placeholder-text-subtle transition-colors focus:outline-none {stateClass}"
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
					? 'rounded-t-none rounded-bl-card border-t-0'
					: 'rounded-tl-card rounded-tr-card rounded-bl-card'} block w-full border border-border px-3 py-2 text-sm text-text placeholder-text-subtle transition-colors focus:outline-none {stateClass}"
			/>
		{/if}
	</div>
</div>
