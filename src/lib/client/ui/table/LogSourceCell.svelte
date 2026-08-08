<script lang="ts">
	import Label from '$ui/label/Label.svelte';

	export let row: { source?: string | null; logger?: string | null };

	$: source = row.source || row.logger || '-';
</script>

<Label variant="secondary" size="sm" rounded="md" mono>
	{source}
</Label>
