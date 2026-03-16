/**
 * Upgrade notification definition
 */

import type { Notification, NotificationBlock } from '../types.ts';
import type {
	UpgradeJobLog,
	UpgradeSelectionItem,
	UpgradeOriginalEpisode,
	UpgradeNewRelease
} from '$lib/server/upgrades/types.ts';

interface UpgradeNotificationParams {
	log: UpgradeJobLog;
	manual?: boolean;
}

/**
 * Get the notification title based on status
 */
function getTitle(log: UpgradeJobLog, manual: boolean = false): string {
	const prefix = manual ? 'Manual' : 'Automatic';
	const statusMap: Record<string, string> = {
		success: 'Complete',
		partial: 'Partial',
		failed: 'Failed',
		skipped: 'Skipped'
	};
	return `${prefix} Upgrade ${statusMap[log.status] || 'Complete'}`;
}

/**
 * Format selector method for display
 */
function formatSelector(method: string): string {
	return method
		.split('_')
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');
}

/**
 * Flatten series items into per-season items.
 * Movies pass through unchanged. Series get one item per season.
 */
function flattenItems(items: UpgradeSelectionItem[]): UpgradeSelectionItem[] {
	const result: UpgradeSelectionItem[] = [];
	for (const item of items) {
		if (item.original.type === 'movie') {
			result.push(item);
			continue;
		}

		const episodes = item.original.episodes ?? [];
		const seasonEpisodes = new Map<number, UpgradeOriginalEpisode[]>();
		for (const ep of episodes) {
			const eps = seasonEpisodes.get(ep.seasonNumber) ?? [];
			eps.push(ep);
			seasonEpisodes.set(ep.seasonNumber, eps);
		}

		const seasonUpgrades = new Map<number, UpgradeNewRelease[]>();
		for (const u of item.upgrades) {
			if (u.seasonNumber != null) {
				const ups = seasonUpgrades.get(u.seasonNumber) ?? [];
				ups.push(u);
				seasonUpgrades.set(u.seasonNumber, ups);
			}
		}

		const allSeasons = new Set([...seasonEpisodes.keys(), ...seasonUpgrades.keys()]);

		if (allSeasons.size === 0) {
			result.push(item);
			continue;
		}

		for (const season of [...allSeasons].sort((a, b) => a - b)) {
			result.push({
				id: item.id * 1000 + season,
				title: `${item.title} - Season ${season}`,
				original: {
					type: 'series',
					title: item.title,
					episodes: seasonEpisodes.get(season) ?? []
				},
				upgrades: seasonUpgrades.get(season) ?? [],
				imageUrl: item.imageUrl
			});
		}
	}
	return result;
}

/**
 * Format item content as structured text blocks for Release, Score, and Formats.
 * Each block is separated by a blank line and labeled.
 */
function formatItemContent(item: UpgradeSelectionItem): string {
	if (item.upgrades.length === 0) return 'No upgrade available';

	const sections: string[] = [];

	// Release
	for (const upgrade of item.upgrades) {
		sections.push(`Release\n${upgrade.release}`);
	}

	// Score
	if (item.original.type === 'movie') {
		const currentScore = item.original.score;
		const upgradeScore = item.upgrades[0]?.score ?? 0;
		sections.push(`Score\nCurrent: ${currentScore}\nUpgrade: ${upgradeScore}`);
	} else {
		for (const upgrade of item.upgrades) {
			sections.push(`Score\nUpgrade: ${upgrade.score}`);
		}
	}

	// Formats
	if (item.original.type === 'movie') {
		const currentFmts = item.original.formats;
		const upgradeFmts = item.upgrades[0]?.formats ?? [];
		const lines = ['Formats'];
		if (currentFmts.length > 0) {
			lines.push('Current:');
			for (const f of currentFmts) lines.push(`  ${f}`);
		}
		if (upgradeFmts.length > 0) {
			if (currentFmts.length > 0) lines.push('');
			lines.push('Upgrade:');
			for (const f of upgradeFmts) lines.push(`  ${f}`);
		}
		sections.push(lines.join('\n'));
	} else {
		for (const upgrade of item.upgrades) {
			if (upgrade.formats.length > 0) {
				const lines = ['Formats'];
				for (const f of upgrade.formats) lines.push(`  ${f}`);
				sections.push(lines.join('\n'));
			}
		}
	}

	return sections.join('\n\n');
}

