<script lang="ts">
	import { themeStore } from '$stores/theme.ts';
	import { MoonStar, Sun } from 'lucide-svelte';

	$: isDark = $themeStore === 'dark';
</script>

<button
	data-onboarding="theme-toggle"
	on:click={() => themeStore.toggle()}
	class="relative flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-800"
	aria-label="Toggle theme"
>
	<!-- Emoji mode -->
	<div
		class="nav-icon-emoji absolute transition-all duration-300 {isDark
			? 'scale-100 rotate-0 opacity-100'
			: 'scale-75 rotate-180 opacity-0'}"
	>
		<span class="text-lg">✨</span>
	</div>
	<div
		class="nav-icon-emoji absolute transition-all duration-300 {isDark
			? 'scale-75 -rotate-180 opacity-0'
			: 'scale-100 rotate-0 opacity-100'}"
	>
		<span class="text-lg">💡</span>
	</div>
	<!-- Lucide icon mode -->
	<div
		class="nav-icon-lucide absolute transition-all duration-300 {isDark
			? 'scale-100 rotate-0 opacity-100'
			: 'scale-75 rotate-180 opacity-0'}"
	>
		<MoonStar class="h-[18px] w-[18px] text-neutral-700 dark:text-neutral-300" />
	</div>
	<div
		class="nav-icon-lucide absolute transition-all duration-300 {isDark
			? 'scale-75 -rotate-180 opacity-0'
			: 'scale-100 rotate-0 opacity-100'}"
	>
		<Sun class="h-[18px] w-[18px] text-neutral-700 dark:text-neutral-300" />
	</div>
</button>
