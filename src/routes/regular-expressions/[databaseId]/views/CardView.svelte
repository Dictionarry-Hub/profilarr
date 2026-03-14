<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { RegularExpressionWithTags } from '$shared/pcd/display';
	import { ExternalLink, Copy, Download } from 'lucide-svelte';
	import { page } from '$app/stores';
	import CardGrid from '$ui/card/CardGrid.svelte';
	import Card from '$ui/card/Card.svelte';
	import Button from '$ui/button/Button.svelte';
	import Label from '$ui/label/Label.svelte';
	import CodeBlock from '$ui/display/CodeBlock.svelte';
	import Markdown from '$ui/display/Markdown.svelte';
	import { createProgressiveList } from '$lib/client/utils/progressiveList';
	import { FEATURES } from '$shared/features.ts';

	export let expressions: RegularExpressionWithTags[];

	const dispatch = createEventDispatcher<{ clone: { name: string }; export: { name: string } }>();

	$: databaseId = $page.params.databaseId;

	const { visibleCount, sentinel, reset, setTotalCount } = createProgressiveList({ pageSize: 30 });
	$: setTotalCount(expressions.length);
	$: (expressions, reset());
	$: visibleExpressions = expressions.slice(0, $visibleCount);
</script>

<CardGrid flush>
	{#each visibleExpressions as expression (expression.id)}
		<Card href="/regular-expressions/{databaseId}/{expression.id}" hoverable>
			<svelte:fragment slot="header">
				<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
				<div class="flex items-end justify-between gap-2">
					<div class="flex min-w-0 flex-wrap items-center gap-1.5">
						<h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
							{expression.name}
						</h3>
						{#each expression.tags as tag}
							<Label variant="info" size="sm" rounded="md">{tag.name}</Label>
						{/each}
					</div>
					<div class="flex shrink-0 items-center gap-0.5" on:click|stopPropagation|preventDefault>
						{#if expression.regex101_id}
							<Button
								icon={ExternalLink}
								size="xs"
								variant="ghost"
								tooltip="View on regex101"
								on:click={() =>
									window.open(`https://regex101.com/r/${expression.regex101_id}`, '_blank')}
							/>
						{/if}
						{#if FEATURES.importExport}
							<Button
								icon={Download}
								size="xs"
								variant="ghost"
								tooltip="Export"
								on:click={() => dispatch('export', { name: expression.name })}
							/>
						{/if}
						<Button
							icon={Copy}
							size="xs"
							variant="ghost"
							tooltip="Clone"
							on:click={() => dispatch('clone', { name: expression.name })}
						/>
					</div>
				</div>
			</svelte:fragment>

			<div class="space-y-3">
				<CodeBlock code={expression.pattern} />
				{#if expression.description}
					<Markdown content={expression.description} />
				{/if}
			</div>
		</Card>
	{/each}
</CardGrid>
<div use:sentinel></div>
