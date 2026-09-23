<script lang="ts">
	import { resolve } from '$app/paths';
	import Group from './group.svelte';
	import GroupItem from './groupItem.svelte';
	import Version from './version.svelte';
	import JobStatus from './jobStatus.svelte';
	import { jobStatus } from '$stores/jobStatus';
	import { fade } from 'svelte/transition';
	import {
		FolderTree,
		Link,
		Sliders,
		Palette,
		Microscope,
		Tag,
		Clock,
		Settings,
		X,
		Wrench,
		Film,
		Tv,
		Megaphone
	} from '@lucide/svelte';
	import { mobileNavOpen } from '$stores/mobileNav';
	import { sidebarCollapsed } from '$stores/sidebar';
	import { page } from '$app/stores';
	import logo from '$assets/logo-512.png';
	import radarrLogo from '$assets/Radarr.svg';
	import sonarrLogo from '$assets/Sonarr.svg';

	export let arrInstances: { id: number; name: string; type: string }[] = [];
	export let databases: { id: number; name: string }[] = [];
	export let parserAvailable: boolean = true;
	export let unreadAnnouncements: number = 0;

	// Close mobile nav when page changes
	$: ($page.url.pathname, mobileNavOpen.close());

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && $mobileNavOpen) mobileNavOpen.close();
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- Mobile backdrop -->
{#if $mobileNavOpen}
	<button
		type="button"
		class="fixed inset-0 z-[60] bg-black/50 md:hidden"
		on:click={() => mobileNavOpen.close()}
		aria-label="Close menu"
	></button>
{/if}

<nav
	data-onboarding="sidebar"
	class="fixed top-0 left-0 z-[70] flex h-full w-[90vw] flex-col border-r border-neutral-200 bg-neutral-50 transition-transform duration-200 ease-in-out dark:border-neutral-800 dark:bg-neutral-900
		{$mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}
		md:top-16 md:h-[calc(100vh-4rem)] md:w-80
		{$sidebarCollapsed ? 'md:-translate-x-full' : 'md:translate-x-0'}"
>
	<!-- Mobile header with logo and close button -->
	<div
		class="flex items-center justify-between border-b border-neutral-200 py-4 pr-4 pl-8 md:hidden dark:border-neutral-800"
	>
		<div class="flex items-center gap-2">
			<img src={logo} alt="Profilarr logo" class="h-5 w-5" />
			<span class="text-xl font-bold text-neutral-900 dark:text-neutral-100">profilarr</span>
		</div>
		<button
			type="button"
			on:click={() => mobileNavOpen.close()}
			class="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
			aria-label="Close menu"
		>
			<X size={20} />
		</button>
	</div>

	<div class="flex-1 overflow-y-auto p-4">
		{#if import.meta.env.DEV}
			<Group
				label="Dev"
				emoji="🛠️"
				href={resolve('/dev')}
				icon={Wrench}
				initialOpen={true}
				hasItems={true}
			>
				<GroupItem label="Components" href={resolve('/dev/components')} />
				<GroupItem label="API Docs" href={resolve('/dev/api')} />
			</Group>
		{/if}

		<Group
			label="Announcements"
			emoji="📣"
			href={resolve('/announcements')}
			icon={Megaphone}
			alert={unreadAnnouncements}
		/>

		<Group
			label="Databases"
			emoji="📦"
			href={resolve('/databases')}
			icon={FolderTree}
			hasItems={databases.length > 0}
			initialOpen={true}
			onboardingId="nav-databases"
		>
			{#each databases as db (db.id)}
				<GroupItem label={db.name} href={resolve(`/databases/${db.id}`)} />
			{/each}
		</Group>

		<Group
			label="Arrs"
			emoji="🔗"
			href={resolve('/arr')}
			icon={Link}
			hasItems={arrInstances.length > 0}
			initialOpen={true}
			onboardingId="nav-arrs"
		>
			{#each arrInstances as instance (instance.id)}
				<GroupItem
					label={instance.name}
					href={resolve(`/arr/${instance.id}`)}
					icon={instance.type === 'radarr' ? Film : Tv}
					iconSrc={instance.type === 'radarr' ? radarrLogo : sonarrLogo}
				/>
			{/each}
		</Group>

		<div data-onboarding="nav-config-entities">
			<Group
				label="Quality Profiles"
				emoji="⚡"
				href={resolve('/quality-profiles')}
				icon={Sliders}
				initialOpen={true}
				hasItems={parserAvailable}
				onboardingId="nav-quality-profiles"
			>
				{#if parserAvailable}
					<GroupItem label="Testing" href={resolve('/quality-profiles/entity-testing')} />
				{/if}
			</Group>

			<Group
				label="Custom Formats"
				emoji="🎨"
				href={resolve('/custom-formats')}
				icon={Palette}
				initialOpen={false}
				onboardingId="nav-custom-formats"
			/>

			<Group
				label="Regular Expressions"
				emoji="🔬"
				href={resolve('/regular-expressions')}
				icon={Microscope}
				initialOpen={false}
				onboardingId="nav-regex"
			/>

			<Group
				label="Media Management"
				emoji="🏷️"
				href={resolve('/media-management')}
				icon={Tag}
				initialOpen={true}
				hasItems={true}
				onboardingId="nav-media-management"
			>
				<GroupItem
					label="Naming Settings"
					href={resolve('/media-management?section=naming')}
					activePattern="/naming"
				/>
				<GroupItem
					label="Quality Definitions"
					href={resolve('/media-management?section=quality-definitions')}
					activePattern="/quality-definitions"
				/>
				<GroupItem
					label="Media Settings"
					href={resolve('/media-management?section=media-settings')}
					activePattern="/media-settings"
				/>
			</Group>

			<Group
				label="Delay Profiles"
				emoji="⏳"
				href={resolve('/delay-profiles')}
				icon={Clock}
				initialOpen={false}
				onboardingId="nav-delay-profiles"
			/>
		</div>

		<Group
			label="Settings"
			emoji="⚙️"
			href={resolve('/settings')}
			icon={Settings}
			initialOpen={true}
			hasItems={true}
			onboardingId="nav-settings"
		>
			<GroupItem label="General" href={resolve('/settings/general')} />
			<GroupItem label="Jobs" href={resolve('/settings/jobs')} />
			<GroupItem label="Logs" href={resolve('/settings/logs')} />
			<GroupItem label="Backups" href={resolve('/settings/backups')} />
			<GroupItem label="Notifications" href={resolve('/settings/notifications')} />
			<GroupItem label="Security" href={resolve('/settings/security')} />
			<GroupItem label="Onboarding" href={resolve('/onboarding')} onboardingId="nav-onboarding" />
			<GroupItem label="About" href={resolve('/settings/about')} />
			<GroupItem
				label="Log Out"
				href={resolve('/auth/logout')}
				onclick={(e) => {
					e.preventDefault();
					fetch(resolve('/auth/logout'), { method: 'POST' }).then(() => {
						window.location.href = resolve('/auth/login');
					});
				}}
			/>
		</Group>

		<!-- Version scrolls with content on mobile (job status shown in bottom nav) -->
		<div class="mt-2 md:hidden">
			<Version />
		</div>
	</div>

	<!-- Version + job status pinned to bottom on desktop only -->
	<div class="hidden shrink-0 p-4 md:block">
		{#if $jobStatus.state !== 'idle'}
			<div transition:fade={{ duration: 150 }}>
				<JobStatus />
			</div>
		{/if}
		<Version />
	</div>
</nav>
