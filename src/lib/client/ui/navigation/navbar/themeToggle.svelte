<script lang="ts">
	import { onMount } from 'svelte';
	import { themeStore } from '$stores/theme.ts';
	import {
		isThemePreference,
		themeDefinitions,
		type ThemePreference
	} from '$lib/client/themes/registry.ts';
	import DropdownSelect from '$ui/dropdown/DropdownSelect.svelte';

	export let onboarding: string | undefined = undefined;

	let mounted = false;
	let selectedPreference: ThemePreference = 'system';

	onMount(() => {
		selectedPreference = themeStore.getPreference();
		mounted = true;
	});

	$: options = themeDefinitions.map((theme) => ({
		value: theme.value,
		label: theme.label,
		shortLabel: '',
		description: theme.description,
		icon: theme.icon
	}));

	function select(preference: string) {
		if (!isThemePreference(preference)) return;
		selectedPreference = preference;
		themeStore.setPreference(preference);
	}
</script>

<div class="theme-picker" data-onboarding={onboarding}>
	{#if mounted}
		<DropdownSelect
			value={selectedPreference}
			{options}
			position="middle"
			mobilePosition="right"
			minWidth="12rem"
			fixed
			buttonSize="md"
			showText={false}
			showChevron={false}
			on:change={(e) => select(e.detail)}
		/>
	{/if}
</div>
