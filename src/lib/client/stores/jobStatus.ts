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
 *
 * Optimistic running:
 * - setRunning() lets a caller claim the running state before any SSE
 *   event arrives (used by the link form to avoid the started-event race).
 *   The first matching event with a jobId then claims the state for
 *   real; later events without a matching jobId are ignored.
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
	jobId: number;
	jobType: string;
	displayLabel: string;
}

interface ProgressPayload {
	jobId: number;
	jobType: string;
	label: string;
}

interface FinishedPayload {
	jobId: number;
	jobType: string;
	displayLabel: string;
	status: string;
	durationMs: number;
}

const COMPLETED_DISPLAY_MS = 6_000;
const COMPLETED_HOLDOFF_MS = 5_000;

function createJobStatusStore() {
	const { subscribe, set, update } = writable<JobStatusState>({ state: 'idle' });

	let resetTimer: ReturnType<typeof setTimeout> | null = null;
	let holdoffTimer: ReturnType<typeof setTimeout> | null = null;
	let completedAt = 0;
	let pendingStartEvent: StartedPayload | null = null;
	let currentJobId: number | null = null;

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
					currentJobId = pendingStartEvent.jobId;
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
		currentJobId = data.jobId;
		set({ state: 'running', jobType: data.jobType, displayLabel: data.displayLabel });
	}

	function handleProgress(data: ProgressPayload) {
		update((s) => {
			if (s.state !== 'running') return s;
			// Optimistic running has no jobId yet; the first progress event
			// claims it. Once claimed, only matching events update the label.
			if (currentJobId !== null && currentJobId !== data.jobId) return s;
			if (currentJobId === null) currentJobId = data.jobId;
			return { ...s, displayLabel: data.label };
		});
	}

	function handleFinished(data: FinishedPayload) {
		// Ignore finished events for jobs we're not tracking (stale events
		// from prior optimistic state mismatches).
		if (currentJobId !== null && currentJobId !== data.jobId) return;
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
			currentJobId = null;
			set({ state: 'idle' });
			completedAt = 0;
			resetTimer = null;
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

		eventSource.addEventListener('job.progress', (e) => {
			try {
				handleProgress(JSON.parse(e.data));
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
		currentJobId = null;
		set({ state: 'idle' });
	}

	function setRunning(jobType: string, displayLabel: string) {
		// Optimistic: claim running state without a jobId. The next matching
		// SSE event will adopt the jobId. Don't touch completedAt or timers.
		currentJobId = null;
		set({ state: 'running', jobType, displayLabel });
	}

	function cancelOptimistic() {
		// Only resets if we're in an unclaimed optimistic state. Once a real
		// event has bound a jobId, leave the state alone.
		update((s) => {
			if (s.state === 'running' && currentJobId === null) {
				return { state: 'idle' };
			}
			return s;
		});
	}

	return { subscribe, connect, disconnect, setRunning, cancelOptimistic };
}

export const jobStatus = createJobStatusStore();
