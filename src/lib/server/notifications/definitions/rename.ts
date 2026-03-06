/**
 * Rename notification definition
 */

import { notify, createEmbed, Colors, type EmbedBuilder } from '../builder.ts';
import type { RenameJobLog } from '$lib/server/rename/types.ts';

interface RenameNotificationParams {
	log: RenameJobLog;
	config: { username?: string; avatar_url?: string };
	summaryNotifications?: boolean;
}

// Discord limits (https://birdie0.github.io/discord-webhooks-guide/other/field_limits.html)
const MAX_EMBED_SIZE = 5800; // Using 5800 to stay safely under 6000
const MAX_FIELDS_PER_EMBED = 25;
const MAX_FIELD_VALUE = 1024;
const MAX_FIELD_NAME = 256;

/**
 * Extract filename from full path
 */
function getFilename(path: string): string {
	return path.split('/').pop() || path;
}

/**
 * Build the title based on manual/automatic and status
 */
function getTitle(log: RenameJobLog): string {
	const prefix = log.config.manual ? 'Manual' : 'Automatic';
	const result = log.status === 'failed' ? 'Failed' : 'Complete';
	return `${prefix} Rename ${result}`;
}

/**
 * Parse season number from filename (e.g., "S10E21" -> 10)
 */
function parseSeasonNumber(filename: string): number | null {
	const match = filename.match(/S(\d+)E\d+/i);
	return match ? parseInt(match[1], 10) : null;
}

/**
 * Format a single file entry
 */
function formatFileEntry(file: { existingPath: string; newPath: string }): string {
	return `Before: ${getFilename(file.existingPath)}\n\nAfter:  ${getFilename(file.newPath)}`;
}

/**
 * Format a folder change entry
 */
function formatFolderEntry(folder: { existingPath: string; newPath: string }): string {
	return `Folder Before: ${folder.existingPath}\n\nFolder After:  ${folder.newPath}`;
}

/**
 * Build content fields for an item, grouping by season for series
 * Returns multiple fields if needed (per season, with parts if a season is too large)
 */
function buildItemFields(
	title: string,
	item: {
		folder?: { existingPath: string; newPath: string };
		files: { existingPath: string; newPath: string }[];
	},
	isSonarr: boolean
): { name: string; value: string }[] {
	const fields: { name: string; value: string }[] = [];
	const files = item.files;

	// Add folder change as first field if present
	if (item.folder) {
		fields.push({
			name: truncateFieldName(`${title} (Folder)`),
			value: '```\n' + formatFolderEntry(item.folder) + '\n```'
		});
	}

	if (!isSonarr || files.length === 0) {
		// For Radarr or empty, just build fields splitting by size
		const chunks = splitFilesIntoChunks(files);
		for (let i = 0; i < chunks.length; i++) {
			const name = chunks.length > 1 ? `${title} (Part ${i + 1})` : title;
			fields.push({
				name: truncateFieldName(name),
				value: formatChunk(chunks[i])
			});
		}
		return fields;
	}

	// For Sonarr, group by season
	const bySeasonMap = new Map<number, { existingPath: string; newPath: string }[]>();
	const noSeason: { existingPath: string; newPath: string }[] = [];

	for (const file of files) {
		const season = parseSeasonNumber(getFilename(file.existingPath));
		if (season !== null) {
			if (!bySeasonMap.has(season)) {
				bySeasonMap.set(season, []);
			}
			bySeasonMap.get(season)!.push(file);
		} else {
			noSeason.push(file);
		}
	}

	// Sort seasons
	const seasons = Array.from(bySeasonMap.keys()).sort((a, b) => a - b);

	for (const season of seasons) {
		const seasonFiles = bySeasonMap.get(season)!;
		const chunks = splitFilesIntoChunks(seasonFiles);

		for (let i = 0; i < chunks.length; i++) {
			const name =
				chunks.length > 1
					? `${title} - Season ${season} (Part ${i + 1})`
					: `${title} - Season ${season}`;
			fields.push({
				name: truncateFieldName(name),
				value: formatChunk(chunks[i])
			});
		}
	}

	// Handle files without season info
	if (noSeason.length > 0) {
		const chunks = splitFilesIntoChunks(noSeason);
		for (let i = 0; i < chunks.length; i++) {
			const name = chunks.length > 1 ? `${title} (Part ${i + 1})` : title;
			fields.push({
				name: truncateFieldName(name),
				value: formatChunk(chunks[i])
			});
		}
	}

	return fields;
}

