<script lang="ts">
	import '../app.css';
	import logo from '$assets/logo-512.png';
	import Navbar from '$ui/navigation/navbar/navbar.svelte';
	import PageNav from '$ui/navigation/pageNav/pageNav.svelte';
	import BottomNav from '$ui/navigation/bottomNav/BottomNav.svelte';
	import AlertContainer from '$alerts/AlertContainer.svelte';
	import { page } from '$app/stores';
	import { onMount, onDestroy } from 'svelte';
	import { jobStatus } from '$stores/jobStatus';

	export let data;

	// Hide navigation on auth pages (login, setup, etc.)
	$: isAuthPage = $page.url.pathname.startsWith('/auth/');

	onMount(() => {
		if (!isAuthPage) jobStatus.connect();
	});

	onDestroy(() => {
		jobStatus.disconnect();
	});
</script>

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
{/if}
<AlertContainer />

<main class={isAuthPage ? '' : 'pt-16 pb-16 md:pt-0 md:pb-0 md:pl-80'}>
	<slot />
</main>
