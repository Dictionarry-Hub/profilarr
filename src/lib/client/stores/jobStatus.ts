/**
 * Job status store with SSE connection and multi-tab leader election.
 *
 * Uses Web Locks API so only one tab holds the EventSource connection.
 * The leader tab relays events to followers via BroadcastChannel.
 * Falls back to direct EventSource if Web Locks/BroadcastChannel
 * are unavailable.
 *
 * States: idle -> running -> completed -> idle
 *
 * Timer rules:
 * - completed -> idle after 6 seconds
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

type ChannelMessage =
	| { type: 'job.started'; data: StartedPayload }
	| { type: 'job.finished'; data: FinishedPayload };

const COMPLETED_DISPLAY_MS = 6_000;
const COMPLETED_HOLDOFF_MS = 5_000;
const LOCK_NAME = 'profilarr-sse-leader';
const CHANNEL_NAME = 'profilarr-jobs';

function createJobStatusStore() {
	const { subscribe, set } = writable<JobStatusState>({ state: 'idle' });

	let resetTimer: ReturnType<typeof setTimeout> | null = null;
	let holdoffTimer: ReturnType<typeof setTimeout> | null = null;
	let completedAt = 0;
	let pendingStartEvent: StartedPayload | null = null;

	// Cross-tab coordination
	let connected = false;
	let eventSource: EventSource | null = null;
	let channel: BroadcastChannel | null = null;
	let lockHeld = false;
	let disconnectController: AbortController | null = null;
	let disconnectResolve: (() => void) | null = null;

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
		}, COMPLETED_DISPLAY_MS);
	}

	/** Open SSE and relay events to followers via BroadcastChannel (leader only). */
	function openLeaderSSE() {
		eventSource = new EventSource('/jobs/events');

		eventSource.addEventListener('job.started', (e) => {
			try {
				const data: StartedPayload = JSON.parse(e.data);
				handleStarted(data);
				channel?.postMessage({ type: 'job.started', data } satisfies ChannelMessage);
			} catch {
				// Invalid event data
			}
		});

		eventSource.addEventListener('job.finished', (e) => {
			try {
				const data: FinishedPayload = JSON.parse(e.data);
				handleFinished(data);
				channel?.postMessage({ type: 'job.finished', data } satisfies ChannelMessage);
			} catch {
				// Invalid event data
			}
		});
	}

	/** Open SSE directly without cross-tab coordination (fallback). */
	function openDirectSSE() {
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

	function connect() {
		if (!browser || connected) return;
		connected = true;

		if (
			typeof BroadcastChannel !== 'undefined' &&
			typeof navigator !== 'undefined' &&
			'locks' in navigator
		) {
			// All tabs listen for relayed events
			channel = new BroadcastChannel(CHANNEL_NAME);
			channel.onmessage = (e: MessageEvent<ChannelMessage>) => {
				if (lockHeld) return; // Leader already handled locally
				const msg = e.data;
				if (msg.type === 'job.started') handleStarted(msg.data);
				else if (msg.type === 'job.finished') handleFinished(msg.data);
			};

			// Compete for SSE leadership
			disconnectController = new AbortController();
			navigator.locks
				.request(LOCK_NAME, { signal: disconnectController.signal }, () => {
					lockHeld = true;
					openLeaderSSE();
					// Hold the lock until disconnect() resolves this promise
					return new Promise<void>((resolve) => {
						disconnectResolve = resolve;
					});
				})
				.catch((err: unknown) => {
					// AbortError is expected when a follower disconnects
					if (err instanceof DOMException && err.name === 'AbortError') return;
					// Unexpected error: fall back to direct SSE
					if (connected && !eventSource) openDirectSSE();
				});
		} else {
			// No Web Locks / BroadcastChannel support: old behavior
			openDirectSSE();
		}
	}

	function disconnect() {
		if (!connected) return;
		connected = false;

		eventSource?.close();
		eventSource = null;

		channel?.close();
		channel = null;

		if (lockHeld) {
			lockHeld = false;
			disconnectResolve?.();
			disconnectResolve = null;
		} else {
			disconnectController?.abort();
		}
		disconnectController = null;

		clearTimers();
		completedAt = 0;
		set({ state: 'idle' });
	}

	return { subscribe, connect, disconnect };
}

export const jobStatus = createJobStatusStore();
