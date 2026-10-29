/**
 * - Covers: starting a real service container next to a test (docker.ts).
 * - Skipped when the run has no Docker socket.
 */
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { test, expect } from '#flows/helpers/core/test.ts';
import { DOCKER_TAG } from '#flows/helpers/core/realServices.ts';
import { dockerAvailable, serviceDir, startService } from './docker.ts';
import { serviceImage } from './images.ts';
import { freePort } from './ports.ts';

/**
 * Flow:
 * 1. A config folder gets an index.html.
 * 2. A busybox web server starts in the test container's network namespace,
 *    serving that folder on a free loopback port.
 *
 * Expects:
 * - the test reaches the server on 127.0.0.1 and gets the file back
 */
test("a service shares the test container's loopback", { tag: DOCKER_TAG }, async () => {
	test.skip(!dockerAvailable(), 'This run has no Docker socket');
	const dir = await serviceDir();
	await fs.writeFile(join(dir.path, 'index.html'), 'from a service');
	const port = await freePort();

	const service = await startService({
		image: serviceImage('busybox'),
		cmd: ['httpd', '-f', '-p', `127.0.0.1:${port}`, '-h', '/www'],
		binds: [`${dir.hostPath}:/www:ro`]
	});
	try {
		await expect
			.poll(
				async () => {
					try {
						return await (await fetch(`http://127.0.0.1:${port}/index.html`)).text();
					} catch {
						return 'not listening yet';
					}
				},
				{ message: 'the service should answer on loopback' }
			)
			.toBe('from a service');
	} finally {
		await service.stop();
	}
});
