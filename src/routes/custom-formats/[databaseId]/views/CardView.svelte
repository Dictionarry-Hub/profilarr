<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { CustomFormatTableRow } from '$shared/pcd/display.ts';
	import { FlaskConical, Copy, Download } from 'lucide-svelte';
	import { marked } from 'marked';
	import { sanitizeHtml } from '$shared/utils/sanitize';
	import { page } from '$app/stores';
	import { sortConditions } from '$shared/pcd/conditions';
	import CardGrid from '$ui/card/CardGrid.svelte';
	import Card from '$ui/card/Card.svelte';
	import Label from '$ui/label/Label.svelte';
	import Button from '$ui/button/Button.svelte';
	import { createProgressiveList } from '$lib/client/utils/progressiveList';
	import { FEATURES } from '$shared/features.ts';

	export let formats: CustomFormatTableRow[];

	const dispatch = createEventDispatcher<{ clone: { name: string }; export: { name: string } }>();

	$: databaseId = $page.params.databaseId;

	const { visibleCount, sentinel, reset, setTotalCount } = createProgressiveList({ pageSize: 30 });
	$: setTotalCount(formats.length);
	$: formats, reset();
	$: visibleFormats = formats.slice(0, $visibleCount);

	function parseMarkdown(text: string | null): string {
		if (!text) return '';
		return sanitizeHtml(marked.parseInline(text) as string); // nosemgrep: profilarr.xss.marked-unsanitized
	}

	function getConditionVariant(
		condition: CustomFormatTableRow['conditions'][number]
	): 'danger' | 'success' | 'warning' | 'secondary' {
		if (condition.required && condition.negate) return 'danger';
		if (condition.required) return 'success';
		if (condition.negate) return 'warning';
		return 'secondary';
	}
</script>

<CardGrid flush>
	{#each visibleFormats as format}
		<Card href="/custom-formats/{databaseId}/{format.id}" hoverable>
			<svelte:fragment slot="header">
				<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
				<div class="flex items-end justify-between gap-2">
					<h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
						{format.name}
					</h3>
					<div class="flex shrink-0 items-center gap-0.5" on:click|stopPropagation|preventDefault>
						{#if format.testCount > 0}
							<div
								class="flex items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
								title="{format.testCount} test{format.testCount !== 1 ? 's' : ''}"
							>
								<FlaskConical size={12} />
								<span>{format.testCount}</span>
							</div>
						{/if}
						{#if FEATURES.importExport}
							<Button
								icon={Download}
								size="xs"
								variant="ghost"
								tooltip="Export"
								on:click={() => dispatch('export', { name: format.name })}
							/>
						{/if}
						<Button
							icon={Copy}
							size="xs"
							variant="ghost"
							tooltip="Clone"
							on:click={() => dispatch('clone', { name: format.name })}
						/>
					</div>
				</div>
			</svelte:fragment>

			<div class="space-y-3">
				{#if format.tags.length > 0}
					<div class="flex flex-wrap gap-1">
						{#each format.tags as tag}
							<Label variant="info" size="sm" rounded="md">{tag.name}</Label>
						{/each}
					</div>
				{/if}

				<!-- Description -->
				{#if format.description}
					<div class="prose-inline line-clamp-2 text-xs text-neutral-600 dark:text-neutral-400">
						{@html parseMarkdown(format.description)}<!-- nosemgrep: profilarr.xss.at-html-usage -->
					</div>
				{:else}
					<div class="text-xs text-neutral-400 italic dark:text-neutral-500">No description</div>
				{/if}

				<!-- Conditions -->
				{#if format.conditions.length > 0}
					<div class="flex flex-wrap gap-1">
						{#each sortConditions(format.conditions) as condition}
							<Label variant={getConditionVariant(condition)} size="sm" rounded="md" mono
								>{condition.name}</Label
							>
						{/each}
					</div>
				{:else}
					<div class="text-xs text-neutral-400">None</div>
				{/if}
			</div>
		</Card>
	{/each}
</CardGrid>
<div use:sentinel></div>

<style>
	:global(.prose-inline code) {
		background-color: rgb(229 231 235);
		padding: 0.125rem 0.25rem;
		border-radius: 0.25rem;
		font-size: 0.75rem;
		font-family: ui-monospace, monospace;
	}

	:global(.dark .prose-inline code) {
		background-color: rgb(38 38 38);
	}

	:global(.prose-inline strong) {
		font-weight: 600;
	}

	:global(.prose-inline a) {
		color: rgb(var(--color-accent-600));
		text-decoration: underline;
	}

	:global(.dark .prose-inline a) {
		color: rgb(var(--color-accent-400));
	}
</style>
