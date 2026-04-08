import type { RequestHandler } from './$types';
import { getCachedAvatar } from '$lib/server/utils/github/cache.ts';

async function hashBytes(bytes: Uint8Array): Promise<string> {
	const hashBuffer = await crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const GET: RequestHandler = async ({ params, request }) => {
	const { owner } = params;

	if (!owner) {
		return new Response('Missing owner parameter', {
			status: 400,
			headers: { 'Cache-Control': 'no-store' }
		});
	}

	const dataUrl = await getCachedAvatar(owner);

	if (!dataUrl) {
		return new Response('Avatar not found', {
			status: 404,
			headers: { 'Cache-Control': 'no-store' }
		});
	}

	// Parse the data URL to extract content type and base64 data
	const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
	if (!match) {
		return new Response('Invalid cached avatar data', {
			status: 500,
			headers: { 'Cache-Control': 'no-store' }
		});
	}

	const [, contentType, base64Data] = match;

	// Convert base64 to binary
	const binaryString = atob(base64Data);
	const bytes = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}

	const etag = `"${await hashBytes(bytes)}"`;
	const ifNoneMatch = request.headers.get('if-none-match');
	if (ifNoneMatch && ifNoneMatch === etag) {
		return new Response(null, {
			status: 304,
			headers: {
				'Cache-Control': 'private, max-age=0, must-revalidate',
				ETag: etag
			}
		});
	}

	return new Response(bytes, {
		headers: {
			'Content-Type': contentType,
			'Cache-Control': 'private, max-age=0, must-revalidate',
			ETag: etag
		}
	});
};
