import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import { pcdOpsQueries } from '$db/queries/pcdOps.ts';
import { pcdOpHistoryQueries } from '$db/queries/pcdOpHistory.ts';
import { logger } from '$logger/logger.ts';
import { stage, commit, configureIdentity } from '$utils/git/write.ts';
import { execGit } from '$utils/git/exec.ts';
import { getBranch, getStatus } from '$utils/git/read.ts';
import { compile } from '../database/compiler.ts';
import { canWriteToBase } from './writer.ts';
import { listDraftEntityChanges } from './draftChanges.ts';
import { uuid } from '$shared/utils/uuid.ts';
import { validateFilePaths } from '$utils/paths.ts';
import { getMaxOpNumber } from '$pcd/utils/git.ts';
import { loadManifest } from '$pcd/manifest/manifest.ts';

type ExportResult =
	| {
			success: true;
			filename: string | null;
			opId: number | null;
			dropped: number;
			fileCount: number;
	  }
	| { success: false; error: string };

type ExportPreflightChecks = {
	repoExists: boolean;
	manifestValid: boolean;
	remoteReachable: boolean;
	clean: boolean;
	upToDate: boolean;
	ahead: number;
	behind: number;
	identitySet: boolean;
	canWriteToBase: boolean;
	branch: string | null;
};

type ExportPreflightStatus = Awaited<ReturnType<typeof getStatus>>;

type ExportPreflight = {
	ok: boolean;
	errors: string[];
	checks: ExportPreflightChecks;
	status?: ExportPreflightStatus;
};

type ExportPlan = {
	filename: string;
	filepath: string;
	fileContent: string;
	dbSql: string;
	metadataJson: string;
	contentHash: string;
	opIds: number[];
	exportedAt: string;
	opNumber: number;
	ops: Array<NonNullable<ReturnType<typeof pcdOpsQueries.getById>>>;
};

type ExportPreview = {
	ok: boolean;
	errors: string[];
	checks: ExportPreflightChecks;
	status?: ExportPreflightStatus;
	filename?: string;
	filepath?: string;
	content?: string;
	contentHash?: string;
	opIds?: number[];
	opCount?: number;
	filePaths?: string[];
	exportedAt?: string;
	commitMessage?: string;
	gitIdentity?: { name: string; email: string };
};

type PreviewResult = { success: true; preview: ExportPreview } | { success: false; error: string };

type ParsedMetadata = {
	operation?: string;
	entity?: string;
	name?: string;
	group_id?: string;
};

function isCleanEnough(status: ExportPreflightStatus): boolean {
	if (!status.isDirty) return true;
	// Staged files indicate a manual git operation in progress — block export
	if (status.staged.length > 0) return false;
	// Modified and untracked files are OK — the clone only has committed state,
	// and selected file changes get explicitly copied into the clone
	return true;
}

function slugify(value: string): string {
	const slug = value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60);
	return slug.length > 0 ? slug : 'export-batch';
}

function buildHeader(message: string, opIds: number[], exportedAt: string): string {
	const ids = opIds.join(', ');
	return [
		'-- @operation: export',
		'-- @entity: batch',
		`-- @name: ${message}`,
		`-- @exportedAt: ${exportedAt}`,
		`-- @opIds: ${ids}`
	].join('\n');
}

function buildMetadataJson(message: string, opIds: number[], exportedAt: string): string {
	return JSON.stringify({
		operation: 'export',
		entity: 'batch',
		name: message,
		exported_at: exportedAt,
		op_ids: opIds
	});
}

function opLabel(op: { metadata?: string | null }): string | null {
	if (!op.metadata) return null;
	try {
		const parsed = JSON.parse(op.metadata) as ParsedMetadata;
		if (!parsed.operation || !parsed.entity || !parsed.name) return null;
		return `${parsed.operation} ${parsed.entity} "${parsed.name}"`;
	} catch {
		return null;
	}
}

function formatOpBlock(op: { id: number; metadata?: string | null; sql: string }): string {
	const label = opLabel(op);
	const trimmedSql = op.sql.trim().replace(/;\s*$/, '');
	const title = label ? ` ( ${label} )` : '';
	return [`-- --- BEGIN op ${op.id}${title}`, `${trimmedSql};`, `-- --- END op ${op.id}`].join(
		'\n'
	);
}

