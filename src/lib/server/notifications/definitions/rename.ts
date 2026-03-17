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
 * Format item content as Before/After sections separated by double newlines.
 * For Sonarr, groups by season with separate Before/After per season.
 */
function formatItemContent(
	item: {
		folder?: { existingPath: string; newPath: string };
		files: { existingPath: string; newPath: string }[];
	},
	isSonarr: boolean
): string {
	const sections: string[] = [];

	// Folder change
	if (item.folder) {
		sections.push(`Folder (Before)\n${item.folder.existingPath}`);
		sections.push(`Folder (After)\n${item.folder.newPath}`);
	}

	if (!isSonarr || item.files.length === 0) {
		if (item.files.length > 0) {
			sections.push(`Before\n${item.files.map((f) => getFilename(f.existingPath)).join('\n')}`);
			sections.push(`After\n${item.files.map((f) => getFilename(f.newPath)).join('\n')}`);
		}
		return sections.join('\n\n');
	}

	// Sonarr: group by season
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
		sections.push(
			`Season ${season} (Before)\n${seasonFiles.map((f) => getFilename(f.existingPath)).join('\n')}`
		);
		sections.push(
			`Season ${season} (After)\n${seasonFiles.map((f) => getFilename(f.newPath)).join('\n')}`
		);
	}

	if (noSeason.length > 0) {
		sections.push(`Before\n${noSeason.map((f) => getFilename(f.existingPath)).join('\n')}`);
		sections.push(`After\n${noSeason.map((f) => getFilename(f.newPath)).join('\n')}`);
	}

	return sections.join('\n\n');
}

/**
 * Notification for rename job completion
 */
export function rename({
	log,
	summaryNotifications = true
}: RenameNotificationParams): Notification {
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

	// Stats as a single structured block
	const statsLines: string[] = [];
	if (log.config.dryRun) {
		statsLines.push(`Mode:     Dry Run`);
		statsLines.push(`Files:    ${log.results.filesNeedingRename}`);
	} else {
		statsLines.push(`Files:    ${log.results.filesRenamed}/${log.results.filesNeedingRename}`);
		if (log.config.renameFolders) {
			statsLines.push(`Folders:  ${log.results.foldersRenamed}`);
		}
	}
	blocks.push({
		kind: 'section',
		title: 'Stats',
		content: statsLines.join('\n')
	});

	// Summary mode: one sample + count of others
	if (summaryNotifications) {
		const sample = log.renamedItems[0];
		const othersCount = log.renamedItems.length - 1;
		const othersText =
			othersCount > 0 ? ` + ${othersCount} other${othersCount === 1 ? '' : 's'}` : '';

		let sampleContent = '';
		if (sample.folder) {
			sampleContent += `Folder (Before)\n${sample.folder.existingPath}`;
			sampleContent += `\n\nFolder (After)\n${sample.folder.newPath}`;
		}
		if (sample.files.length > 0) {
			if (sampleContent) sampleContent += '\n\n';
			sampleContent += `Before\n${getFilename(sample.files[0].existingPath)}`;
			sampleContent += `\n\nAfter\n${getFilename(sample.files[0].newPath)}`;
		}

		if (sampleContent) {
			blocks.push({
				kind: 'section',
				title: `${sample.title}${othersText}`,
				content: sampleContent,
				imageUrl: sample.imageUrl
			});
		}
	} else {
		// Rich mode: one section per item with poster
		for (const item of log.renamedItems) {
			const content = formatItemContent(item, isSonarr);
			if (content) {
				blocks.push({
					kind: 'section',
					title: item.title,
					content,
					imageUrl: item.imageUrl
				});
			}
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
