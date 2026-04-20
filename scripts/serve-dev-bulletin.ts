/**
 * Serves `scripts/dev-bulletin/` as a static file server so `deno task dev`
 * can be pointed at a fake bulletin via PROFILARR_BULLETIN_URL.
 *
 * Usage:
 *   deno task dev:bulletin
 *
 * Override port with DEV_BULLETIN_PORT (default 6970).
 */

const ROOT = new URL('./dev-bulletin/', import.meta.url).pathname;
const PORT = parseInt(Deno.env.get('DEV_BULLETIN_PORT') || '6970', 10);

const MIME: Record<string, string> = {
	'.json': 'application/json',
	'.md': 'text/markdown; charset=utf-8',
	'.txt': 'text/plain; charset=utf-8'
};

function contentType(path: string): string {
	const dot = path.lastIndexOf('.');
	if (dot === -1) return 'application/octet-stream';
	return MIME[path.slice(dot)] || 'application/octet-stream';
}

console.log(`dev-bulletin serving ${ROOT}`);
console.log(`  listening on http://localhost:${PORT}`);
console.log();
console.log('  Point the main dev server at this endpoint with:');
console.log(`    PROFILARR_BULLETIN_URL=http://localhost:${PORT} deno task dev`);
console.log();

Deno.serve({ port: PORT, hostname: '0.0.0.0' }, async (req) => {
	const url = new URL(req.url);
	const rel = decodeURIComponent(url.pathname.replace(/^\/+/, ''));

	// Refuse path traversal.
	if (rel.includes('..')) {
		return new Response('bad path', { status: 400 });
	}

	const full = `${ROOT}${rel}`;
	try {
		const data = await Deno.readFile(full);
		return new Response(data, {
			status: 200,
			headers: {
				'Content-Type': contentType(rel),
				// Permissive CORS so the main dev server can fetch from this
				// origin without proxying.
				'Access-Control-Allow-Origin': '*',
				'Cache-Control': 'no-store'
			}
		});
	} catch {
		return new Response('not found', { status: 404 });
	}
});
