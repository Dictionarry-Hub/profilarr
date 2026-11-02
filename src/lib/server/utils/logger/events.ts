/**
 * Log event emitter.
 *
 * The logger emits every entry that passes its enabled and minimum level
 * checks, whether or not file logging is on. The Logs page's live view
 * subscribes through /settings/logs/events.
 *
 * Subscribers must not log from inside their callback: each log line would
 * emit another one.
 */

import type { LogEntry } from './types.ts';

type LogEventCallback = (entry: LogEntry) => void;

const subscribers = new Set<LogEventCallback>();

/**
 * Subscribe to log entries. Returns an unsubscribe function.
 */
export function subscribe(callback: LogEventCallback): () => void {
	subscribers.add(callback);
	return () => subscribers.delete(callback);
}

/**
 * Send a log entry to every subscriber.
 */
export function emit(entry: LogEntry): void {
	for (const callback of subscribers) {
		try {
			callback(entry);
		} catch {
			// A broken subscriber must not break logging
		}
	}
}

export const logEvents = { subscribe, emit };
