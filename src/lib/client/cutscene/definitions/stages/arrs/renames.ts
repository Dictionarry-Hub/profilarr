import type { Stage } from '$cutscene/types.ts';

export const arrRenameStage: Stage = {
	id: 'arr-renames',
	name: 'Rename',
	description: 'Automated file and folder renaming',
	prerequisites: [
		{
			check: 'hasArrInstance',
			message:
				'You need at least one connected Arr instance to start this stage. Follow the "Link" stage under Arr Instances from the onboarding page to connect one.'
		}
	],
	steps: [
		{
			id: 'rename-why',
			route: { resolve: 'firstArrRename' },
			title: 'Why Rename?',
			body: "Arrs name files when they're first grabbed, but file names can fall out of sync over time. TBA episodes get placeholder names that need updating once the real title is known. Switching naming conventions or syncing new naming settings from a database leaves existing files with the old format. Rename catches all of this by comparing every file against your current naming format and fixing anything that doesn't match.",
			completion: { type: 'manual' }
		},
		{
			id: 'rename-what',
			title: 'What is Rename?',
			body: "Rename scans your library, compares each file name against your naming format, and renames anything that doesn't match. You can preview changes with a dry run before applying them.",
			completion: { type: 'manual' }
		},
		{
			id: 'rename-folders',
			target: 'rename-folders',
			title: 'Rename Folders',
			body: 'When enabled, folders are renamed alongside files. When off, only file names are updated.',
			position: 'below',
			completion: { type: 'manual' }
		},
		{
			id: 'rename-summary',
			target: 'rename-summary',
			title: 'Summary Notifications',
			body: 'Controls how rename notifications are sent. Summary mode sends a compact notification with a total count. Detailed mode lists every renamed file individually.',
			position: 'below',
			completion: { type: 'manual' }
		},
		{
			id: 'rename-schedule',
			target: 'rename-schedule',
			title: 'Schedule',
			body: 'How often renames run automatically. The default is daily at midnight. Like upgrades, this uses a cron expression.',
			position: 'below',
			completion: { type: 'manual' }
		},
		{
			id: 'rename-ignore-tag',
			target: 'rename-ignore-tag',
			title: 'Ignore Tag',
			body: "Items tagged with this value in your Arr instance will be skipped during renames. Useful for excluding items you've manually named or don't want touched.",
			position: 'below',
			completion: { type: 'manual' }
		},
		{
			id: 'rename-summary-step',
			title: 'Ready to Rename',
			body: 'Start with a dry run from the button above to preview what would be renamed before running it live.',
			completion: { type: 'manual' }
		}
	]
};