/**
 * Split files into chunks that fit within field value limit
 */
function splitFilesIntoChunks(
	files: { existingPath: string; newPath: string }[]
): { existingPath: string; newPath: string }[][] {
	const chunks: { existingPath: string; newPath: string }[][] = [];
	let currentChunk: { existingPath: string; newPath: string }[] = [];
	let currentLength = 0;
	const codeBlockOverhead = 8; // ```\n and \n```

	for (const file of files) {
		const entry = formatFileEntry(file);
		const separator = currentChunk.length > 0 ? 4 : 0; // \n\n between entries
		const entryLength = entry.length + separator;

		if (
			currentLength + entryLength + codeBlockOverhead > MAX_FIELD_VALUE &&
			currentChunk.length > 0
		) {
			chunks.push(currentChunk);
			currentChunk = [];
			currentLength = 0;
		}

		currentChunk.push(file);
		currentLength += entryLength;
	}

	if (currentChunk.length > 0) {
		chunks.push(currentChunk);
	}

	return chunks;
}

/**
 * Format a chunk of files as a code block
 */
function formatChunk(files: { existingPath: string; newPath: string }[]): string {
	const lines = files.map(formatFileEntry);
	return '```\n' + lines.join('\n\n') + '\n```';
}

/**
 * Truncate field name to fit Discord limits
 */
