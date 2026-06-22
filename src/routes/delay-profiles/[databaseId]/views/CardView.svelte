<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { DelayProfilesRow } from '$shared/pcd/display.ts';
	import { page } from '$app/stores';
	import { Clock, Zap, Copy, Download } from '@lucide/svelte';
	import CardGrid from '$ui/card/CardGrid.svelte';
	import Card from '$ui/card/Card.svelte';
	import Button from '$ui/button/Button.svelte';
	import Label from '$ui/label/Label.svelte';
	import { createProgressiveList } from '$lib/client/utils/progressiveList';
	import { FEATURES } from '$shared/features.ts';

	export let profiles: DelayProfilesRow[];

	const dispatch = createEventDispatcher<{ clone: { name: string }; export: { name: string } }>();

	$: databaseId = $page.params.databaseId;

	const { visibleCount, sentinel, reset, setTotalCount } = createProgressiveList({ pageSize: 30 });
	$: setTotalCount(profiles.length);
	$: (profiles, reset());
	$: visibleProfiles = profiles.slice(0, $visibleCount);

	function formatProtocol(protocol: string): string {
		switch (protocol) {
			case 'prefer_usenet':
				return 'Prefer Usenet';
			case 'prefer_torrent':
				return 'Prefer Torrent';
			case 'only_usenet':
				return 'Only Usenet';
			case 'only_torrent':
				return 'Only Torrent';
			default:
				return protocol;
		}
	}

	function protocolVariant(protocol: string): 'info' | 'warning' | 'secondary' {
		if (protocol.startsWith('prefer_')) return 'info';
		if (protocol.startsWith('only_')) return 'warning';
		return 'secondary';
	}

	function formatDelay(minutes: number | null): string {
		if (minutes === null) return '-';
		if (minutes === 0) return 'No delay';
		if (minutes < 60) return `${minutes}m`;
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
	}

	function getProfileHref(profile: DelayProfilesRow): string {
		return `/delay-profiles/${databaseId}/${encodeURIComponent(profile.name)}`;
	}
</script>

<CardGrid columns={5} flush>
	{#each visibleProfiles as profile}
		<Card href={getProfileHref(profile)} hoverable>
			<svelte:fragment slot="header">
				<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
				<div class="flex items-center justify-between gap-2">
					<div class="flex min-w-0 items-center gap-2">
						<h3 class="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
							{profile.name}
						</h3>
						<Label variant={protocolVariant(profile.preferred_protocol)} size="sm" rounded="md">
							{formatProtocol(profile.preferred_protocol)}
						</Label>
					</div>
					<div class="flex items-center gap-0.5" on:click|stopPropagation|preventDefault>
						{#if FEATURES.importExport}
							<Button
								icon={Download}
								size="xs"
								variant="ghost"
								tooltip="Export"
								on:click={() => dispatch('export', { name: profile.name })}
							/>
						{/if}
						<Button
							icon={Copy}
							size="xs"
							variant="ghost"
							tooltip="Clone"
							on:click={() => dispatch('clone', { name: profile.name })}
						/>
					</div>
				</div>
			</svelte:fragment>

			<div class="space-y-2.5">
				<div class="space-y-1">
					{#if profile.usenet_delay !== null}
						<div class="flex items-center justify-between text-xs">
							<span class="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
								<Clock size={11} />Usenet
							</span>
							<span class="font-mono text-neutral-900 dark:text-neutral-100"
								>{formatDelay(profile.usenet_delay)}</span
							>
						</div>
					{/if}
					{#if profile.torrent_delay !== null}
						<div class="flex items-center justify-between text-xs">
							<span class="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
								<Clock size={11} />Torrent
							</span>
							<span class="font-mono text-neutral-900 dark:text-neutral-100"
								>{formatDelay(profile.torrent_delay)}</span
							>
						</div>
					{/if}
				</div>

				{#if profile.bypass_if_highest_quality || profile.bypass_if_above_custom_format_score}
					<div class="space-y-1 border-t border-neutral-200 pt-2.5 dark:border-neutral-700/60">
						{#if profile.bypass_if_highest_quality}
							<div class="flex items-center justify-between text-xs">
								<span class="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
									<Zap size={11} />Highest quality
								</span>
								<span class="font-mono text-neutral-900 dark:text-neutral-100">✓</span>
							</div>
						{/if}
						{#if profile.bypass_if_above_custom_format_score && profile.minimum_custom_format_score !== null}
							<div class="flex items-center justify-between text-xs">
								<span class="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
									<Zap size={11} />Min CF score
								</span>
								<span class="font-mono text-neutral-900 dark:text-neutral-100"
									>≥ {profile.minimum_custom_format_score}</span
								>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</Card>
	{/each}
</CardGrid>
<div use:sentinel></div>
