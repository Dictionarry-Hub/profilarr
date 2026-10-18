<script lang="ts">
	import Label from '$ui/label/Label.svelte';
	import type { PageData } from '../$types';

	type Row = PageData['localChanges']['rows'][number];

	export let row: Row;
	export let display: (value: Row['upstream']) => string;

	const STATUS: Record<
		Row['status'],
		{ label: string; variant: 'secondary' | 'warning' | 'info' | 'outline' }
	> = {
		applied: { label: 'Applied', variant: 'secondary' },
		pending: { label: 'Not Applied', variant: 'warning' },
		overridden: { label: 'Re-Applied', variant: 'info' },
		related: { label: 'Format Deleted', variant: 'outline' }
	};
</script>

<div class="flex flex-col items-start gap-1">
	<Label variant={STATUS[row.status].variant} size="md" rounded="md">
		{STATUS[row.status].label}
	</Label>
	{#if row.status === 'pending'}
		<span class="text-xs text-neutral-500 dark:text-neutral-400">
			wanted {row.pendingValue == null ? 'unset' : display(row.pendingValue)}
		</span>
	{/if}
</div>
