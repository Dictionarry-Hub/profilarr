/**
 * Tests for the external command runner used by git and backup code.
 */

import { expect, test } from 'vitest';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { runCommand } from '#utils/command.ts';

const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

test('runCommand: returns output and exit code 0 on success', async () => {
	const result = await runCommand('sh', ['-c', 'echo out; echo err >&2']);
	expect(result.code).toStrictEqual(0);
	expect(result.signal).toStrictEqual(null);
	expect(decode(result.stdout)).toStrictEqual('out\n');
	expect(decode(result.stderr)).toStrictEqual('err\n');
});

test('runCommand: returns a non-zero exit code instead of throwing', async () => {
	const result = await runCommand('sh', ['-c', 'echo failed >&2; exit 3']);
	expect(result.code).toStrictEqual(3);
	expect(decode(result.stderr)).toStrictEqual('failed\n');
});

test('runCommand: adds env to the parent environment', async () => {
	const result = await runCommand('sh', ['-c', 'printf "%s|%s" "$RUN_COMMAND_TEST" "$PATH"'], {
		env: { RUN_COMMAND_TEST: 'added' }
	});
	expect(decode(result.stdout)).toStrictEqual(`added|${process.env.PATH}`);
});

test('runCommand: gives the child an empty stdin', async () => {
	// cat would wait until the timeout if stdin were left as an open pipe
	const result = await runCommand('cat', [], { timeoutMs: 5000 });
	expect(result.code).toStrictEqual(0);
	expect(decode(result.stdout)).toStrictEqual('');
});

test('runCommand: runs in cwd', async () => {
	const dir = await fs.mkdtemp(join(tmpdir(), 'run-command-'));
	try {
		const result = await runCommand('pwd', [], { cwd: dir });
		expect(decode(result.stdout).trim()).toStrictEqual(await fs.realpath(dir));
	} finally {
		await fs.rm(dir, { recursive: true });
	}
});

test('runCommand: collects output beyond 1 MB', async () => {
	const result = await runCommand('head', ['-c', '2000000', '/dev/zero']);
	expect(result.code).toStrictEqual(0);
	expect(result.stdout.length).toStrictEqual(2_000_000);
});

test('runCommand: sends SIGTERM when the timeout passes', async () => {
	const result = await runCommand('sleep', ['5'], { timeoutMs: 100 });
	expect(result.code).toStrictEqual(null);
	expect(result.signal).toStrictEqual('SIGTERM');
});

test('runCommand: rejects when the program does not exist', async () => {
	const error = await runCommand('profilarr-no-such-program', []).catch((e: unknown) => e);
	expect((error as { code?: string }).code).toStrictEqual('ENOENT');
});