function buildChangeMaps(databaseId: number) {
	const changes = listDraftEntityChanges(databaseId);
	const changeByKey = new Map(changes.map((change) => [change.key, change]));
	const changeByOpId = new Map<number, string>();
	const groupMap = new Map<string, string[]>();

	for (const change of changes) {
		for (const op of change.ops) {
			changeByOpId.set(op.id, change.key);
		}
		if (change.groupId) {
			const entries = groupMap.get(change.groupId) ?? [];
			entries.push(change.key);
			groupMap.set(change.groupId, entries);
		}
	}

	return { changes, changeByKey, changeByOpId, groupMap };
}

function buildRemoteUrl(repositoryUrl: string, personalAccessToken?: string | null): string {
	if (!personalAccessToken) return repositoryUrl;
	if (!repositoryUrl.startsWith('https://github.com')) return repositoryUrl;
	return repositoryUrl.replace('https://github.com', `https://${personalAccessToken}@github.com`);
}

async function fetchRemoteBranch(
	repoPath: string,
	remoteUrl: string,
	branch: string
): Promise<void> {
	await execGit(
		['fetch', '--quiet', remoteUrl, `${branch}:refs/remotes/origin/${branch}`],
		repoPath
	);
}

async function getAheadBehind(
	repoPath: string,
	branch: string
): Promise<{ ahead: number; behind: number }> {
	const output = await execGit(
		['rev-list', '--left-right', '--count', `origin/${branch}...HEAD`],
		repoPath
	);
	const parts = output.split('\t').map((value) => parseInt(value, 10) || 0);
	return {
		behind: parts[0] || 0,
		ahead: parts[1] || 0
	};
}

async function runPreflight(databaseId: number): Promise<ExportPreflight> {
	const database = databaseInstancesQueries.getById(databaseId);
	const checks: ExportPreflightChecks = {
		repoExists: false,
		manifestValid: false,
		remoteReachable: false,
		clean: false,
		upToDate: false,
		ahead: 0,
		behind: 0,
		identitySet: false,
		canWriteToBase: false,
		branch: null
	};
	const errors: string[] = [];
	let status: ExportPreflightStatus | undefined = undefined;

	if (!database) {
		return {
			ok: false,
			errors: ['Database not found'],
			checks,
			status
		};
	}

	checks.canWriteToBase = canWriteToBase(databaseId);
	if (!checks.canWriteToBase) {
		errors.push('This database cannot publish changes.');
	}

	const gitUserName = database.git_user_name?.trim() ?? '';
	const gitUserEmail = database.git_user_email?.trim() ?? '';
	if (gitUserName && gitUserEmail) {
		checks.identitySet = true;
	} else {
		errors.push('Git author name and email are required to export changes.');
	}

	try {
		await Deno.stat(database.local_path);
		checks.repoExists = true;
	} catch {
		errors.push('Repository not found on disk.');
	}

	if (!checks.repoExists) {
		return { ok: false, errors, checks, status };
	}

	try {
		await loadManifest(database.local_path);
		checks.manifestValid = true;
	} catch (error) {
		errors.push(error instanceof Error ? error.message : 'Manifest validation failed.');
	}

	try {
		const branch = await getBranch(database.local_path);
		checks.branch = branch || null;
		if (!branch) {
			errors.push('Repository is not on a branch.');
		} else {
			const remoteUrl = buildRemoteUrl(database.repository_url, database.personal_access_token);
			await fetchRemoteBranch(database.local_path, remoteUrl, branch);
			checks.remoteReachable = true;

			status = await getStatus(database.local_path);
			const { ahead, behind } = await getAheadBehind(database.local_path, branch);
			status = { ...status, ahead, behind };
			checks.ahead = ahead;
			checks.behind = behind;

			checks.clean = isCleanEnough(status);
			if (!checks.clean) {
				errors.push('Repository has uncommitted changes.');
			}

			checks.upToDate = ahead === 0 && behind === 0;
			if (behind > 0) {
				errors.push(`Repository is behind remote by ${behind} commit${behind === 1 ? '' : 's'}.`);
			}
			if (ahead > 0) {
				errors.push(`Repository has ${ahead} unpushed commit${ahead === 1 ? '' : 's'}.`);
			}
		}
	} catch {
		errors.push('Failed to reach remote repository.');
	}

	return {
		ok: errors.length === 0,
		errors,
		checks,
		status
	};
}

