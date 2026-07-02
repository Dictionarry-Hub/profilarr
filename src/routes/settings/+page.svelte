<script lang="ts">
	import {
		Sliders,
		ShieldCheck,
		GraduationCap,
		Bell,
		Clock,
		FileText,
		Archive,
		Info
	} from 'lucide-svelte';

	const settingsItems = [
		{
			label: 'General',
			href: '/settings/general',
			description: 'Application defaults, preferences, and behaviors',
			icon: Sliders,
			iconClass: 'text-info-icon'
		},
		{
			label: 'Security',
			href: '/settings/security',
			description: 'Access control and sensitive operations',
			icon: ShieldCheck,
			iconClass: 'text-danger-icon'
		},
		{
			label: 'Onboarding',
			href: '/onboarding',
			description: 'Guided walkthroughs and interactive tutorials',
			icon: GraduationCap,
			iconClass: 'text-accent-solid'
		},
		{
			label: 'Notifications',
			href: '/settings/notifications',
			description: 'Alerts, webhooks, and delivery settings',
			icon: Bell,
			iconClass: 'text-warning-icon'
		},
		{
			label: 'Jobs',
			href: '/settings/jobs',
			description: 'Scheduled tasks and automation workflows',
			icon: Clock,
			iconClass: 'text-success-icon'
		},
		{
			label: 'Logs',
			href: '/settings/logs',
			description: 'System logs and error history',
			icon: FileText,
			iconClass: 'text-text-soft'
		},
		{
			label: 'Backups',
			href: '/settings/backups',
			description: 'Snapshots, restore, and retention',
			icon: Archive,
			iconClass: 'text-info-icon'
		},
		{
			label: 'About',
			href: '/settings/about',
			description: 'Build info, status, and diagnostics',
			icon: Info,
			iconClass: 'text-text-soft'
		}
	];
</script>

<div class="px-4 pt-4 pb-8 md:px-8">
	<div class="mb-8">
		<h1 class="text-2xl font-semibold text-text md:text-3xl">Settings</h1>
		<p class="mt-2 text-sm text-text-soft md:text-base">
			Configure and manage your Profilarr application
		</p>
	</div>

	<div class="overflow-hidden rounded-card border border-border bg-surface">
		<div class="divide-y divide-border">
			{#each settingsItems as item}
				<a
					href={item.href}
					class="flex items-start gap-4 px-4 py-3 transition hover:bg-surface-muted"
				>
					<svelte:component this={item.icon} size={18} class="mt-0.5 {item.iconClass}" />
					<div class="min-w-0">
						<div class="text-sm font-medium text-text">
							{item.label}
						</div>
						<div class="text-xs text-text-muted">
							{item.description}
						</div>
					</div>
				</a>
			{/each}
		</div>
	</div>
</div>
