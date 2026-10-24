/**
 * Authelia as the SSO provider, running in a container next to the test
 * (harness/docker.ts). Its tests are the scenarios in scenarios/auth/sso/.
 *
 * Authelia needs HTTPS, so it serves the run's certificate, and the app
 * trusts that certificate through `NODE_EXTRA_CA_CERTS`. It also needs the
 * exact address it sends the browser back to. That's the app's origin, which
 * is only known once the app has started, so the container starts in
 * `target()` rather than `start()`. The app fetches discovery when a sign-in
 * starts, not at startup, so the order works.
 *
 * Config files are JSON, which Authelia reads as YAML.
 */

import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { generateKeyPairSync, pbkdf2Sync, randomBytes } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { serviceDir, startService, waitForService, type Service } from '$flows/harness/docker.ts';
import { serviceImage } from '$flows/harness/images.ts';
import { freePort } from '$flows/harness/ports.ts';
import { certificatePaths, httpsGet } from '$flows/harness/tls.ts';
import type { RunningSso, SsoProvider, SsoUser } from '$flows/helpers/auth/sso/providers.ts';

const CLIENT_ID = 'profilarr-flows';

/** The account tests sign in as unless they pass another */
const DEFAULT_USER: SsoUser = { username: 'authelia-user', password: 'flows-authelia-password' };

const secret = () => randomBytes(32).toString('hex');

/**
 * A password digest in the go-crypt format Authelia reads:
 * `$pbkdf2-sha512$<iterations>$<salt>$<key>`, both in unpadded base64 with
 * `.` for `+`. Few iterations, because only tests use it.
 */
function passwordDigest(password: string): string {
	const adapted = (bytes: Buffer) =>
		bytes.toString('base64').replace(/=+$/, '').replace(/\+/g, '.');
	const salt = randomBytes(16);
	const key = pbkdf2Sync(password, salt, 1000, 64, 'sha512');
	return `$pbkdf2-sha512$1000$${adapted(salt)}$${adapted(key)}`;
}

async function startAuthelia(): Promise<RunningSso> {
	const port = await freePort();
	const issuer = `https://127.0.0.1:${port}`;
	const clientSecret = secret();
	const users: SsoUser[] = [DEFAULT_USER];
	let service: Service | null = null;
	let targetOrigin: string | null = null;

	/** Write the config for `origin` and start Authelia on it */
	async function launch(origin: string): Promise<void> {
		const dir = await serviceDir();
		const tls = certificatePaths();
		await fs.copyFile(tls.cert, join(dir.path, 'cert.pem'));
		await fs.copyFile(tls.key, join(dir.path, 'key.pem'));

		const { privateKey } = generateKeyPairSync('rsa', {
			modulusLength: 2048,
			privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
			publicKeyEncoding: { type: 'spki', format: 'pem' }
		});
		const configuration = {
			server: {
				address: `tcp://127.0.0.1:${port}/`,
				tls: { certificate: '/config/cert.pem', key: '/config/key.pem' }
			},
			log: { level: 'info' },
			// The container has no network
			ntp: { disable_startup_check: true },
			identity_validation: { reset_password: { jwt_secret: secret() } },
			authentication_backend: {
				password_reset: { disable: true },
				file: { path: '/config/users.yml' }
			},
			access_control: { default_policy: 'one_factor' },
			// Authelia accepts an IP address as the cookie domain
			session: { secret: secret(), cookies: [{ domain: '127.0.0.1', authelia_url: issuer }] },
			storage: { encryption_key: secret(), local: { path: '/config/db.sqlite3' } },
			notifier: { filesystem: { filename: '/config/notification.txt' } },
			identity_providers: {
				oidc: {
					hmac_secret: secret(),
					jwks: [{ key: privateKey }],
					clients: [
						{
							client_id: CLIENT_ID,
							client_name: 'Profilarr',
							// A secret without a `$` prefix is plain text
							client_secret: clientSecret,
							public: false,
							authorization_policy: 'one_factor',
							// No consent page, as for a client the admin set up
							consent_mode: 'implicit',
							redirect_uris: [`${origin}/auth/oidc/callback`],
							// What src/lib/server/utils/auth/oidc.ts asks for and how it sends the secret
							scopes: ['openid', 'email', 'profile'],
							response_types: ['code'],
							grant_types: ['authorization_code'],
							token_endpoint_auth_method: 'client_secret_post'
						}
					]
				}
			}
		};
		const usersFile = {
			users: Object.fromEntries(
				users.map((user) => [
					user.username,
					{
						displayname: user.username,
						password: passwordDigest(user.password ?? ''),
						email: `${user.username}@example.com`,
						groups: []
					}
				])
			)
		};
		await fs.writeFile(join(dir.path, 'configuration.yml'), JSON.stringify(configuration, null, 2));
		await fs.writeFile(join(dir.path, 'users.yml'), JSON.stringify(usersFile, null, 2));

		service = await startService({
			image: serviceImage('authelia'),
			binds: [`${dir.hostPath}:/config`],
			// Files Authelia writes stay the host user's, so teardown can remove them
			user: `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`
		});
		await waitForService(
			service,
			'Authelia',
			async () => (await httpsGet(`${issuer}/api/health`)).status === 200
		);
	}

	return {
		provider: authelia,
		env: {
			OIDC_DISCOVERY_URL: `${issuer}/.well-known/openid-configuration`,
			OIDC_CLIENT_ID: CLIENT_ID,
			OIDC_CLIENT_SECRET: clientSecret,
			// The app checks Authelia's certificate on discovery and token requests
			NODE_EXTRA_CA_CERTS: certificatePaths().cert
		},
		users,
		target: async (origin) => {
			if (targetOrigin === origin) return;
			if (targetOrigin !== null) {
				throw new Error(`Authelia already serves ${targetOrigin}; it takes one app per test`);
			}
			targetOrigin = origin;
			await launch(origin);
		},
		signIn: async (page: Page, user: SsoUser = DEFAULT_USER) => {
			await test.step(
				`Sign in as ${user.username} on Authelia`,
				async () => {
					const username = page.getByLabel(/^Username/);
					const accept = page.getByRole('button', { name: 'Accept', exact: true });
					await expect(
						username.or(accept),
						'The app should send the browser to Authelia'
					).toBeVisible();
					await expect(page).toHaveURL((current) => current.origin === issuer);

					if (await accept.isVisible()) {
						// Re-authentication (`prompt=login`) opens Authelia's consent page for
						// the signed-in user. Accepting asks for the password again.
						await accept.click();
						await page.getByLabel(/^Password/).fill(user.password ?? '');
						await page.getByRole('button', { name: 'Submit', exact: true }).click();
					} else {
						await username.fill(user.username);
						await page.getByLabel(/^Password/).fill(user.password ?? '');
						await page.getByRole('button', { name: 'Sign in', exact: true }).click();
					}
					await expect(page, 'Authelia should send the browser back').not.toHaveURL(
						(current) => current.origin === issuer
					);
				},
				{ box: true }
			);
		},
		get requests(): never {
			throw new Error("Authelia doesn't record requests; use the fake provider");
		},
		misbehave: () => {
			throw new Error("Authelia can't misbehave on purpose; use the fake provider");
		},
		logs: async () => (service ? await service.logs() : 'Authelia never started'),
		stop: async () => {
			await service?.stop();
		}
	};
}

export const authelia: SsoProvider = {
	id: 'authelia',
	label: 'Authelia',
	needsDocker: true,
	tls: true,
	supports: [],
	start: startAuthelia
};
