/**
 * Unit tests for backup filename validation and path resolution.
 */

import { expect, test } from 'vitest';
import { isValidBackupFilename, resolveBackupPath } from '#utils/backup/validation.ts';

// ─── isValidBackupFilename ───────────────────────────────────────────────────

test('valid standard backup filename', () => {
	expect(isValidBackupFilename('backup-2025-01-15-143045.tar.gz')).toStrictEqual(true);
});

test('valid uploaded backup filename', () => {
	expect(isValidBackupFilename('backup-uploaded-1234567890.tar.gz')).toStrictEqual(true);
});

test('rejects filename without backup- prefix', () => {
	expect(isValidBackupFilename('notbackup-2025-01-15.tar.gz')).toStrictEqual(false);
});

test('rejects filename without .tar.gz suffix', () => {
	expect(isValidBackupFilename('backup-2025-01-15.zip')).toStrictEqual(false);
});

test('rejects filename with ../', () => {
	expect(isValidBackupFilename('backup-../../../etc/passwd.tar.gz')).toStrictEqual(false);
});

test('rejects filename with forward slash', () => {
	expect(isValidBackupFilename('backup-foo/bar.tar.gz')).toStrictEqual(false);
});

test('rejects filename with backslash', () => {
	expect(isValidBackupFilename('backup-foo\\bar.tar.gz')).toStrictEqual(false);
});

test('rejects filename with null byte', () => {
	expect(isValidBackupFilename('backup-foo\x00bar.tar.gz')).toStrictEqual(false);
});

test('rejects empty string', () => {
	expect(isValidBackupFilename('')).toStrictEqual(false);
});

// ─── resolveBackupPath ───────────────────────────────────────────────────────

test('resolves valid filename to path inside backups dir', () => {
	const result = resolveBackupPath('backup-2025-01-15-143045.tar.gz', '/tmp/backups');
	expect(result).toStrictEqual('/tmp/backups/backup-2025-01-15-143045.tar.gz');
});

test('returns null for invalid filename', () => {
	const result = resolveBackupPath('../../../etc/passwd', '/tmp/backups');
	expect(result).toStrictEqual(null);
});

test('returns null for filename that would escape backups dir', () => {
	const result = resolveBackupPath('backup-../secret.tar.gz', '/tmp/backups');
	expect(result).toStrictEqual(null);
});
