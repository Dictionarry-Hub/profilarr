<script lang="ts">
	import { alertStore } from './store';
	import Alert from './Alert.svelte';
	import { alertSettingsStore, type AlertPosition } from './settings';
	import { sidebarCollapsed } from '$stores/sidebar';
	import { page } from '$app/stores';

	const positionClasses: Record<AlertPosition, string> = {
		'top-left': 'top-4 left-4',
		'top-center': 'top-4 left-1/2 -translate-x-1/2',
		'top-right': 'top-4 right-4',
		'bottom-left': 'bottom-4 left-4',
		'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
		'bottom-right': 'bottom-4 right-4'
	};

	$: position = positionClasses[$alertSettingsStore.position] ?? positionClasses['top-center'];
	$: isAuthPage = $page.url.pathname.startsWith('/auth/');
</script>

<div
	class="pointer-events-none fixed inset-0 z-[100] transition-[padding-left] duration-200 ease-in-out {isAuthPage
		? ''
		: `pt-16 pb-16 md:pt-0 md:pb-0 ${$sidebarCollapsed ? 'md:pl-10' : 'md:pl-80'}`}"
>
	<div class="relative h-full w-full">
		<div
			class="pointer-events-none absolute flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 {position}"
		>
			{#each $alertStore as alert (alert.id)}
				<div class="pointer-events-auto">
					<Alert id={alert.id} type={alert.type} message={alert.message} />
				</div>
			{/each}
		</div>
	</div>
</div>