function resolveSelectedOps(databaseId: number, opIds: number[]) {
	const { changeByKey, changeByOpId, groupMap } = buildChangeMaps(databaseId);
	const selectedKeys = new Set<string>();
	for (const opId of opIds) {
		const key = changeByOpId.get(opId);
		if (key) selectedKeys.add(key);
	}

	if (selectedKeys.size === 0) {
		return { ops: [], selectedKeys };
	}

	const queue = Array.from(selectedKeys);
	while (queue.length > 0) {
		const key = queue.shift();
		if (!key) continue;
		const change = changeByKey.get(key);
		if (!change) continue;

		if (change.groupId && groupMap.has(change.groupId)) {
			for (const groupKey of groupMap.get(change.groupId) ?? []) {
				if (!selectedKeys.has(groupKey)) {
					selectedKeys.add(groupKey);
					queue.push(groupKey);
				}
			}
		}

		if (change.requires && change.requires.length > 0) {
			for (const requirement of change.requires) {
				const required = changeByKey.get(requirement.key);
				if (!required || required.operation !== 'create') continue;
				if (!selectedKeys.has(required.key)) {
					selectedKeys.add(required.key);
					queue.push(required.key);
				}
			}
		}
	}

	const opMap = new Map<number, ReturnType<typeof pcdOpsQueries.getById>>();
	for (const key of selectedKeys) {
		const change = changeByKey.get(key);
		if (!change) continue;
		for (const op of change.ops) {
			const row = pcdOpsQueries.getById(op.id);
			if (
				!row ||
				row.database_id !== databaseId ||
				row.origin !== 'base' ||
				row.state !== 'draft'
			) {
				continue;
			}
			opMap.set(row.id, row);
		}
	}

	const ops = Array.from(opMap.values())
		.filter((op): op is NonNullable<typeof op> => !!op)
		.sort((a, b) => (a.sequence ?? a.id) - (b.sequence ?? b.id));

	return { ops, selectedKeys };
}

async function buildExportPlan(
	databaseId: number,
	opIds: number[],
	message: string,
	repoPath: string,
	exportedAtOverride?: string | null
): Promise<{ success: true; plan: ExportPlan } | { success: false; error: string }> {
	const trimmedMessage = message.trim();
	if (!trimmedMessage) {
		return { success: false, error: 'Commit message is required' };
	}

	const { ops } = resolveSelectedOps(databaseId, opIds);
	if (ops.length === 0) {
		return { success: false, error: 'No draft operations selected' };
	}

	const fallbackTimestamp = new Date().toISOString();
	const exportedAt =
		exportedAtOverride && !Number.isNaN(Date.parse(exportedAtOverride))
			? new Date(exportedAtOverride).toISOString()
			: fallbackTimestamp;
	const opIdList = ops.map((op) => op.id);
	const header = buildHeader(trimmedMessage, opIdList, exportedAt);
	const body = ops.map((op) => formatOpBlock(op)).join('\n\n');
	const fileContent = `${header}\n\n${body}\n`;
	const dbSql = body.trim();
	const metadataJson = buildMetadataJson(trimmedMessage, opIdList, exportedAt);
	const contentHash = await crypto.subtle
		.digest('SHA-256', new TextEncoder().encode(`${dbSql}\n${metadataJson}`))
		.then((hashBuffer) =>
			Array.from(new Uint8Array(hashBuffer))
				.map((b) => b.toString(16).padStart(2, '0'))
				.join('')
		);

	const maxOpNumber = await getMaxOpNumber(repoPath);
	const opNumber = maxOpNumber + 1;
	const filename = `${opNumber}.${slugify(trimmedMessage)}.sql`;

	return {
		success: true,
		plan: {
			filename,
			filepath: `ops/${filename}`,
			fileContent,
			dbSql,
			metadataJson,
			contentHash,
			opIds: opIdList,
			exportedAt,
			opNumber,
			ops
		}
	};
}

