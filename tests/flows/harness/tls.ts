/**
 * A throwaway TLS certificate for HTTPS in flow tests, such as a reverse proxy
 * in front of an app or an SSO provider. Global setup makes one per run with
 * openssl, which the Playwright image includes; browsers accept it because
 * HTTPS tests set `ignoreHTTPSErrors`.
 *
 * The certificate is a leaf (`CA:FALSE`), so the app trusts it through
 * `NODE_EXTRA_CA_CERTS`. Deno rejects a self-signed certificate marked as a
 * CA, which is the `openssl req -x509` default.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { request } from 'node:https';
import { join } from 'node:path';

/** Environment variable holding this run's certificate folder */
export const TLS_DIR_ENV = 'FLOWS_TLS_DIR';

const OPENSSL_CONFIG = `[req]
distinguished_name = dn
prompt = no

[dn]
CN = 127.0.0.1

[leaf]
basicConstraints = critical, CA:FALSE
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = IP:127.0.0.1, DNS:localhost, DNS:profilarr.test
`;

/** Make a self-signed leaf certificate for 127.0.0.1 in `dir` */
export function createCertificate(dir: string): void {
	const config = join(dir, 'openssl.cnf');
	writeFileSync(config, OPENSSL_CONFIG);
	const result = spawnSync(
		'openssl',
		[
			'req',
			'-x509',
			'-newkey',
			'rsa:2048',
			'-nodes',
			'-days',
			'1',
			'-config',
			config,
			'-extensions',
			'leaf',
			'-keyout',
			join(dir, 'key.pem'),
			'-out',
			join(dir, 'cert.pem')
		],
		{ encoding: 'utf8' }
	);
	if (result.status !== 0) {
		throw new Error(`openssl couldn't make the test certificate:\n${result.stderr}`);
	}
}

/** Where this run's certificate and key live */
export function certificatePaths(): { cert: string; key: string } {
	const dir = process.env[TLS_DIR_ENV];
	if (!dir) throw new Error(`${TLS_DIR_ENV} isn't set; global setup makes the certificate`);
	return { cert: join(dir, 'cert.pem'), key: join(dir, 'key.pem') };
}

/** This run's certificate and key */
export function certificate(): { cert: string; key: string } {
	const paths = certificatePaths();
	return { cert: readFileSync(paths.cert, 'utf8'), key: readFileSync(paths.key, 'utf8') };
}

/**
 * GET an HTTPS URL that serves this run's certificate, trusting only that
 * certificate. Readiness checks for real services use it.
 */
export function httpsGet(url: string): Promise<{ status: number; body: string }> {
	return new Promise((resolveGet, rejectGet) => {
		const req = request(url, { ca: certificate().cert, timeout: 2_000 }, (res) => {
			const chunks: Buffer[] = [];
			res.on('data', (chunk: Buffer) => chunks.push(chunk));
			res.on('end', () =>
				resolveGet({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') })
			);
		});
		req.on('timeout', () => req.destroy(new Error(`${url} didn't answer in time`)));
		req.on('error', rejectGet);
		req.end();
	});
}