/**
 * Build a generic message string
 */
function buildGenericMessage(log: UpgradeJobLog): string {
	const upgradesFound = log.selection.items.filter((i) => i.upgrades.length > 0).length;
	const mode = log.config.dryRun ? ' (Dry Run)' : '';

	if (log.status === 'failed') {
		return `Upgrade failed for ${log.instanceName}${mode}`;
	}

	if (log.status === 'skipped') {
		return `Upgrade skipped for ${log.instanceName}: ${log.results.errors[0] || 'Unknown reason'}`;
	}

	return `Searched ${log.selection.actualCount} items, found ${upgradesFound} upgrade${upgradesFound === 1 ? '' : 's'} for ${log.instanceName}${mode}`;
}

/**
 * Notification for upgrade job completion
 */
export function upgrade({ log, manual = false }: UpgradeNotificationParams): Notification {
	const severity =
		log.status === 'failed'
			? 'error'
			: log.status === 'partial'
				? 'warning'
				: log.status === 'skipped'
					? 'info'
					: 'success';

	const title = `${getTitle(log, manual)} - ${log.instanceName}`;
	const message = buildGenericMessage(log);

	// No items searched
	if (log.selection.items.length === 0) {
		return {
			type: `upgrade.${log.status}`,
			severity,
			title,
			message: `No items to search for ${log.instanceName}`,
			blocks: [
				{ kind: 'field', label: 'Filter', value: log.filter.name || 'Unknown', inline: true },
				{
					kind: 'field',
					label: 'Selector',
					value: formatSelector(log.selection.method),
					inline: true
				},
				...(log.config.dryRun
					? [{ kind: 'field' as const, label: 'Mode', value: 'Dry Run', inline: true }]
					: []),
				{ kind: 'field', label: 'Status', value: 'No items to search' }
			]
		};
	}

	const blocks: NotificationBlock[] = [];

	// Stats fields
	blocks.push({
		kind: 'field',
		label: 'Filter',
		value: log.filter.name || 'Unknown',
		inline: true
	});
	blocks.push({
		kind: 'field',
		label: 'Selector',
		value: formatSelector(log.selection.method),
		inline: true
	});
	if (log.config.dryRun) {
		blocks.push({ kind: 'field', label: 'Mode', value: 'Dry Run', inline: true });
	}

	const upgradesFound = log.selection.items.filter((i) => i.upgrades.length > 0).length;
	blocks.push({
		kind: 'field',
		label: 'Upgrades',
		value: `${upgradesFound}/${log.selection.actualCount}`,
		inline: true
	});

	// Funnel
	let funnelText = `${log.library.totalItems} library -> ${log.filter.matchedCount} filtered -> ${log.filter.afterCooldown} after cooldown`;
	if (log.filter.dryRunExcluded > 0) {
		const afterCache = log.filter.afterCooldown - log.filter.dryRunExcluded;
		funnelText += ` -> ${afterCache} after cache`;
	}
	funnelText += ` -> ${log.selection.actualCount} selected`;
	blocks.push({ kind: 'field', label: 'Funnel', value: funnelText });

	// Per-item sections (one per item, with imageUrl for poster)
	const displayItems = flattenItems(log.selection.items);
	for (const item of displayItems) {
		if (item.upgrades.length === 0) continue;
		blocks.push({
			kind: 'section',
			title: item.title,
			content: formatItemContent(item),
			imageUrl: item.imageUrl
		});
	}

	// Errors
	const realErrors = log.results.errors.filter((e) => !e.startsWith('[DRY RUN]'));
	if (realErrors.length > 0) {
		const errorText = realErrors
			.slice(0, 5)
			.map((e) => `- ${e}`)
			.join('\n');
		const moreText = realErrors.length > 5 ? `\n...and ${realErrors.length - 5} more` : '';
		blocks.push({ kind: 'field', label: 'Errors', value: errorText + moreText });
	}

	return {
		type: `upgrade.${log.status}`,
		severity,
		title,
		message,
		blocks
	};
}
