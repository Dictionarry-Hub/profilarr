/**
 * Every container image a real service in the flow suite runs, read from
 * tests/flows/services.Dockerfile, where Dependabot keeps the pins current.
 * `deno task flows` pulls any that are missing on the host before the run,
 * because the test container has no network. Imports only Node built-ins, so
 * the runner script can read it outside the test container.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

export const SERVICES_DOCKERFILE = resolve(process.cwd(), 'tests/flows/services.Dockerfile');

/** Each `FROM <image> AS <name>` line, keyed by name */
function readImages(): Record<string, string> {
	const images: Record<string, string> = {};
	for (const line of readFileSync(SERVICES_DOCKERFILE, 'utf8').split('\n')) {
		const match = line.match(/^FROM\s+(\S+)\s+AS\s+(\S+)/i);
		if (match) images[match[2]] = match[1];
	}
	return images;
}

export const SERVICE_IMAGES = readImages();

/** One service's pinned image; an unknown name fails with the names that exist */
export function serviceImage(name: string): string {
	const image = SERVICE_IMAGES[name];
	if (!image) {
		const known = Object.keys(SERVICE_IMAGES).join(', ');
		throw new Error(`services.Dockerfile has no stage "${name}". Known: ${known}`);
	}
	return image;
}
