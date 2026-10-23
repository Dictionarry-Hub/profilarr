/**
 * Tests that loop over a registry (SSO providers, reverse proxies) use these
 * so entries that run in a container are skipped when the run has no Docker
 * socket. Such tests carry the `@docker` tag, so `--grep @docker` picks them.
 */

import { test } from '@playwright/test';
import { dockerAvailable } from '$flows/harness/docker.ts';

export const DOCKER_TAG = '@docker';

/** The tags for a test over `entry`: `@docker` when it runs in a container */
export function tagsFor(entry: { needsDocker: boolean }): string[] {
	return entry.needsDocker ? [DOCKER_TAG] : [];
}

/** Skip the running test when `entry` needs a container and this run can't start one */
export function skipWithoutDocker(entry: { id: string; needsDocker: boolean }): void {
	test.skip(
		entry.needsDocker && !dockerAvailable(),
		`${entry.id} runs in a container, and this run has no Docker socket`
	);
}
