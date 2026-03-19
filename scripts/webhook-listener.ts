/**
 * Local webhook listener for testing notifications.
 * Starts an HTTP server that captures and pretty-prints incoming payloads.
 *
 * Usage: deno task webhook [port]
 * Default port: 9999
 *
 * Point a notification service at http://localhost:9999/webhook
 */

const port = Number(Deno.args[0]) || 9999;
let requestCount = 0;

console.log(`\nWebhook listener running on http://localhost:${port}/webhook\n`);

Deno.serve({ port, onListen: () => {} }, async (req) => {
	const url = new URL(req.url);
	requestCount++;
	const timestamp = new Date().toLocaleTimeString();

	console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
	console.log(`#${requestCount}  ${req.method} ${url.pathname}  ${timestamp}`);
	console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

	if (req.headers.get('content-type')?.includes('json')) {
		try {
			const body = await req.json();
			console.log(JSON.stringify(body, null, 2));
		} catch {
			console.log('(failed to parse JSON body)');
		}
	} else {
		try {
			const text = await req.text();
			if (text) console.log(text);
			else console.log('(empty body)');
		} catch {
			console.log('(no body)');
		}
	}

	console.log('');

	return new Response(JSON.stringify({ ok: true }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});
});
