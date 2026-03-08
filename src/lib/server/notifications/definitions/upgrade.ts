/**
 * Upgrade notification definition
 */

import { notify, createEmbed, Colors, type EmbedBuilder } from '../builder.ts';
import type {
	UpgradeJobLog,
	UpgradeSelectionItem,
	UpgradeOriginalEpisode,
	UpgradeNewRelease
} from '$lib/server/upgrades/types.ts';

interface UpgradeNotificationParams {
	log: UpgradeJobLog;
	config: { username?: string; avatar_url?: string };
	manual?: boolean;
}

// Discord limits
const MAX_EMBED_SIZE = 5800;
const MAX_FIELDS_PER_EMBED = 25;
const MAX_FIELD_NAME = 256;

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
 * Format a score delta with sign
 */
function formatScoreDelta(delta: number | null): string {
	if (delta === null) return '';
	return delta >= 0 ? `+${delta}` : `${delta}`;
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
				upgrades: seasonUpgrades.get(season) ?? []
			});
		}
	}
	return result;
}

/**
 * Format a single item for detailed display
 */
function formatItemDetailed(item: UpgradeSelectionItem): string {
	const lines: string[] = [];

	lines.push('[Current]');
	if (item.original.type === 'movie') {
		lines.push(`File: ${item.original.fileName}`);
		lines.push(`Score: ${item.original.score}`);
		if (item.original.formats.length > 0) {
			lines.push(`Formats: ${item.original.formats.join(', ')}`);
		}
	} else {
		lines.push(`Series: ${item.original.title}`);
		lines.push(`Episodes: ${item.original.episodes.length}`);
		for (const ep of item.original.episodes.slice(0, 5)) {
			lines.push(`  ${ep.fileName} (${ep.score})`);
		}
		if (item.original.episodes.length > 5) {
			lines.push(`  ... and ${item.original.episodes.length - 5} more`);
		}
	}

	lines.push('');

	if (item.upgrades.length > 0) {
		for (const upgrade of item.upgrades) {
			lines.push('[Upgrade]');
			lines.push(`Release: ${upgrade.release}`);
			lines.push(`Score: ${upgrade.score}`);
			if (upgrade.formats.length > 0) {
				lines.push(`Formats: ${upgrade.formats.join(', ')}`);
			}
			lines.push('');
		}
	} else {
		lines.push('No upgrade available');
	}

	return lines.join('\n');
}

/**
 * Get field name for an item
 */
function getItemFieldName(item: UpgradeSelectionItem): string {
	if (item.upgrades.length > 0) {
		const grabCount = item.upgrades.length;
		if (item.original.type === 'movie') {
			const delta = item.upgrades[0].score - item.original.score;
			return `${item.title} (${formatScoreDelta(delta)})`;
		}
		return `${item.title} (${grabCount} grab${grabCount > 1 ? 's' : ''})`;
	}
	return `${item.title} (No Upgrade)`;
}

/**
 * Truncate field name to fit Discord limits
 */
function truncateFieldName(name: string): string {
	if (name.length <= MAX_FIELD_NAME) return name;
	return name.slice(0, MAX_FIELD_NAME - 3) + '...';
}

/**
 * Format item as a code block for a field value
 */
function formatItemCodeBlock(item: UpgradeSelectionItem): string {
	return '```\n' + formatItemDetailed(item) + '\n```';
}

/**
 * Calculate the character count of an embed's current content
 */
function getEmbedSize(embed: EmbedBuilder): number {
	const built = embed.build();
	let size = 0;
	if (built.author?.name) size += built.author.name.length;
	if (built.title) size += built.title.length;
	if (built.description) size += built.description.length;
	if (built.footer?.text) size += built.footer.text.length;
	if (built.timestamp) size += built.timestamp.length;
	if (built.fields) {
		for (const field of built.fields) {
			size += field.name.length + field.value.length;
		}
	}
	return size;
}

/**
 * Get the field count of an embed
 */
function getFieldCount(embed: EmbedBuilder): number {
	const built = embed.build();
	return built.fields?.length || 0;
}

/**
 * Start a new embed with header info
 */
