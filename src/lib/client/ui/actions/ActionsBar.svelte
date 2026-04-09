<script lang="ts">
	export let className: string = '';
</script>

<div class="actions-bar mx-auto flex w-full justify-center md:mx-0 md:w-auto {className}">
	<slot />
</div>

<style>
	.actions-bar :global(> *:not(:first-child)) {
		margin-left: -1px;
	}

	/* Reset rounding for grouped items, then re-apply for edges */
	.actions-bar :global(> * > *) {
		border-radius: 0 !important;
	}

	.actions-bar :global(> * > button) {
		border-radius: 0 !important;
	}

	.actions-bar :global(> * > * > button) {
		border-radius: 0 !important;
	}

	/* Apply rounding to the actual bordered elements inside first/last children */
	.actions-bar :global(> *:first-child > *) {
		border-top-left-radius: 0.75rem !important;
		border-bottom-left-radius: 0.75rem !important;
	}

	.actions-bar :global(> *:first-child > button) {
		border-top-left-radius: 0.75rem !important;
		border-bottom-left-radius: 0.75rem !important;
	}

	.actions-bar :global(> *:first-child > * > button) {
		border-top-left-radius: 0.75rem !important;
		border-bottom-left-radius: 0.75rem !important;
	}

	.actions-bar :global(> *:last-child > *) {
		border-top-right-radius: 0.75rem !important;
		border-bottom-right-radius: 0.75rem !important;
	}

	.actions-bar :global(> *:last-child > button) {
		border-top-right-radius: 0.75rem !important;
		border-bottom-right-radius: 0.75rem !important;
	}

	.actions-bar :global(> *:last-child > * > button) {
		border-top-right-radius: 0.75rem !important;
		border-bottom-right-radius: 0.75rem !important;
	}

	.actions-bar :global(> *:only-child > *) {
		border-radius: 0.75rem !important;
	}
</style>
