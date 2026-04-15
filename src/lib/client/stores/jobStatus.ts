/**
 * Job status store with on-demand SSE connection.
 *
 * Opens an EventSource to /jobs/events only when a sync is triggered
 * (via connect()), and auto-disconnects after the job completes and
 * the 6-second completion display expires. No persistent connections,
 * no cross-tab coordination needed.
 *
 * States: idle -> running -> completed -> idle
 *
 * Timer rules:
 * - completed -> idle after 6 seconds (then auto-disconnect)
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

interface StartedPayload {
	jobType: string;
	displayLabel: string;
}

interface FinishedPayload {
	jobType: string;
	displayLabel: string;
	status: string;
	durationMs: number;
}

const COMPLETED_DISPLAY_MS = 6_000;
const COMPLETED_HOLDOFF_MS = 5_000;

function createJobStatusStore() {
	const { subscribe, set } = writable<JobStatusState>({ state: 'idle' });

	let resetTimer: ReturnType<typeof setTimeout> | null = null;
	let holdoffTimer: ReturnType<typeof setTimeout> | null = null;
	let completedAt = 0;
	let pendingStartEvent: StartedPayload | null = null;

	let eventSource: EventSource | null = null;

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

	function handleStarted(data: StartedPayload) {
		if (resetTimer) {
			clearTimeout(resetTimer);
			resetTimer = null;
		}

		const elapsed = Date.now() - completedAt;

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

		completedAt = 0;
		pendingStartEvent = null;
		if (holdoffTimer) {
			clearTimeout(holdoffTimer);
			holdoffTimer = null;
		}
		set({ state: 'running', jobType: data.jobType, displayLabel: data.displayLabel });
	}

	function handleFinished(data: FinishedPayload) {
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
			// Auto-disconnect: no more events expected
			closeSSE();
		}, COMPLETED_DISPLAY_MS);
	}

	function closeSSE() {
		eventSource?.close();
		eventSource = null;
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
		closeSSE();
		clearTimers();
		completedAt = 0;
		set({ state: 'idle' });
	}

	return { subscribe, connect, disconnect };
}

export const jobStatus = createJobStatusStore();
