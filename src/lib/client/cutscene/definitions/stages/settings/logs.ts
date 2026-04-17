import type { Stage } from '$cutscene/types.ts';

export const settingsLogsStage: Stage = {
	id: 'settings-logs',
	name: 'Logs',
	description: 'Read, filter, and download the app log files',
	steps: [
		{
			id: 'settings-logs-intro',
			route: '/settings/logs',
			title: 'Logs',
			body: "This page is the viewer for Profilarr's own application logs. Log level, retention, and on/off controls live under General > Logging; everything here (file selection, search, filters, metadata drill-down) operates on whatever was already captured.",
			completion: { type: 'manual' }
		},
		{
			id: 'settings-logs-actions',
			target: 'logs-actions',
			title: 'Actions Bar',
			body: "The actions bar has everything you need to narrow the view: a file picker (files rotate by day as `YYYY-MM-DD.log` with each file's size next to the name), free-text search across the currently loaded file, a level filter (DEBUG/INFO/WARN/ERROR, color-coded), and a source-module filter built from the unique set of sources in the current file. On the right, Refresh reloads the file, Download saves the raw file to disk, and Cleanup kicks the `logs.cleanup` job immediately instead of waiting for its next run.",
			position: 'below',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'settings-logs-table',
			target: 'logs-table',
			title: 'Log Entry',
			body: 'Each row is a single log entry: timestamp, level, source module, and message. The Copy button on a row copies the full formatted entry (including meta) to your clipboard; the eye icon, when present, opens a modal with the structured metadata payload pretty-printed as JSON, which is where context like job IDs, HTTP bodies, and stack traces lives.',
			position: 'center',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'settings-logs-summary',
			title: 'Summary',
			body: 'Pick a log file, narrow the view with search and the level and source filters, and drill into metadata when you need the context behind a line. Deeper control over what actually gets captured (level, retention, file vs console) lives one page over under General > Logging.',
			completion: { type: 'manual' }
		}
	]
};
