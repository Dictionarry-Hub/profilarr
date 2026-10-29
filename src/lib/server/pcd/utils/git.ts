import { execGitSafe } from '#utils/git/exec.ts';

/**
 * Get the highest operation number from COMMITTED files in ops/
 */
export async function getMaxOpNumber(repoPath: string): Promise<number> {
	let maxNum = 0;

	// Use git ls-tree to only count committed files
	const output = await execGitSafe(['ls-tree', '--name-only', 'HEAD', 'ops/'], repoPath);
	if (!output) return maxNum;

	for (const filename of output.split('\n')) {
		if (!filename.trim() || !filename.endsWith('.sql')) continue;
		const basename = filename.replace('ops/', '');
		const match = basename.match(/^(\d+)\./);
		if (match) {
			const num = parseInt(match[1], 10);
			if (num > maxNum) maxNum = num;
		}
	}

	return maxNum;
}
