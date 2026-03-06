<script lang="ts">
	import { Sliders, ShieldCheck, Bell, Clock, FileText, Archive, Info } from 'lucide-svelte';

	const settingsItems = [
		{
			label: 'General',
			href: '/settings/general',
			description: 'Application defaults, preferences, and behaviors',
			icon: Sliders,
			iconClass: 'text-blue-600 dark:text-blue-400'
		},
		{
			label: 'Security',
			href: '/settings/security',
			description: 'Access control and sensitive operations',
			icon: ShieldCheck,
			iconClass: 'text-rose-600 dark:text-rose-400'
		},
		{
			label: 'Notifications',
			href: '/settings/notifications',
			description: 'Alerts, webhooks, and delivery settings',
			icon: Bell,
			iconClass: 'text-amber-600 dark:text-amber-400'
		},
		{
			label: 'Jobs',
			href: '/settings/jobs',
			description: 'Scheduled tasks and automation workflows',
			icon: Clock,
			iconClass: 'text-emerald-600 dark:text-emerald-400'
		},
		{
			label: 'Logs',
			href: '/settings/logs',
			description: 'System logs and error history',
			icon: FileText,
			iconClass: 'text-neutral-700 dark:text-neutral-300'
		},
		{
			label: 'Backups',
			href: '/settings/backups',
			description: 'Snapshots, restore, and retention',
			icon: Archive,
			iconClass: 'text-blue-600 dark:text-blue-400'
		},
		{
			label: 'About',
			href: '/settings/about',
			description: 'Build info, status, and diagnostics',
			icon: Info,
			iconClass: 'text-neutral-700 dark:text-neutral-300'
		}
	];
</script>

<div class="px-4 pt-4 pb-8 md:px-8">
	<div class="mb-8">
		<h1 class="text-2xl font-semibold text-neutral-900 md:text-3xl dark:text-neutral-50">
			Settings
		</h1>
		<p class="mt-2 text-sm text-neutral-600 md:text-base dark:text-neutral-400">
			Configure and manage your Profilarr application
		</p>
	</div>

	<div
		class="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
	>
		<div class="divide-y divide-neutral-200 dark:divide-neutral-800">
			{#each settingsItems as item}
				<a
					href={item.href}
					class="flex items-start gap-4 px-4 py-3 transition hover:bg-neutral-50 dark:hover:bg-neutral-900/70"
				>
					<svelte:component this={item.icon} size={18} class="mt-0.5 {item.iconClass}" />
					<div class="min-w-0">
						<div class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
							{item.label}
						</div>
						<div class="text-xs text-neutral-500 dark:text-neutral-400">
							{item.description}
						</div>
					</div>
				</a>
			{/each}
		</div>
	</div>
</div>