function startNewEmbed(
	log: UpgradeJobLog,
	config: { username?: string; avatar_url?: string },
	page: number,
	manual: boolean
): EmbedBuilder {
	const embed = createEmbed()
		.author(config.username || 'Profilarr', config.avatar_url)
		.title(`${getTitle(log, manual)} - ${log.instanceName}`)
		.color(Colors.INFO)
		.timestamp()
		.footer(`Type: upgrade.${log.status}`);

	// Stats fields
	embed.field('Filter', log.filter.name || 'Unknown', true);
	embed.field('Selector', formatSelector(log.selection.method), true);

	if (log.config.dryRun) {
		embed.field('Mode', 'Dry Run', true);
	}

	const upgradesFound = log.selection.items.filter((i) => i.upgrades.length > 0).length;
	embed.field('Upgrades', `${upgradesFound}/${log.selection.actualCount}`, true);

	// Funnel
	let funnelText = `${log.library.totalItems} library → ${log.filter.matchedCount} filtered → ${log.filter.afterCooldown} after cooldown`;
	if (log.filter.dryRunExcluded > 0) {
		const afterCache = log.filter.afterCooldown - log.filter.dryRunExcluded;
		funnelText += ` → ${afterCache} after cache`;
	}
	funnelText += ` → ${log.selection.actualCount} selected`;
	embed.field('Funnel', funnelText, false);

	if (page > 1) {
		embed.field('Page', String(page), true);
	}

	return embed;
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
export const upgrade = ({ log, config, manual = false }: UpgradeNotificationParams) => {
	const embeds: EmbedBuilder[] = [];

	// If no items searched, single embed with just stats
	if (log.selection.items.length === 0) {
		const embed = createEmbed()
			.author(config.username || 'Profilarr', config.avatar_url)
			.title(`${getTitle(log, manual)} - ${log.instanceName}`)
			.color(Colors.INFO)
			.field('Filter', log.filter.name || 'Unknown', true)
			.field('Selector', formatSelector(log.selection.method), true)
			.fieldIf(log.config.dryRun, 'Mode', 'Dry Run', true)
			.field('Status', 'No items to search', false)
			.timestamp()
			.footer(`Type: upgrade.${log.status}`);

		return notify(`upgrade.${log.status}`)
			.generic(getTitle(log, manual), `No items to search for ${log.instanceName}`)
			.discord((d) => d.embed(embed));
	}

	// Build content fields - one field per item (series flattened to per-season)
	const contentFields: { name: string; value: string }[] = [];
	const displayItems = flattenItems(log.selection.items);

	for (const item of displayItems) {
		contentFields.push({
			name: truncateFieldName(getItemFieldName(item)),
			value: formatItemCodeBlock(item)
		});
	}

	// Add errors if any (filter out dry run messages)
	const realErrors = log.results.errors.filter((e) => !e.startsWith('[DRY RUN]'));
	if (realErrors.length > 0) {
		const errorText = realErrors
			.slice(0, 5)
			.map((e) => `• ${e}`)
			.join('\n');
		const moreText = realErrors.length > 5 ? `\n...and ${realErrors.length - 5} more` : '';
		contentFields.push({
			name: 'Errors',
			value: errorText + moreText
		});
	}

	// Build embeds, respecting limits
	let page = 1;
	let embed = startNewEmbed(log, config, page, manual);

	for (const field of contentFields) {
		const fieldChars = field.name.length + field.value.length;
		const currentSize = getEmbedSize(embed);
		const currentFieldCount = getFieldCount(embed);

		// Would this field push us over limits?
		if (currentSize + fieldChars > MAX_EMBED_SIZE || currentFieldCount >= MAX_FIELDS_PER_EMBED) {
			embeds.push(embed);
			page++;
			embed = startNewEmbed(log, config, page, manual);
		}

		embed.field(field.name, field.value, false);
	}

	// Don't forget the last embed
	embeds.push(embed);

	const genericMessage = buildGenericMessage(log);

	return notify(`upgrade.${log.status}`)
		.generic(getTitle(log, manual), genericMessage)
		.discord((d) => {
			for (const e of embeds) d.embed(e);
			return d;
		});
};
