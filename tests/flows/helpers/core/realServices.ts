/**
 * Tags and skips for tests that need more than every run has. Registry
 * entries (SSO providers, reverse proxies) that run in a container need the
 * Docker socket. A few tests need the internet. Each kind has a tag, so
 * `--grep @docker` or `--grep @online` picks its tests, and a skip for runs
 * that lack it.
 */

import process from 'node:process';
import { test } from '@playwright/test';
import { dockerAvailable } from '#flows/harness/docker.ts';

export const DOCKER_TAG = '@docker';
export const ONLINE_TAG = '@online';

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

/** Whether this run's container has network access (`deno task test:flows --online`) */
export function networkAvailable(): boolean {
	return process.env.FLOWS_ONLINE === '1';
}

/** Skip the running test when it reaches the internet and this run has no network */
export function skipWithoutNetwork(): void {
	test.skip(
		!networkAvailable(),
		'This test reaches the internet, and this run has no network (deno task test:flows --online)'
	);
}