async function cloneForExport(
	sourcePath: string,
	targetPath: string,
	workdir: string
): Promise<void> {
	await execGit(['clone', '--quiet', sourcePath, targetPath], workdir);
}

async function pushHeadToBranch(repoPath: string, branch: string): Promise<void> {
	await execGit(['push', 'origin', `HEAD:refs/heads/${branch}`], repoPath);
}

export async function previewDraftOps(
	databaseId: number,
	opIds: number[],
	message: string,
	filePaths: string[] = []
): Promise<PreviewResult> {
	const database = databaseInstancesQueries.getById(databaseId);
	if (!database) {
		return { success: false, error: 'Database not found' };
	}

	if (opIds.length === 0 && filePaths.length === 0) {
		return { success: false, error: 'No changes selected' };
	}

	if (filePaths.length > 0) {
		try {
			validateFilePaths(database.local_path, filePaths);
		} catch {
			return { success: false, error: 'Invalid file path' };
		}
	}

	const trimmedMessage = message.trim();
	if (!trimmedMessage) {
		return { success: false, error: 'Commit message is required' };
	}

	const preflight = await runPreflight(databaseId);
	const gitIdentity = {
		name: database.git_user_name?.trim() ?? '',
		email: database.git_user_email?.trim() ?? ''
	};

	if (!preflight.ok) {
		return {
			success: true,
			preview: {
				ok: false,
				errors: preflight.errors,
				checks: preflight.checks,
				status: preflight.status,
				commitMessage: trimmedMessage,
				gitIdentity
			}
		};
	}

	// Build ops plan if there are ops
	let plan: ExportPlan | null = null;
	if (opIds.length > 0) {
		const planResult = await buildExportPlan(
			databaseId,
			opIds,
			trimmedMessage,
			database.local_path
		);
		if (!planResult.success) {
			return { success: false, error: planResult.error };
		}
		plan = planResult.plan;
	}

	return {
		success: true,
		preview: {
			ok: true,
			errors: [],
			checks: preflight.checks,
			status: preflight.status,
			filename: plan?.filename,
			filepath: plan?.filepath,
			content: plan?.fileContent,
			contentHash: plan?.contentHash,
			opIds: plan?.opIds,
			opCount: plan?.opIds.length ?? 0,
			filePaths: filePaths.length > 0 ? filePaths : undefined,
			exportedAt: plan?.exportedAt,
			commitMessage: trimmedMessage,
			gitIdentity
		}
	};
}

