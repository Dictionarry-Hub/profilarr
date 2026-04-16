/**
 * Git utility types
 */

export interface GitStatus {
	branch: string;
	isDirty: boolean;
	ahead: number;
	behind: number;
	untracked: string[];
	modified: string[];
	staged: string[];
}

export interface UpdateInfo {
	hasUpdates: boolean;
	commitsBehind: number;
	commitsAhead: number;
	latestRemoteCommit: string;
	currentLocalCommit: string;
}

export interface RepoInfo {
	owner: string;
	repo: string;
	description: string | null;
	stars: number;
	forks: number;
	openIssues: number;
	ownerAvatarUrl: string;
	ownerType: 'User' | 'Organization';
	htmlUrl: string;
}

export type CommitStatus = 'installed' | 'available';

export interface Commit {
	hash: string;
	shortHash: string;
	message: string;
	author: string;
	authorEmail: string;
	date: string;
	files: string[];
	status: CommitStatus;
}

export interface IncomingChanges {
	hasUpdates: boolean;
	commitsBehind: number;
	commits: Commit[];
}
