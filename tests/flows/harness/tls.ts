/**
 * A throwaway TLS certificate for HTTPS in flow tests, such as a reverse proxy
 * in front of an app. Global setup makes one per run with openssl, which the
 * Playwright image includes; browsers accept it because proxy tests set
 * `ignoreHTTPSErrors`.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Environment variable holding this run's certificate folder */
export const TLS_DIR_ENV = 'FLOWS_TLS_DIR';

/** Make a self-signed certificate for 127.0.0.1 in `dir` */
export function createCertificate(dir: string): void {
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
			'-subj',
			'/CN=127.0.0.1',
			'-addext',
			'subjectAltName=IP:127.0.0.1,DNS:localhost',
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

/** This run's certificate and key */
export function certificate(): { cert: string; key: string } {
	const dir = process.env[TLS_DIR_ENV];
	if (!dir) throw new Error(`${TLS_DIR_ENV} isn't set; global setup makes the certificate`);
	return {
		cert: readFileSync(join(dir, 'cert.pem'), 'utf8'),
		key: readFileSync(join(dir, 'key.pem'), 'utf8')
	};
}
