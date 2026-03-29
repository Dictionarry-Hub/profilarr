<script lang="ts">
	import AccentPicker from './accentPicker.svelte';
	import ThemeToggle from './themeToggle.svelte';
	import HelpButton from '$ui/help/HelpButton.svelte';
	import { Menu } from 'lucide-svelte';
	import { mobileNavOpen } from '$stores/mobileNav';
	import logo from '$assets/logo-512.png';
	import { alertStore } from '$alerts/store';
	import MobileNavAlert from '$alerts/MobileNavAlert.svelte';

	$: latestAlert = $alertStore.length > 0 ? $alertStore[$alertStore.length - 1] : null;
</script>

<nav
	class="fixed top-0 left-0 z-50 w-full border-r-0 border-b border-neutral-200 bg-neutral-50 md:z-[80] md:w-80 md:border-r dark:border-neutral-800 dark:bg-neutral-900"
>
	<div class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-4">
		<!-- Left: Hamburger (mobile) + Brand name with logo (desktop) -->
		<div class="flex items-center gap-2">
			<button
				type="button"
				on:click={() => mobileNavOpen.open()}
				class="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700 md:hidden dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
				aria-label="Open menu"
			>
				<Menu size={20} />
			</button>
			<img
				src={logo}
				alt="Profilarr logo"
				class="hidden h-5 w-5 translate-y-[2px] md:ml-4 md:block"
			/>
			<div class="hidden text-xl font-bold text-neutral-900 md:block dark:text-neutral-100">
				profilarr
			</div>
		</div>

		<!-- Center: Mobile alerts -->
		<div class="flex min-w-0 justify-center md:hidden">
			{#if latestAlert}
				<MobileNavAlert id={latestAlert.id} type={latestAlert.type} message={latestAlert.message} />
			{/if}
		</div>

		<!-- Right: Accent picker and Theme toggle -->
		<div class="flex items-center justify-end gap-1">
			<AccentPicker />
			<ThemeToggle />
			<HelpButton variant="navbar" />
		</div>
	</div>
</nav>
