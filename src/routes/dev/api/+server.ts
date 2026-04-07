import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { escapeHtml } from '$shared/utils/sanitize';

export const GET: RequestHandler = async ({ url }) => {
	if (import.meta.env.VITE_CHANNEL !== 'dev') {
		throw redirect(302, '/');
	}

	const specUrl = new URL(url.href);
	specUrl.pathname = url.pathname.replace(/\/dev\/api\/?$/, '/api/v1/openapi.json');
	specUrl.search = '';
	specUrl.hash = '';

	const html = `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>Profilarr API Reference</title>
		<style>
			html, body, #app {
				margin: 0;
				width: 100%;
				height: 100%;
				background: #0a0a0a;
			}
		</style>
	</head>
	<body>
		<div id="app"></div>
		<script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
		<script>
			Scalar.createApiReference('#app', {
				url: '${escapeHtml(specUrl.toString())}',
				layout: 'modern',
				theme: 'default',
				hideDownloadButton: false,
				darkMode: true,
				operationTitleSource: 'path'
			});
		</script>
	</body>
</html>`;

	return new Response(html, {
		headers: {
			'content-type': 'text/html; charset=utf-8'
		}
	});
};
