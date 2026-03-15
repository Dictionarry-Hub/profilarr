import type { RequestHandler } from '@sveltejs/kit';
import { jobEvents } from '$jobs/jobEvents.ts';

/**
 * GET /jobs/events
 *
 * Server-Sent Events endpoint for live job status updates.
 * Session-only auth (enforced by hooks.server.ts for non-/api/ routes).
 *
 * Streams job.started and job.finished events as they occur.
 * Sends keepalive comments every 30s to prevent proxy timeouts.
 */
export const GET: RequestHandler = () => {
	const encoder = new TextEncoder();

	let unsubscribe: (() => void) | undefined;
	let keepalive: ReturnType<typeof setInterval> | undefined;

	const stream = new ReadableStream({
		start(controller) {
			unsubscribe = jobEvents.subscribe((event) => {
				const line = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
				try {
					controller.enqueue(encoder.encode(line));
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
