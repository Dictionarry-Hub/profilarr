import type { RequestHandler } from '@sveltejs/kit';
import { logEvents } from '#logger/events.ts';

/**
 * GET /settings/logs/events
 *
 * Server-Sent Events endpoint for the Logs page's live view.
 * Session-only auth (enforced by hooks.server.ts for non-/api/ routes).
 *
 * Opens with a `retry` line so the browser sees the connection at once, then
 * streams each new log entry as a `log` event, and sends keepalive comments
 * every 30s to prevent proxy timeouts. Nothing here may log: each log line
 * would emit another one.
 */
export const GET: RequestHandler = () => {
	const encoder = new TextEncoder();

	let unsubscribe: (() => void) | undefined;
	let keepalive: ReturnType<typeof setInterval> | undefined;

	const stream = new ReadableStream({
		start(controller) {
			// Send a first line right away: the browser reports the stream open only
			// once bytes arrive. It also sets the browser's reconnect delay.
			controller.enqueue(encoder.encode('retry: 3000\n\n'));

			unsubscribe = logEvents.subscribe((entry) => {
				let data: string;
				try {
					data = JSON.stringify(entry);
				} catch {
					// Meta that can't be serialized is skipped, as the file write would fail too
					return;
				}
				try {
					controller.enqueue(encoder.encode(`event: log\ndata: ${data}\n\n`));
				} catch {
					// Stream closed
				}
			});

			keepalive = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(': keepalive\n\n'));
				} catch {
					clearInterval(keepalive);
				}
			}, 30_000);
		},
		cancel() {
			unsubscribe?.();
			if (keepalive) clearInterval(keepalive);
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no'
		}
	});
};
