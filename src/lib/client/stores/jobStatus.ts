/**
 * Job status store with SSE connection.
 *
 * Manages the state machine for the sidebar job status indicator.
 * Connects to /jobs/events via EventSource on app load.
 *
 * States: idle → running → completed → idle
 *
 * Timer rules:
 * - completed → idle after 10 seconds
 * - If job.started arrives during completed and < 5s elapsed, hold
 *   the completion message until 5s pass, then transition to running
 */

import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type JobStatusState =
	| { state: 'idle' }
	| { state: 'running'; jobType: string; displayLabel: string }
	| {
			state: 'completed';
			jobType: string;
			displayLabel: string;
			status: string;
			durationMs: number;
	  };

const COMPLETED_DISPLAY_MS = 6_000;
const COMPLETED_HOLDOFF_MS = 5_000;

function createJobStatusStore() {
	const { subscribe, set } = writable<JobStatusState>({ state: 'idle' });

	let eventSource: EventSource | null = null;
	let resetTimer: ReturnType<typeof setTimeout> | null = null;
	let holdoffTimer: ReturnType<typeof setTimeout> | null = null;
	let completedAt = 0;
	let pendingStartEvent: { jobType: string; displayLabel: string } | null = null;

	function clearTimers() {
		if (resetTimer) {
			clearTimeout(resetTimer);
			resetTimer = null;
		}
		if (holdoffTimer) {
			clearTimeout(holdoffTimer);
			holdoffTimer = null;
		}
		pendingStartEvent = null;
	}

	function handleStarted(data: { jobType: string; displayLabel: string }) {
		// Clear the idle reset timer if running
		if (resetTimer) {
			clearTimeout(resetTimer);
			resetTimer = null;
		}

		const elapsed = Date.now() - completedAt;

		// If in completed state within holdoff window, delay the transition
		if (completedAt > 0 && elapsed < COMPLETED_HOLDOFF_MS) {
			pendingStartEvent = data;
			if (holdoffTimer) clearTimeout(holdoffTimer);
			holdoffTimer = setTimeout(() => {
				if (pendingStartEvent) {
					set({
						state: 'running',
						jobType: pendingStartEvent.jobType,
						displayLabel: pendingStartEvent.displayLabel
					});
					pendingStartEvent = null;
				}
				completedAt = 0;
				holdoffTimer = null;
			}, COMPLETED_HOLDOFF_MS - elapsed);
			return;
		}

		// Transition immediately
		completedAt = 0;
		pendingStartEvent = null;
		if (holdoffTimer) {
			clearTimeout(holdoffTimer);
			holdoffTimer = null;
		}
		set({ state: 'running', jobType: data.jobType, displayLabel: data.displayLabel });
	}

	function handleFinished(data: {
		jobType: string;
		displayLabel: string;
		status: string;
		durationMs: number;
	}) {
		clearTimers();
		completedAt = Date.now();
		set({
			state: 'completed',
			jobType: data.jobType,
			displayLabel: data.displayLabel,
			status: data.status,
			durationMs: data.durationMs
		});
		resetTimer = setTimeout(() => {
			set({ state: 'idle' });
			completedAt = 0;
			resetTimer = null;
		}, COMPLETED_DISPLAY_MS);
	}

	function connect() {
		if (!browser || eventSource) return;

		eventSource = new EventSource('/jobs/events');

		eventSource.addEventListener('job.started', (e) => {
			try {
				handleStarted(JSON.parse(e.data));
			} catch {
				// Invalid event data
			}
		});

		eventSource.addEventListener('job.finished', (e) => {
			try {
				handleFinished(JSON.parse(e.data));
			} catch {
				// Invalid event data
			}
		});
	}

	function disconnect() {
		eventSource?.close();
		eventSource = null;
		clearTimers();
		completedAt = 0;
		set({ state: 'idle' });
	}

	return { subscribe, connect, disconnect };
}

export const jobStatus = createJobStatusStore();
