<script lang="ts">
	import { CircleAlert, Clock3, FileQuestion } from '@lucide/svelte';
	import Badge from '$ui/badge/Badge.svelte';

	export let hasFile: boolean;
	export let status: string | undefined = undefined;

	$: availability =
		status === 'released'
			? { label: 'Missing', variant: 'danger' as const, icon: CircleAlert }
			: status === 'inCinemas' || status === 'announced' || status === 'tba'
				? { label: 'Pending', variant: 'info' as const, icon: Clock3 }
				: { label: 'No File', variant: 'neutral' as const, icon: FileQuestion };
</script>

{#if !hasFile}
	<Badge variant={availability.variant} icon={availability.icon}>{availability.label}</Badge>
{/if}
