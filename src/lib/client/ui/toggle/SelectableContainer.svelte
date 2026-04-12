<script lang="ts">
	export let padding: 'none' | 'sm' | 'md' = 'none';

	$: paddingClass = {
		none: '',
		sm: 'p-2',
		md: 'p-4'
	}[padding];
</script>

<div
	class="divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-300 dark:divide-neutral-700/40 dark:border-neutral-700/60 {paddingClass}"
>
	<slot />
</div>
