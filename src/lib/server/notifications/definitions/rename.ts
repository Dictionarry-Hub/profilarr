/**
 * Rename notification definition
 */

import type { Notification, NotificationBlock } from '../types.ts';
import type { RenameJobLog } from '$lib/server/rename/types.ts';

interface RenameNotificationParams {
	log: RenameJobLog;
	summaryNotifications?: boolean;
}

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
	return `Before: ${getFilename(file.existingPath)}\nAfter:  ${getFilename(file.newPath)}`;
}

/**
 * Format a folder change entry
 */
function formatFolderEntry(folder: { existingPath: string; newPath: string }): string {
	return `Folder Before: ${folder.existingPath}\nFolder After:  ${folder.newPath}`;
}

/**
 * Build section blocks for an item, grouping by season for Sonarr
 */
function buildItemSections(
	title: string,
	item: {
		folder?: { existingPath: string; newPath: string };
		files: { existingPath: string; newPath: string }[];
	},
	isSonarr: boolean
): NotificationBlock[] {
	const sections: NotificationBlock[] = [];

	// Add folder change as a section if present
	if (item.folder) {
		sections.push({
			kind: 'section',
			title: `${title} (Folder)`,
			content: formatFolderEntry(item.folder)
		});
	}

	if (!isSonarr || item.files.length === 0) {
		// For Radarr or empty, one section with all files
		if (item.files.length > 0) {
			sections.push({
				kind: 'section',
				title,
				content: item.files.map(formatFileEntry).join('\n\n')
			});
		}
		return sections;
	}

	// For Sonarr, group by season
	const bySeasonMap = new Map<number, { existingPath: string; newPath: string }[]>();
	const noSeason: { existingPath: string; newPath: string }[] = [];

	for (const file of item.files) {
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

	const seasons = Array.from(bySeasonMap.keys()).sort((a, b) => a - b);

	for (const season of seasons) {
		const seasonFiles = bySeasonMap.get(season)!;
		sections.push({
			kind: 'section',
			title: `${title} - Season ${season}`,
			content: seasonFiles.map(formatFileEntry).join('\n\n')
		});
	}

	if (noSeason.length > 0) {
		sections.push({
			kind: 'section',
			title,
			content: noSeason.map(formatFileEntry).join('\n\n')
		});
	}

	return sections;
}

/**
 * Notification for rename job completion
 */
export function rename({ log, summaryNotifications = true }: RenameNotificationParams): Notification {
	const severity =
		log.status === 'failed' ? 'error' : log.status === 'partial' ? 'warning' : 'success';

	const title = `${getTitle(log)} - ${log.instanceName}`;
	const isSonarr = log.instanceType === 'sonarr';

	// No files to rename
	if (log.renamedItems.length === 0) {
		return {
			type: `rename.${log.status}`,
			severity,
			title,
			message: `No files needed renaming for ${log.instanceName}`,
			blocks: [{ kind: 'field', label: 'Status', value: 'No files needed renaming' }]
		};
	}

	const blocks: NotificationBlock[] = [];

	// Stats fields
	if (log.config.dryRun) {
		blocks.push({ kind: 'field', label: 'Mode', value: 'Dry Run', inline: true });
		blocks.push({
			kind: 'field',
			label: 'Files',
			value: String(log.results.filesNeedingRename),
			inline: true
		});
	} else {
		blocks.push({
			kind: 'field',
			label: 'Files',
			value: `${log.results.filesRenamed}/${log.results.filesNeedingRename}`,
			inline: true
		});
		if (log.config.renameFolders) {
			blocks.push({
				kind: 'field',
				label: 'Folders',
				value: String(log.results.foldersRenamed),
				inline: true
			});
		}
	}

	// Summary mode: one sample + count of others
	if (summaryNotifications) {
		const sample = log.renamedItems[0];
		const othersCount = log.renamedItems.length - 1;
		const othersText =
			othersCount > 0 ? ` + ${othersCount} other${othersCount === 1 ? '' : 's'}` : '';

		let sampleContent = '';
		if (sample.folder) {
			sampleContent += formatFolderEntry(sample.folder);
		}
		if (sample.files.length > 0) {
			if (sampleContent) sampleContent += '\n\n';
			sampleContent += formatFileEntry(sample.files[0]);
		}

		if (sampleContent) {
			blocks.push({
				kind: 'section',
				title: `Sample: ${sample.title}${othersText}`,
				content: sampleContent
			});
		}
	} else {
		// Rich mode: section blocks per item
		for (const item of log.renamedItems) {
			blocks.push(...buildItemSections(item.title, item, isSonarr));
		}
	}

	const message =
		log.status === 'failed'
			? `Rename failed for ${log.instanceName}`
			: `Renamed ${log.results.filesRenamed} files for ${log.instanceName}`;

	return {
		type: `rename.${log.status}`,
		severity,
		title,
		message,
		blocks
	};
}
