<script lang="ts">
	import '../app.css';
	import '$stores/font';
	import logo from '$assets/logo-512.png';
	import Navbar from '$ui/navigation/navbar/navbar.svelte';
	import PageNav from '$ui/navigation/pageNav/pageNav.svelte';
	import BottomNav from '$ui/navigation/bottomNav/BottomNav.svelte';
	import AlertContainer from '$alerts/AlertContainer.svelte';
	import HelpButton from '$ui/help/HelpButton.svelte';
	import CutsceneOverlay from '$lib/client/cutscene/CutsceneOverlay.svelte';

	import CutsceneComplete from '$lib/client/cutscene/CutsceneComplete.svelte';
	import { cutscene } from '$lib/client/cutscene/store';
	import { FEATURES } from '$lib/shared/features';
	import { dev } from '$app/environment';
	import { page } from '$app/stores';
	import { onMount, onDestroy } from 'svelte';
	import { jobStatus } from '$stores/jobStatus';

	export let data;

	// Hide navigation on auth pages (login, setup, etc.)
	$: isAuthPage = $page.url.pathname.startsWith('/auth/');

	$: cutsceneEnabled = FEATURES.cutscene || dev;

	let innerWidth = 0;
	$: isDesktop = innerWidth >= 768;

	onMount(() => {
		if (!isAuthPage) jobStatus.connect();
		if (!isAuthPage && cutsceneEnabled) cutscene.init(data.onboardingShown);
	});

	onDestroy(() => {
		jobStatus.disconnect();
	});
</script>

<svelte:window bind:innerWidth />

<svelte:head>
	<link rel="icon" href={logo} />
	<title>Profilarr</title>
</svelte:head>

{#if !isAuthPage}
	<Navbar />
	<PageNav
		version={data.version}
		arrInstances={data.arrInstances}
		databases={data.databases}
		parserAvailable={data.parserAvailable}
	/>
	<BottomNav />
	<HelpButton />
	{#if cutsceneEnabled && isDesktop}
		<CutsceneOverlay />
		<CutsceneComplete />
	{/if}
{/if}
<AlertContainer />

<main class={isAuthPage ? '' : 'pt-16 pb-16 md:pt-0 md:pb-0 md:pl-80'}>
	<slot />
</main>
