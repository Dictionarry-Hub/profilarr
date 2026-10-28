/**
 * Tests for the external command runner used by git and backup code.
 */

import { test } from 'vitest';
import { assertEquals, assertRejects } from '@std/assert';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { runCommand } from '$utils/command.ts';

const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

test('runCommand: returns output and exit code 0 on success', async () => {
	const result = await runCommand('sh', ['-c', 'echo out; echo err >&2']);
	assertEquals(result.code, 0);
	assertEquals(result.signal, null);
	assertEquals(decode(result.stdout), 'out\n');
	assertEquals(decode(result.stderr), 'err\n');
});

test('runCommand: returns a non-zero exit code instead of throwing', async () => {
	const result = await runCommand('sh', ['-c', 'echo failed >&2; exit 3']);
	assertEquals(result.code, 3);
	assertEquals(decode(result.stderr), 'failed\n');
});

test('runCommand: adds env to the parent environment', async () => {
	const result = await runCommand('sh', ['-c', 'printf "%s|%s" "$RUN_COMMAND_TEST" "$PATH"'], {
		env: { RUN_COMMAND_TEST: 'added' }
	});
	assertEquals(decode(result.stdout), `added|${process.env.PATH}`);
});

test('runCommand: gives the child an empty stdin', async () => {
	// cat would wait until the timeout if stdin were left as an open pipe
	const result = await runCommand('cat', [], { timeoutMs: 5000 });
	assertEquals(result.code, 0);
	assertEquals(decode(result.stdout), '');
});

test('runCommand: runs in cwd', async () => {
	const dir = await fs.mkdtemp(join(tmpdir(), 'run-command-'));
	try {
		const result = await runCommand('pwd', [], { cwd: dir });
		assertEquals(decode(result.stdout).trim(), await fs.realpath(dir));
	} finally {
		await fs.rm(dir, { recursive: true });
	}
});

test('runCommand: collects output beyond 1 MB', async () => {
	const result = await runCommand('head', ['-c', '2000000', '/dev/zero']);
	assertEquals(result.code, 0);
	assertEquals(result.stdout.length, 2_000_000);
});

test('runCommand: sends SIGTERM when the timeout passes', async () => {
	const result = await runCommand('sleep', ['5'], { timeoutMs: 100 });
	assertEquals(result.code, null);
	assertEquals(result.signal, 'SIGTERM');
});

test('runCommand: rejects when the program does not exist', async () => {
	const error = await assertRejects(() => runCommand('profilarr-no-such-program', []));
	assertEquals((error as { code?: string }).code, 'ENOENT');
});
