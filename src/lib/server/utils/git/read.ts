/**
 * Git status queries (read-only)
 */

import { execGit, execGitSafe } from './exec.ts';
import { fetch } from './write.ts';
import { validateFilePaths } from '../paths.ts';
import type { GitStatus, UpdateInfo, Commit, CommitStatus, IncomingChanges } from './types.ts';

function normalizeAuthorName(name: string): string {
	const trimmed = name.trim();
	const normalized = trimmed.toLowerCase().replace(/\s+/g, ' ');
	if (normalized === 'xshatterx') return 'Seraphys';
	if (normalized === 'sam chau' || normalized === 'samuel chau') {
		return 'santiagosayshey';
	}
	return trimmed;
}

/**
 * Get current branch name
 */
export async function getBranch(repoPath: string): Promise<string> {
	return await execGit(['branch', '--show-current'], repoPath);
}

export interface GetStatusOptions {
	/** Whether to fetch from remote first (slower but accurate ahead/behind) */
	fetch?: boolean;
}

/**
 * Get full repository status
 */
export async function getStatus(
	repoPath: string,
	options: GetStatusOptions = {}
): Promise<GitStatus> {
	const branch = await getBranch(repoPath);

	// Optionally fetch to get accurate ahead/behind
	if (options.fetch) {
		await fetch(repoPath);
	}

	// Get ahead/behind
	let ahead = 0;
	let behind = 0;
	const revOutput = await execGitSafe(
		['rev-list', '--left-right', '--count', `origin/${branch}...HEAD`],
		repoPath
	);
	if (revOutput) {
		const parts = revOutput.split('\t').map((n) => parseInt(n, 10) || 0);
		behind = parts[0] || 0;
		ahead = parts[1] || 0;
	}

	// Get file status — use raw output to preserve leading spaces in porcelain format
	const statusCmd = new Deno.Command('git', {
		args: ['status', '--porcelain'],
		cwd: repoPath,
		stdout: 'piped',
		stderr: 'piped'
	});
	const statusResult = await statusCmd.output();
	const statusOutput = new TextDecoder().decode(statusResult.stdout);
	const untracked: string[] = [];
	const modified: string[] = [];
	const staged: string[] = [];

	for (const line of statusOutput.split('\n')) {
		if (!line || line.length < 4) continue;

		const status = line.substring(0, 2);
		const file = line.substring(3);

		if (status.startsWith('??')) {
			untracked.push(file);
		} else if (status[1] === 'M' || status[1] === 'D') {
			modified.push(file);
		}
		if (status[0] === 'M' || status[0] === 'A' || status[0] === 'D') {
			staged.push(file);
		}
	}

	const isDirty = untracked.length > 0 || modified.length > 0 || staged.length > 0;

	return { branch, isDirty, ahead, behind, untracked, modified, staged };
}

/**
 * Check for updates from remote
 */
export async function checkForUpdates(repoPath: string): Promise<UpdateInfo> {
	await fetch(repoPath);

	const branch = await getBranch(repoPath);
	const remoteBranch = `origin/${branch}`;

	const currentLocalCommit = await execGit(['rev-parse', 'HEAD'], repoPath);

	let latestRemoteCommit: string;
	try {
		latestRemoteCommit = await execGit(['rev-parse', remoteBranch], repoPath);
	} catch {
		return {
			hasUpdates: false,
			commitsBehind: 0,
			commitsAhead: 0,
			latestRemoteCommit: currentLocalCommit,
			currentLocalCommit
		};
	}

	const behindOutput = await execGitSafe(
		['rev-list', '--count', `HEAD..${remoteBranch}`],
		repoPath
	);
	const commitsBehind = parseInt(behindOutput || '0') || 0;

	const aheadOutput = await execGitSafe(['rev-list', '--count', `${remoteBranch}..HEAD`], repoPath);
	const commitsAhead = parseInt(aheadOutput || '0') || 0;

	return {
		hasUpdates: commitsBehind > 0,
		commitsBehind,
		commitsAhead,
		latestRemoteCommit,
		currentLocalCommit
	};
}

/**
 * Get all local and remote branches
 */
