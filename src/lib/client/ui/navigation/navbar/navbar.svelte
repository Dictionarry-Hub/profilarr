<script lang="ts">
	import AccentPicker from './accentPicker.svelte';
	import ThemeToggle from './themeToggle.svelte';
	import HelpButton from '$ui/help/HelpButton.svelte';
	import { Menu, ChevronLeft, ChevronRight } from 'lucide-svelte';
	import { mobileNavOpen } from '$stores/mobileNav';
	import { sidebarCollapsed } from '$stores/sidebar';
	import { cutscene } from '$lib/client/cutscene/store';
	import logo from '$assets/logo-512.png';

	$: collapsed = $sidebarCollapsed;
	$: cutsceneActive = $cutscene.active;
</script>

<nav
	class="fixed top-0 left-0 z-50 w-full overflow-hidden border-r-0 border-b border-neutral-200 bg-neutral-50 transition-[width,height] duration-200 ease-in-out md:z-[80] md:border-r dark:border-neutral-800 dark:bg-neutral-900
		{collapsed ? 'md:h-screen md:w-10' : 'md:h-16 md:w-80'}"
>
	<!-- Mobile -->
	<div class="flex items-center justify-between gap-3 px-4 py-4 md:hidden">
		<div class="flex items-center gap-2">
			<button
				type="button"
				on:click={() => mobileNavOpen.open()}
				class="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
				aria-label="Open menu"
			>
				<Menu size={20} />
			</button>
		</div>
		<div class="flex items-center justify-end gap-1">
			<AccentPicker />
			<ThemeToggle />
			<HelpButton variant="navbar" />
		</div>
	</div>

	<!-- Desktop expanded -->
	<div
		class="hidden items-center justify-between gap-3 px-4 py-4 whitespace-nowrap transition-opacity duration-150 ease-in-out md:flex
			{collapsed ? 'opacity-0' : 'opacity-100'}"
	>
		<div class="flex items-center gap-2">
			<img src={logo} alt="Profilarr logo" class="ml-4 h-5 w-5 translate-y-[2px]" />
			<div class="text-xl font-bold text-neutral-900 dark:text-neutral-100">profilarr</div>
		</div>
		<div class="flex items-center justify-end gap-1">
			<AccentPicker />
			<ThemeToggle />
			<HelpButton variant="navbar" />
			{#if !cutsceneActive}
				<button
					type="button"
					on:click={() => sidebarCollapsed.collapse()}
					class="cursor-pointer rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
					aria-label="Collapse sidebar"
				>
					<ChevronLeft size={18} />
				</button>
			{/if}
		</div>
	</div>

	<!-- Desktop collapsed: chevron centered in full-height strip -->
	<div
		class="absolute inset-0 hidden items-center justify-center transition-opacity duration-150 ease-in-out md:flex
			{collapsed ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}"
	>
		<button
			type="button"
			on:click={() => sidebarCollapsed.expand()}
			class="cursor-pointer rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
			aria-label="Expand sidebar"
		>
			<ChevronRight size={18} />
		</button>
	</div>
</nav>