export async function exportDraftOps(
	databaseId: number,
	opIds: number[],
	message: string,
	exportedAtOverride?: string | null,
	filePaths: string[] = []
): Promise<ExportResult> {
	const database = databaseInstancesQueries.getById(databaseId);
	if (!database) {
		return { success: false, error: 'Database not found' };
	}

	const trimmedMessage = message.trim();
	if (!trimmedMessage) {
		return { success: false, error: 'Commit message is required' };
	}

	if (opIds.length === 0 && filePaths.length === 0) {
		return { success: false, error: 'No changes selected' };
	}

	if (filePaths.length > 0) {
		try {
			validateFilePaths(database.local_path, filePaths);
		} catch {
			return { success: false, error: 'Invalid file path' };
		}
	}

	const preflight = await runPreflight(databaseId);
	if (!preflight.ok) {
		return {
			success: false,
			error: preflight.errors.length > 0 ? preflight.errors[0] : 'Export preflight failed'
		};
	}

	// Build ops plan if there are ops
	let plan: ExportPlan | null = null;
	if (opIds.length > 0) {
		const planResult = await buildExportPlan(
			databaseId,
			opIds,
			trimmedMessage,
			database.local_path,
			exportedAtOverride
		);
		if (!planResult.success) {
			return { success: false, error: planResult.error };
		}
		plan = planResult.plan;
	}

	const gitUserName = database.git_user_name?.trim() ?? '';
	const gitUserEmail = database.git_user_email?.trim() ?? '';
	const branch = preflight.checks.branch ?? '';
	if (!branch) {
		return { success: false, error: 'Repository is not on a branch.' };
	}

	try {
		const tempDir = await Deno.makeTempDir({ prefix: 'profilarr-export-' });
		const repoDir = `${tempDir}/repo`;
		const authUrl = buildRemoteUrl(database.repository_url, database.personal_access_token);
		let sourcePath = database.local_path;
		try {
			sourcePath = await Deno.realPath(database.local_path);
		} catch {
			// fall back to the stored path
		}

		try {
			await cloneForExport(sourcePath, repoDir, tempDir);
			await execGit(['remote', 'set-url', 'origin', authUrl], repoDir);

			const toStage: string[] = [];

			// Write SQL file if there are ops
			if (plan) {
				const filepath = `${repoDir}/ops/${plan.filename}`;
				await Deno.mkdir(`${repoDir}/ops`, { recursive: true });
				await Deno.writeTextFile(filepath, plan.fileContent);
				toStage.push(filepath);
			}

			// Copy file changes from source working tree to clone
			if (filePaths.length > 0) {
				for (const fp of filePaths) {
					const src = `${sourcePath}/${fp}`;
					const dest = `${repoDir}/${fp}`;
					const destDir = dest.substring(0, dest.lastIndexOf('/'));
					if (destDir !== repoDir) {
						await Deno.mkdir(destDir, { recursive: true });
					}
					await Deno.copyFile(src, dest);
					toStage.push(dest);
				}
			}

			await stage(repoDir, toStage);
			await configureIdentity(repoDir, gitUserName, gitUserEmail);
			await commit(repoDir, trimmedMessage);
			await pushHeadToBranch(repoDir, branch);
		} finally {
			try {
				await Deno.remove(tempDir, { recursive: true });
			} catch {
				// ignore cleanup failure
			}
		}

		try {
			// Restore exported files to committed state so pull can fast-forward.
			// The pull will bring in the commit we just pushed with the new content.
			if (filePaths.length > 0) {
				const trackedFiles: string[] = [];
				const untrackedFiles: string[] = [];
				const localStatus = await getStatus(database.local_path);
				const untrackedSet = new Set(localStatus.untracked);
				for (const fp of filePaths) {
					if (untrackedSet.has(fp)) {
						untrackedFiles.push(fp);
					} else {
						trackedFiles.push(fp);
					}
				}
				if (trackedFiles.length > 0) {
					await execGit(['checkout', '--', ...trackedFiles], database.local_path);
				}
				for (const fp of untrackedFiles) {
					try {
						await Deno.remove(`${database.local_path}/${fp}`);
					} catch {
						// ignore if already gone
					}
				}
			}
			await execGit(['pull', '--ff-only'], database.local_path);
		} catch (error) {
			await logger.warn('Failed to update local repo after export', {
				source: 'PCDExporter',
				meta: { databaseId, error: String(error) }
			});
		}

		// Ops bookkeeping (only if there were ops)
		let newOpId: number | null = null;
		if (plan) {
			newOpId = pcdOpsQueries.create({
				databaseId,
				origin: 'base',
				state: 'published',
				source: 'repo',
				filename: plan.filename,
				opNumber: plan.opNumber,
				sequence: plan.opNumber,
				sql: plan.dbSql,
				metadata: plan.metadataJson,
				contentHash: plan.contentHash,
				lastSeenInRepoAt: plan.exportedAt
			});

			const batchId = uuid();
			for (const op of plan.ops) {
				pcdOpsQueries.update(op.id, { state: 'superseded', supersededByOpId: newOpId });
				pcdOpHistoryQueries.create({
					opId: op.id,
					databaseId,
					batchId,
					status: 'superseded'
				});
			}
		}

		if (database.enabled) {
			await compile(database.local_path, databaseId);
		}

		await logger.info('Exported changes to repository', {
			source: 'PCDExporter',
			meta: {
				databaseId,
				databaseName: database.name,
				filename: plan?.filename ?? null,
				opId: newOpId,
				opsExported: plan?.opIds.length ?? 0,
				fileCount: filePaths.length
			}
		});

		return {
			success: true,
			filename: plan?.filename ?? null,
			opId: newOpId,
			dropped: plan?.opIds.length ?? 0,
			fileCount: filePaths.length
		};
	} catch (error) {
		await logger.error('Failed to export changes', {
			source: 'PCDExporter',
			meta: { databaseId, error: String(error) }
		});
		return { success: false, error: String(error) };
	}
}