export async function getBranches(repoPath: string): Promise<string[]> {
	// Get all branches (local and remote tracking)
	const output = await execGit(['branch', '-a', '--format=%(refname:short)'], repoPath);
	const branches = output
		.split('\n')
		.map((b) => b.trim())
		.filter((b) => b && !b.includes('HEAD'))
		.map((b) => b.replace(/^origin\//, ''))
		.filter((b, i, arr) => arr.indexOf(b) === i); // dedupe

	return branches;
}

/**
 * Get diff for specific files (or all uncommitted changes if no files specified)
 * Handles both tracked (modified) and untracked (new) files
 */
export async function getDiff(repoPath: string, filepaths?: string[]): Promise<string> {
	const diffs: string[] = [];

	if (filepaths && filepaths.length > 0) {
		validateFilePaths(repoPath, filepaths);
		for (const filepath of filepaths) {
			const relativePath = filepath.startsWith(repoPath + '/')
				? filepath.slice(repoPath.length + 1)
				: filepath;

			// Check if file is untracked
			const status = await execGitSafe(['status', '--porcelain', relativePath], repoPath);
			const isUntracked = status?.startsWith('??');

			if (isUntracked) {
				// For untracked files, show as new file diff
				try {
					const content = await Deno.readTextFile(`${repoPath}/${relativePath}`);
					diffs.push(`diff --git a/${relativePath} b/${relativePath}
new file mode 100644
--- /dev/null
+++ b/${relativePath}
@@ -0,0 +1,${content.split('\n').length} @@
${content
	.split('\n')
	.map((line) => '+' + line)
	.join('\n')}`);
				} catch {
					// File doesn't exist or can't be read
				}
			} else {
				// For tracked files, use git diff
				const diff = await execGitSafe(['diff', 'HEAD', '--', relativePath], repoPath);
				if (diff) {
					diffs.push(diff);
				}
			}
		}
	} else {
		// No specific files, get all changes
		const diff = await execGitSafe(['diff', 'HEAD'], repoPath);
		if (diff) {
			diffs.push(diff);
		}
	}

	return diffs.join('\n\n');
}

/**
 * Get commit history. The `status` tags each returned commit: pass `'installed'`
 * for refs reachable from HEAD, `'available'` for upstream-only ranges (e.g.
 * `HEAD..origin/<branch>`). `offset` translates to `--skip=N` for pagination.
 */
export async function getCommits(
	repoPath: string,
	limit: number = 50,
	ref: string | undefined,
	status: CommitStatus,
	offset: number = 0
): Promise<Commit[]> {
	if (limit <= 0) return [];

	// Format: hash|shortHash|message|author|email|date
	const format = '%H|%h|%s|%an|%ae|%cI';
	const args = ['log', `--format=${format}`, `-${limit}`];
	if (offset > 0) args.push(`--skip=${offset}`);
	if (ref) args.push(ref);
	const output = await execGit(args, repoPath);

	if (!output.trim()) {
		return [];
	}

	const commits: Commit[] = [];

	for (const line of output.split('\n')) {
		if (!line.trim()) continue;

		const [hash, shortHash, message, author, authorEmail, date] = line.split('|');

		// Get files changed for this commit
		const statOutput = await execGitSafe(
			['diff-tree', '--no-commit-id', '--name-only', '-r', hash],
			repoPath
		);
		const files = statOutput ? statOutput.split('\n').filter((f) => f.trim()) : [];

		commits.push({
			hash,
			shortHash,
			message,
			author: normalizeAuthorName(author),
			authorEmail,
			date,
			files,
			status
		});
	}

	return commits;
}

/**
 * Count commits reachable from a ref expression (e.g. `HEAD`,
 * `HEAD..origin/main`). Returns 0 if the rev-list fails (e.g. branch missing).
 */
export async function countCommits(repoPath: string, ref: string): Promise<number> {
	const output = await execGitSafe(['rev-list', '--count', ref], repoPath);
	return parseInt(output || '0', 10) || 0;
}

/**
 * Get incoming changes (commits available to pull from remote)
 */
export async function getIncomingChanges(repoPath: string): Promise<IncomingChanges> {
	await fetch(repoPath);

	const branch = await getBranch(repoPath);
	const remoteBranch = `origin/${branch}`;

	// Count commits behind
	const countOutput = await execGitSafe(['rev-list', '--count', `HEAD..${remoteBranch}`], repoPath);
	const commitsBehind = parseInt(countOutput || '0') || 0;

	if (commitsBehind === 0) {
		return { hasUpdates: false, commitsBehind: 0, commits: [] };
	}

	// Get commit details for incoming commits
	const format = '%H|%h|%s|%an|%ae|%cI';
	const output = await execGit(['log', `--format=${format}`, `HEAD..${remoteBranch}`], repoPath);

	const commits: Commit[] = [];

	for (const line of output.split('\n')) {
		if (!line.trim()) continue;

		const [hash, shortHash, message, author, authorEmail, date] = line.split('|');

		// Get files changed for this commit
		const filesOutput = await execGitSafe(
			['diff-tree', '--no-commit-id', '--name-only', '-r', hash],
			repoPath
		);
		const files = filesOutput ? filesOutput.split('\n').filter((f) => f.trim()) : [];

		commits.push({
			hash,
			shortHash,
			message,
			author: normalizeAuthorName(author),
			authorEmail,
			date,
			files,
			status: 'available'
		});
	}

	return { hasUpdates: true, commitsBehind, commits };
}

/**
 * Get commit messages between two refs (e.g. oldHead..newHead)
 */
export async function getCommitMessagesBetween(
	repoPath: string,
	fromRef: string,
	toRef: string
): Promise<string[]> {
	const output = await execGitSafe(['log', '--format=%s', `${fromRef}..${toRef}`], repoPath);
	if (!output) return [];
	return output.split('\n').filter((line) => line.trim());
}
