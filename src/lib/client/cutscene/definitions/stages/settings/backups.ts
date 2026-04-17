import type { Stage } from '$cutscene/types.ts';

export const settingsBackupsStage: Stage = {
	id: 'settings-backups',
	name: 'Backups',
	description: "Manage archived snapshots of Profilarr's data directory",
	steps: [
		{
			id: 'settings-backups-intro',
			route: '/settings/backups',
			title: 'Backups',
			body: "Backups are compressed `.tar.gz` archives of Profilarr's data directory. Secrets (API keys, tokens, webhook URLs, and session records) are stripped from the database copy before it is archived, so an archive is safe to move between hosts. The automatic schedule and retention are configured under General > Backups; this page covers manual operations and restoring from an archive.",
			completion: { type: 'manual' }
		},
		{
			id: 'settings-backups-actions',
			target: 'backups-actions',
			title: 'Actions Bar',
			body: 'The actions bar covers the three manual operations. Search narrows the archive list by filename. Upload lets you drop a `.tar.gz` from another Profilarr instance, which is the main path for migrating between hosts. Create Backup enqueues a `backup.create` job that runs on the normal job queue and appears in the table below once it finishes. Cleanup fires the `backup.cleanup` job immediately instead of waiting for its next scheduled run.',
			position: 'below',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'settings-backups-table',
			target: 'backups-table',
			title: 'Backup Row',
			body: 'Each row is one archive: when it was created, its filename, and its size. Per-row actions are Download (saves the archive to your machine), Restore (replaces current state with the contents of the archive, asks for confirmation, and requires an app restart afterward), and Delete (removes the archive from disk).',
			position: 'center',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'settings-backups-summary',
			title: 'Summary',
			body: 'Automatic backups on the job schedule are the default protection; this page is for manual snapshots before risky operations, migrating between hosts via upload, and restoring when something has gone wrong.',
			completion: { type: 'manual' }
		}
	]
};
