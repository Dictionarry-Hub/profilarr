/**
 * A fake OpenID Connect provider for flow tests. It runs in the test process
 * on a free port, so SSO sign-ins work offline.
 *
 * It serves what the app's SSO code uses (src/lib/server/utils/auth/oidc.ts):
 * - `/.well-known/openid-configuration`, the discovery document
 * - `/authorize`, a login form that accepts any username and sends the
 *   browser back with a code
 * - `/token`, which checks the client secret and returns an RS256 ID token
 *   with the nonce, `sub`, issuer, audience and `auth_time`
 * - `/jwks`, the key set the app checks the token against
 *
 * The login form always shows, so `prompt=login` re-authentication works too.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { freePort } from '$flows/harness/ports.ts';
import type {
	Misbehaviour,
	RunningSso,
	SsoProvider,
	SsoRequest,
	SsoUser
} from '$flows/helpers/auth/sso/providers.ts';

const CLIENT_ID = 'profilarr-flows';
const CLIENT_SECRET = 'flows-sso-secret';
const KEY_ID = 'flows';

/** The account tests sign in as unless they pass another */
const DEFAULT_USER: SsoUser = { username: 'sso-user', sub: 'sso-user' };

interface PendingCode {
	user: SsoUser;
	nonce: string;
	redirectUri: string;
	authTime: number;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function readForm(req: IncomingMessage): Promise<URLSearchParams> {
	return new Promise((resolveForm) => {
		const chunks: Buffer[] = [];
		req.on('data', (chunk: Buffer) => chunks.push(chunk));
		req.on('end', () => resolveForm(new URLSearchParams(Buffer.concat(chunks).toString('utf8'))));
	});
}

function send(res: ServerResponse, status: number, body: unknown, type = 'application/json') {
	res.writeHead(status, { 'Content-Type': type });
	res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function redirectTo(res: ServerResponse, url: string) {
	res.writeHead(302, { Location: url });
	res.end();
}

/** The login page: a username box and a button, carrying the request on as hidden fields */
function loginPage(query: URLSearchParams): string {
	const hidden = ['redirect_uri', 'state', 'nonce']
		.map(
			(name) => `<input type="hidden" name="${name}" value="${escapeHtml(query.get(name) ?? '')}">`
		)
		.join('');
	return `<!doctype html><html><head><title>Fake SSO</title></head><body>
<form method="post" action="/authorize">${hidden}
<label for="username">Username</label>
<input id="username" name="username" autocomplete="off">
<button type="submit">Sign in</button>
</form></body></html>`;
}

async function startFakeOidc(): Promise<RunningSso> {
	const port = await freePort();
	const issuer = `http://127.0.0.1:${port}`;
	const { publicKey, privateKey } = await generateKeyPair('RS256');
	const jwk = { ...(await exportJWK(publicKey)), kid: KEY_ID, alg: 'RS256', use: 'sig' };

	const users: SsoUser[] = [DEFAULT_USER];
	const requests: SsoRequest[] = [];
	const codes = new Map<string, PendingCode>();
	let misbehaviour: Misbehaviour | null = null;

	async function idToken(pending: PendingCode): Promise<string> {
		const now = Math.floor(Date.now() / 1000);
		const expired = misbehaviour === 'expired-token';
		return await new SignJWT({
			nonce: misbehaviour === 'wrong-nonce' ? 'not-the-nonce' : pending.nonce,
			auth_time: pending.authTime,
			preferred_username: pending.user.username
		})
			.setProtectedHeader({ alg: 'RS256', kid: KEY_ID })
			.setIssuer(misbehaviour === 'wrong-issuer' ? `${issuer}/wrong` : issuer)
			.setAudience(CLIENT_ID)
			.setSubject(pending.user.sub ?? pending.user.username)
			.setIssuedAt(expired ? now - 7200 : now)
			.setExpirationTime(expired ? now - 3600 : now + 300)
			.sign(privateKey);
	}

	async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
		const url = new URL(req.url ?? '/', issuer);
		const method = req.method ?? 'GET';
		const form = method === 'POST' ? await readForm(req) : new URLSearchParams();
		requests.push({ method, path: url.pathname, query: url.searchParams, form });

		if (method === 'GET' && url.pathname === '/.well-known/openid-configuration') {
			return send(res, 200, {
				issuer,
				authorization_endpoint: `${issuer}/authorize`,
				token_endpoint: `${issuer}/token`,
				jwks_uri: `${issuer}/jwks`,
				response_types_supported: ['code'],
				subject_types_supported: ['public'],
				id_token_signing_alg_values_supported: ['RS256']
			});
		}

		if (method === 'GET' && url.pathname === '/jwks') return send(res, 200, { keys: [jwk] });

		if (method === 'GET' && url.pathname === '/authorize') {
			if (url.searchParams.get('client_id') !== CLIENT_ID) {
				return send(res, 400, { error: 'invalid_client' });
			}
			return send(res, 200, loginPage(url.searchParams), 'text/html');
		}

		if (method === 'POST' && url.pathname === '/authorize') {
			const redirectUri = form.get('redirect_uri') ?? '';
			const state = form.get('state') ?? '';
			const back = new URL(redirectUri);
			back.searchParams.set('state', state);
			if (misbehaviour === 'refuse-login') {
				back.searchParams.set('error', 'access_denied');
				return redirectTo(res, back.href);
			}
			const username = form.get('username') ?? '';
			const user = users.find((candidate) => candidate.username === username) ?? {
				username,
				sub: username
			};
			const code = randomUUID();
			codes.set(code, {
				user,
				nonce: form.get('nonce') ?? '',
				redirectUri,
				authTime: Math.floor(Date.now() / 1000)
			});
			back.searchParams.set('code', code);
			return redirectTo(res, back.href);
		}

		if (method === 'POST' && url.pathname === '/token') {
			if (form.get('client_id') !== CLIENT_ID || form.get('client_secret') !== CLIENT_SECRET) {
				return send(res, 401, { error: 'invalid_client' });
			}
			const pending = codes.get(form.get('code') ?? '');
			if (!pending || pending.redirectUri !== form.get('redirect_uri')) {
				return send(res, 400, { error: 'invalid_grant' });
			}
			codes.delete(form.get('code') ?? '');
			return send(res, 200, {
				access_token: randomUUID(),
				token_type: 'Bearer',
				expires_in: 300,
				id_token: await idToken(pending)
			});
		}

		send(res, 404, { error: 'not_found' });
	}

	const server = createServer((req, res) => void handle(req, res));
	await new Promise<void>((resolveListen) => server.listen(port, '127.0.0.1', resolveListen));

	return {
		provider: fakeOidc,
		url: issuer,
		env: {
			OIDC_DISCOVERY_URL: `${issuer}/.well-known/openid-configuration`,
			OIDC_CLIENT_ID: CLIENT_ID,
			OIDC_CLIENT_SECRET: CLIENT_SECRET
		},
		users,
		requests,
		target: async () => {
			// Accepts any redirect URI, so there's nothing to set up
		},
		misbehave: (kind) => {
			misbehaviour = kind;
		},
		signIn: async (page: Page, user: SsoUser = DEFAULT_USER) => {
			await test.step(
				`Sign in as ${user.username} on the fake SSO provider`,
				async () => {
					await expect(page, 'The app should send the browser to the provider').toHaveURL(
						(current) => current.origin === issuer && current.pathname === '/authorize'
					);
					await page.getByLabel('Username').fill(user.username);
					await page.getByRole('button', { name: 'Sign in', exact: true }).click();
					await expect(page, 'The provider should send the browser back').not.toHaveURL(
						(current) => current.origin === issuer
					);
				},
				{ box: true }
			);
		},
		stop: () =>
			new Promise<void>((resolveStop) => {
				server.close(() => resolveStop());
				server.closeAllConnections();
			})
	};
}

export const fakeOidc: SsoProvider = {
	id: 'fake',
	label: 'Fake OIDC',
	needsDocker: false,
	tls: false,
	supports: ['misbehave', 'requests'],
	start: startFakeOidc
};