function truncateFieldName(name: string): string {
	if (name.length <= MAX_FIELD_NAME) return name;
	return name.slice(0, MAX_FIELD_NAME - 3) + '...';
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
 * Start a new embed with author, title, and stats fields
 */
function startNewEmbed(
	log: RenameJobLog,
	config: { username?: string; avatar_url?: string },
	page: number
): EmbedBuilder {
	const embed = createEmbed()
		.author(config.username || 'Profilarr', config.avatar_url)
		.title(`${getTitle(log)} - ${log.instanceName}`)
		.color(Colors.INFO)
		.timestamp()
		.footer(`Type: rename.${log.status}`);

	// Stats fields
	if (log.config.dryRun) {
		embed.field('Mode', 'Dry Run', true);
	} else {
		embed.field('Files', `${log.results.filesRenamed}/${log.results.filesNeedingRename}`, true);

		if (log.config.renameFolders) {
			embed.field('Folders', String(log.results.foldersRenamed), true);
		}
	}

	if (page > 1) {
		embed.field('Page', String(page), true);
	}

	return embed;
}

/**
 * Build a summary notification (compact, single embed)
 */
function buildSummaryNotification(
	log: RenameJobLog,
	config: { username?: string; avatar_url?: string }
) {
	const embed = createEmbed()
		.author(config.username || 'Profilarr', config.avatar_url)
		.title(`${getTitle(log)} - ${log.instanceName}`)
		.color(Colors.INFO)
		.timestamp()
		.footer(`Type: rename.${log.status}`);

	// Stats fields
	if (log.config.dryRun) {
		embed.field('Mode', 'Dry Run', true);
		embed.field('Files', String(log.results.filesNeedingRename), true);
	} else {
		embed.field('Files', `${log.results.filesRenamed}/${log.results.filesNeedingRename}`, true);

		if (log.config.renameFolders) {
			embed.field('Folders', String(log.results.foldersRenamed), true);
		}
	}

	// Add sample if there are renamed items
	if (log.renamedItems.length > 0) {
		const sample = log.renamedItems[0];
		const othersCount = log.renamedItems.length - 1;
		const othersText =
			othersCount > 0 ? ` + ${othersCount} other${othersCount === 1 ? '' : 's'}` : '';

		let sampleText = '';
		if (sample.folder) {
			sampleText += formatFolderEntry(sample.folder);
		}
		if (sample.files.length > 0) {
			if (sampleText) sampleText += '\n\n';
			sampleText += formatFileEntry(sample.files[0]);
		}

		if (sampleText) {
			embed.field(
				`Sample: ${truncateFieldName(sample.title)}${othersText}`,
				'```\n' + sampleText + '\n```',
				false
			);
		}
	}

	const genericMessage =
		log.status === 'failed'
			? `Rename failed for ${log.instanceName}`
			: `Renamed ${log.results.filesRenamed} files for ${log.instanceName}`;

	return notify(`rename.${log.status}`)
		.generic(getTitle(log), genericMessage)
		.discord((d) => d.embed(embed));
}

/**
 * Build a rich notification (detailed, multiple embeds if needed)
 */
function buildRichNotification(
	log: RenameJobLog,
	config: { username?: string; avatar_url?: string }
) {
	const embeds: EmbedBuilder[] = [];

	// If no files to rename, single embed with just stats
	if (log.renamedItems.length === 0) {
		const embed = startNewEmbed(log, config, 1);
		embed.field('Status', 'No files needed renaming', false);
		embeds.push(embed);

		return notify(`rename.${log.status}`)
			.generic(getTitle(log), `No files needed renaming for ${log.instanceName}`)
			.discord((d) => {
				for (const e of embeds) d.embed(e);
				return d;
			});
	}

	// Build content fields for each renamed item
	const isSonarr = log.instanceType === 'sonarr';
	const contentFields: { name: string; value: string }[] = [];
	for (const item of log.renamedItems) {
		const itemFields = buildItemFields(item.title, item, isSonarr);
		contentFields.push(...itemFields);
	}

	// Build embeds, counting as we go
	let page = 1;
	let embed = startNewEmbed(log, config, page);

	for (const field of contentFields) {
		const fieldChars = field.name.length + field.value.length;
		const currentSize = getEmbedSize(embed);
		const currentFieldCount = getFieldCount(embed);

		// Would this field push us over the character or field limit?
		if (currentSize + fieldChars > MAX_EMBED_SIZE || currentFieldCount >= MAX_FIELDS_PER_EMBED) {
			// Finish current embed and start a new one
			embeds.push(embed);
			page++;
			embed = startNewEmbed(log, config, page);
		}

		embed.field(field.name, field.value, false);
	}

	// Don't forget the last embed
	embeds.push(embed);

	const genericMessage =
		log.status === 'failed'
			? `Rename failed for ${log.instanceName}`
			: `Renamed ${log.results.filesRenamed} files for ${log.instanceName}`;

	return notify(`rename.${log.status}`)
		.generic(getTitle(log), genericMessage)
		.discord((d) => {
			for (const e of embeds) d.embed(e);
			return d;
		});
}

/**
 * Notification for rename job completion
 */
export const rename = ({ log, config, summaryNotifications = true }: RenameNotificationParams) => {
	// If no files to rename, always use a simple notification
	if (log.renamedItems.length === 0) {
		const embed = createEmbed()
			.author(config.username || 'Profilarr', config.avatar_url)
			.title(`${getTitle(log)} - ${log.instanceName}`)
			.color(Colors.INFO)
			.field('Status', 'No files needed renaming', false)
			.timestamp()
			.footer(`Type: rename.${log.status}`);

		return notify(`rename.${log.status}`)
			.generic(getTitle(log), `No files needed renaming for ${log.instanceName}`)
			.discord((d) => d.embed(embed));
	}

	// Use summary or rich notification based on setting
	if (summaryNotifications) {
		return buildSummaryNotification(log, config);
	}

	return buildRichNotification(log, config);
};
