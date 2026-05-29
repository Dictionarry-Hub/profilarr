<script lang="ts">
	export let className: string = '';
	export let onboarding: string | undefined = undefined;
</script>

<div
	class="actions-bar mx-auto flex w-full justify-center md:mx-0 md:w-auto {className}"
	data-onboarding={onboarding}
>
	<slot />
</div>

<style>
	.actions-bar :global(> *:not(:first-child)) {
		margin-left: -1px;
	}

	.actions-bar :global(> * > *) {
		border-radius: 0 !important;
	}

	.actions-bar :global(> * > button) {
		border-radius: 0 !important;
	}

	.actions-bar :global(> * > * > button) {
		border-radius: 0 !important;
	}

	.actions-bar :global(> *:first-child > *) {
		border-top-left-radius: var(--theme-radius-control) !important;
		border-bottom-left-radius: var(--theme-radius-control) !important;
	}

	.actions-bar :global(> *:first-child > button) {
		border-top-left-radius: var(--theme-radius-control) !important;
		border-bottom-left-radius: var(--theme-radius-control) !important;
	}

	.actions-bar :global(> *:first-child > * > button) {
		border-top-left-radius: var(--theme-radius-control) !important;
		border-bottom-left-radius: var(--theme-radius-control) !important;
	}

	.actions-bar :global(> *:last-child > *) {
		border-top-right-radius: var(--theme-radius-control) !important;
		border-bottom-right-radius: var(--theme-radius-control) !important;
	}

	.actions-bar :global(> *:last-child > button) {
		border-top-right-radius: var(--theme-radius-control) !important;
		border-bottom-right-radius: var(--theme-radius-control) !important;
	}

	.actions-bar :global(> *:last-child > * > button) {
		border-top-right-radius: var(--theme-radius-control) !important;
		border-bottom-right-radius: var(--theme-radius-control) !important;
	}

	.actions-bar :global(> *:only-child > *) {
		border-radius: var(--theme-radius-control) !important;
	}
</style>
