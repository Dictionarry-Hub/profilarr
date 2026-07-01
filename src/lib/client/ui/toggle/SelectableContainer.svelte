<script lang="ts">
	export let padding: 'none' | 'sm' | 'md' = 'none';

	$: paddingClass = {
		none: '',
		sm: 'p-2',
		md: 'p-4'
	}[padding];
</script>

<div
	class="divide-y divide-border overflow-hidden rounded-card border border-border {paddingClass}"
>
	<slot />
</div>
