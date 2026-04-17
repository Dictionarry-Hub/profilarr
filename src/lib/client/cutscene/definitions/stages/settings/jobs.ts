import type { Stage } from '$cutscene/types.ts';

export const settingsJobsStage: Stage = {
	id: 'settings-jobs',
	name: 'Jobs',
	description: 'The event-driven job queue that runs background work',
	steps: [
		{
			id: 'settings-jobs-intro',
			route: '/settings/jobs',
			title: 'Background Jobs',
			body: 'Profilarr uses a SQLite-backed job queue for background work: database syncs, format upgrades, file renames, backups, log cleanup. A single dispatcher claims jobs from the queue and runs them one at a time, strictly serially, which keeps the system deterministic. Rather than polling on an interval, the dispatcher sleeps until the next job is due and wakes up when a newly enqueued job has an earlier run time, so it costs nothing when idle.',
			completion: { type: 'manual' }
		},
		{
			id: 'settings-jobs-table',
			target: 'jobs-table',
			title: 'Jobs Table',
			body: 'One row per scheduled job, with current status, when it last ran, the result of that run, and when it is due to run next. Expanding a row surfaces the details: exact timestamps, how long the last run took, and any error message the handler returned. This is the view for checking what is on the schedule and spotting anything that has failed or drifted.',
			position: 'below',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'settings-jobs-history',
			target: 'jobs-history',
			title: 'Recent Jobs',
			body: 'Every row here is one execution pulled from job-run history: when it started, how long it took, and its output or error. Skipped runs, where the handler had nothing to do (for example, no expired backups to clean), are hidden by default to keep the table focused on work that actually ran; toggle "Show skipped runs" to include them.',
			position: 'above',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'settings-jobs-summary',
			title: 'Summary',
			body: "The queue plus a single event-driven dispatcher keeps Profilarr's background work cheap and predictable. Use the top table to see what is scheduled and Recent Jobs to audit what ran; both are read-only reporting views on top of the same queue.",
			completion: { type: 'manual' }
		}
	]
};
