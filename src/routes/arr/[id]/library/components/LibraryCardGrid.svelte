<script lang="ts">
	export let columns: number = 8;
	export let gap: 'sm' | 'md' | 'lg' = 'md';

	// Derive a minimum card width from the desired column count.
	// Cards will shrink to fewer columns naturally when the viewport is too narrow (e.g. zoom).
	$: minCardWidth = Math.max(100, Math.floor(1200 / Math.max(1, Math.floor(columns))));

	const gapClasses = {
		sm: 'gap-2',
		md: 'gap-4',
		lg: 'gap-6'
	};
</script>

<div
	class="library-card-grid grid {gapClasses[gap]}"
	style={`--library-card-min-width: ${minCardWidth}px;`}
>
	<slot />
</div>

<style>
	.library-card-grid {
		grid-template-columns: repeat(auto-fill, minmax(var(--library-card-min-width), 1fr));
	}
</style>
