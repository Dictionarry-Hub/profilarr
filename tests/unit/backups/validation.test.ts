/**
 * Unit tests for backup filename validation and path resolution.
 */

import { assertEquals } from '@std/assert';
import {
	isValidBackupFilename,
	resolveBackupPath
} from '../../../src/lib/server/utils/backup/validation.ts';

// ─── isValidBackupFilename ───────────────────────────────────────────────────

Deno.test('valid standard backup filename', () => {
	assertEquals(isValidBackupFilename('backup-2025-01-15-143045.tar.gz'), true);
});

Deno.test('valid uploaded backup filename', () => {
	assertEquals(isValidBackupFilename('backup-uploaded-1234567890.tar.gz'), true);
});

Deno.test('rejects filename without backup- prefix', () => {
	assertEquals(isValidBackupFilename('notbackup-2025-01-15.tar.gz'), false);
});

Deno.test('rejects filename without .tar.gz suffix', () => {
	assertEquals(isValidBackupFilename('backup-2025-01-15.zip'), false);
});

Deno.test('rejects filename with ../', () => {
	assertEquals(isValidBackupFilename('backup-../../../etc/passwd.tar.gz'), false);
});

Deno.test('rejects filename with forward slash', () => {
	assertEquals(isValidBackupFilename('backup-foo/bar.tar.gz'), false);
});

Deno.test('rejects filename with backslash', () => {
	assertEquals(isValidBackupFilename('backup-foo\\bar.tar.gz'), false);
});

Deno.test('rejects filename with null byte', () => {
	assertEquals(isValidBackupFilename('backup-foo\x00bar.tar.gz'), false);
});

Deno.test('rejects empty string', () => {
	assertEquals(isValidBackupFilename(''), false);
});

// ─── resolveBackupPath ───────────────────────────────────────────────────────

Deno.test('resolves valid filename to path inside backups dir', () => {
	const result = resolveBackupPath('backup-2025-01-15-143045.tar.gz', '/tmp/backups');
	assertEquals(result, '/tmp/backups/backup-2025-01-15-143045.tar.gz');
});

Deno.test('returns null for invalid filename', () => {
	const result = resolveBackupPath('../../../etc/passwd', '/tmp/backups');
	assertEquals(result, null);
});

Deno.test('returns null for filename that would escape backups dir', () => {
	const result = resolveBackupPath('backup-../secret.tar.gz', '/tmp/backups');
	assertEquals(result, null);
});
