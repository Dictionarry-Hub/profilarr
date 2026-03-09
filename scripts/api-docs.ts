/**
 * Serves Swagger UI with the bundled OpenAPI spec.
 * Watches docs/api/v1/ for changes and hot-reloads the browser.
 */

const SPEC_DIR = 'docs/api/v1';
const SPEC_ENTRY = `${SPEC_DIR}/openapi.yaml`;
const PORT = 9009;

const colors = {
	info: '\x1b[36m',
	success: '\x1b[32m',
	error: '\x1b[31m',
	dim: '\x1b[2m',
	reset: '\x1b[0m'
};

function log(color: string, msg: string) {
	console.log(`${color}[api-docs]${colors.reset} ${msg}`);
}

// --- Bundling ---

let bundledSpec = '';

const BUNDLE_OUT = '/tmp/profilarr-openapi-bundled.yaml';

async function bundle(): Promise<boolean> {
	const cmd = new Deno.Command('npx', {
		args: ['@redocly/cli', 'bundle', SPEC_ENTRY, '-o', BUNDLE_OUT],
		stdout: 'piped',
		stderr: 'piped'
	});

	const { code, stderr } = await cmd.output();
	const errText = new TextDecoder().decode(stderr);

	if (code !== 0) {
		log(colors.error, `Bundle failed:\n${errText}`);
		return false;
	}

	bundledSpec = await Deno.readTextFile(BUNDLE_OUT);
	log(colors.success, 'Spec bundled');
	return true;
}

// --- SSE for hot reload ---

const sseClients = new Set<ReadableStreamDefaultController>();

function notifyClients() {
	for (const controller of sseClients) {
		try {
			controller.enqueue(new TextEncoder().encode('data: reload\n\n'));
		} catch {
			sseClients.delete(controller);
		}
	}
}

// --- File watcher ---

async function watch() {
	let debounce: number | undefined;
	const watcher = Deno.watchFs(SPEC_DIR);

	for await (const event of watcher) {
		if (!['modify', 'create', 'remove'].includes(event.kind)) continue;

		clearTimeout(debounce);
		debounce = setTimeout(async () => {
			const changed = event.paths.map((p) => p.split('/').pop()).join(', ');
			log(colors.dim, `Changed: ${changed}`);

			const ok = await bundle();
			if (ok) notifyClients();
		}, 300);
	}
}

// --- HTML ---

const SWAGGER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Profilarr API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    html { box-sizing: border-box; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin: 0; background: #fafafa; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/spec.yaml',
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis],
      layout: 'BaseLayout',
      deepLinking: true,
      defaultModelsExpandDepth: 1
    });

    // Hot reload via SSE
    const evtSource = new EventSource('/sse');
    evtSource.onmessage = () => location.reload();
  </script>
</body>
</html>`;

// --- Server ---

function handleRequest(req: Request): Response {
	const url = new URL(req.url);

	if (url.pathname === '/sse') {
		const stream = new ReadableStream({
			start(controller) {
				sseClients.add(controller);
			},
			cancel(controller) {
				sseClients.delete(controller);
			}
		});

		return new Response(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive'
			}
		});
	}

	if (url.pathname === '/spec.yaml') {
		return new Response(bundledSpec, {
			headers: { 'Content-Type': 'application/yaml' }
		});
	}

	return new Response(SWAGGER_HTML, {
		headers: { 'Content-Type': 'text/html' }
	});
}

// --- Main ---

log(colors.info, 'Bundling spec...');
const ok = await bundle();
if (!ok) Deno.exit(1);

watch();

log(colors.info, `Serving at http://localhost:${PORT}`);
Deno.serve({ port: PORT, onListen: () => {} }, handleRequest);
