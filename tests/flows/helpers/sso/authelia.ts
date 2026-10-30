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
 * Authelia also answers a reverse proxy's forward-auth checks
 * (`forwardAuthUrl`). Its default policy asks for a sign-in on every address,
 * so the proxied app needs no rule of its own.
 *
 * Config files are JSON, which Authelia reads as YAML.
 */

import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { generateKeyPairSync, pbkdf2Sync, randomBytes } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { serviceDir, startService, waitForService, type Service } from '#flows/harness/docker.ts';
import { serviceImage } from '#flows/harness/images.ts';
import { freePort } from '#flows/harness/ports.ts';
import { certificatePaths, httpsGet } from '#flows/harness/tls.ts';
import type { RunningSso, SsoProvider, SsoUser } from './providers.ts';

const CLIENT_ID = 'profilarr-flows';

/** The account tests sign in as unless they pass another */
const DEFAULT_USER: SsoUser = { username: 'authelia-user', password: 'flows-authelia-password' };

const secret = () => randomBytes(32).toString('hex');

/** An Authelia page `signIn` handles, or `back` once Authelia sends the browser back */
type AutheliaPage = 'login' | 'consent' | 'password' | 'back';

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
	let targetOrigins: string[] | null = null;

	/** Write the config for the app origins and start Authelia */
	async function launch(origins: string[]): Promise<void> {
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
							// Consent keeps Authelia's default, so each sign-in asks the user to
							// accept Profilarr's request
							redirect_uris: origins.map((origin) => `${origin}/auth/oidc/callback`),
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
		url: issuer,
		env: {
			OIDC_DISCOVERY_URL: `${issuer}/.well-known/openid-configuration`,
			OIDC_CLIENT_ID: CLIENT_ID,
			OIDC_CLIENT_SECRET: clientSecret,
			// The app checks Authelia's certificate on discovery and token requests
			NODE_EXTRA_CA_CERTS: certificatePaths().cert
		},
		users,
		target: async (origins) => {
			if (targetOrigins?.join('\n') === origins.join('\n')) return;
			if (targetOrigins !== null) {
				throw new Error(
					`Authelia already serves ${targetOrigins.join(', ')}; it takes one app per test`
				);
			}
			targetOrigins = origins;
			await launch(origins);
		},
		signIn: async (page: Page, user: SsoUser = DEFAULT_USER) => {
			await test.step(
				`Sign in as ${user.username} on Authelia`,
				async () => {
					const username = page.getByLabel(/^Username/);
					const password = page.getByLabel(/^Password/);
					const accept = page.getByRole('button', { name: 'Accept', exact: true });
					const submit = page.getByRole('button', { name: 'Submit', exact: true });
					await expect(
						username.or(accept),
						'The app should send the browser to Authelia'
					).toBeVisible();
					await expect(page).toHaveURL((current) => current.origin === issuer);

					// Which pages Authelia shows depends on its own session. Without one,
					// it shows its login page. Re-authentication (`prompt=login`) also
					// shows its consent page, where Accept may ask for the password again.
					// Each page is handled until Authelia sends the browser back.
					const nextPage = async (): Promise<AutheliaPage> => {
						let found: AutheliaPage = 'back';
						await expect
							.poll(
								async () => {
									if (new URL(page.url()).origin !== issuer) found = 'back';
									else if (await username.isVisible()) found = 'login';
									else if (await submit.isVisible()) found = 'password';
									else if (await accept.isVisible()) found = 'consent';
									else return false;
									return true;
								},
								{ message: 'Authelia should show a page or send the browser back' }
							)
							.toBe(true);
						return found;
					};

					for (let shown = 0, step = await nextPage(); step !== 'back'; step = await nextPage()) {
						if (++shown > 4) throw new Error(`Authelia kept showing its ${step} page`);
						if (step === 'login') {
							await username.fill(user.username);
							await password.fill(user.password ?? '');
							await page.getByRole('button', { name: 'Sign in', exact: true }).click();
							await expect(username, 'Authelia should accept the sign-in').toBeHidden();
						} else if (step === 'password') {
							await password.fill(user.password ?? '');
							await submit.click();
							await expect(submit, 'Authelia should accept the password').toBeHidden();
						} else {
							await accept.click();
							await expect(accept, 'Authelia should move on from consent').toBeHidden();
						}
					}
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
		forwardAuthUrl: `${issuer}/api/authz/forward-auth`,
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
	supports: ['forwardAuth'],
	start: startAuthelia
};
