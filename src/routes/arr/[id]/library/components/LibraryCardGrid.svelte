<script lang="ts">
	export let columns: number = 8;
	export let gap: 'sm' | 'md' | 'lg' = 'md';

	$: desktopColumnCount = Math.max(1, Math.floor(columns));

	const gapClasses = {
		sm: 'gap-2',
		md: 'gap-4',
		lg: 'gap-6'
	};
</script>

<div
	class="library-card-grid grid {gapClasses[gap]}"
	style={`--library-card-grid-columns: ${desktopColumnCount};`}
>
	<slot />
</div>

<style>
	.library-card-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	@media (min-width: 640px) {
		.library-card-grid {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}

	@media (min-width: 1024px) {
		.library-card-grid {
			grid-template-columns: repeat(var(--library-card-grid-columns), minmax(0, 1fr));
		}
	}
</style>
