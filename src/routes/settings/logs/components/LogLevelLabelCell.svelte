<script lang="ts">
	import Label from '$ui/label/Label.svelte';

	export let row: { level: string };

	const levelLabelClasses: Record<string, string> = {
		DEBUG: 'bg-info-bg text-info-text',
		INFO: 'bg-success-bg text-success-text',
		WARN: 'bg-warning-bg text-warning-text',
		ERROR: 'bg-danger-bg text-danger-text'
	};

	$: labelClasses = levelLabelClasses[row.level] || 'bg-surface-hover text-text-soft';
</script>

<Label customVariant={labelClasses} size="sm" radius="md">
	{row.level}
</Label>
