import { logger } from '$logger/logger.ts';
import { pcdOpsQueries } from '$db/queries/pcdOps.ts';
import { extractOrderFromFilename, getBaseOpsPath } from '../utils/operations.ts';

const UNPREFIXED_SEQUENCE_BASE = 2_000_000_000;

async function pathExists(path: string): Promise<boolean> {
	try {
		await Deno.stat(path);
		return true;
	} catch {
		return false;
	}
}

function parseMetadata(sql: string): { metadataJson: string | null; cleanedSql: string } {
	const lines = sql.split(/\r?\n/);
	const metadata: Record<string, string> = {};
	const cleanedLines: string[] = [];

	for (const line of lines) {
		const match = line.match(/^--\s*@([a-zA-Z_]+)\s*:\s*(.*)$/);
		if (match) {
			metadata[match[1]] = match[2].trim();
			continue;
		}
		cleanedLines.push(line);
	}

	const cleanedSql = cleanedLines.join('\n').trim();
	const hasRequired = !!(metadata.operation && metadata.entity && metadata.name);
	const metadataJson = hasRequired ? JSON.stringify(metadata) : null;

	return { metadataJson, cleanedSql };
}

async function hashContent(sql: string, metadataJson: string | null): Promise<string> {
	const payload = `${sql}\n${metadataJson ?? ''}`;
	const data = new TextEncoder().encode(payload);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface ImportBaseOpsResult {
	created: number;
	updated: number;
	orphaned: number;
}

export async function importBaseOps(
	databaseId: number,
	pcdPath: string
): Promise<ImportBaseOpsResult> {
	const basePath = getBaseOpsPath(pcdPath);
	if (!(await pathExists(basePath))) {
		return { created: 0, updated: 0, orphaned: 0 };
	}

	const entries: Array<{ name: string; filepath: string; order: number }> = [];
	for await (const entry of Deno.readDir(basePath)) {
		if (!entry.isFile || !entry.name.endsWith('.sql')) continue;
		const filepath = `${basePath}/${entry.name}`;
		entries.push({ name: entry.name, filepath, order: extractOrderFromFilename(entry.name) });
	}

	entries.sort((a, b) => {
		if (a.order !== b.order) return a.order - b.order;
		return a.name.localeCompare(b.name);
	});

	let created = 0;
	let updated = 0;
	let unprefixedIndex = 0;
	const seenAt = new Date().toISOString();

	for (const entry of entries) {
		const opNumber = entry.order === Infinity ? null : entry.order;
		const sequence = opNumber === null ? UNPREFIXED_SEQUENCE_BASE + unprefixedIndex++ : opNumber;
		const rawSql = await Deno.readTextFile(entry.filepath);
		const { metadataJson, cleanedSql } = parseMetadata(rawSql);
		const contentHash = await hashContent(cleanedSql, metadataJson);

		const existing = pcdOpsQueries.getBaseByFilename(databaseId, entry.name);
		if (existing) {
			pcdOpsQueries.update(existing.id, {
				state: 'published',
				source: 'repo',
				filename: entry.name,
				opNumber,
				sequence,
				sql: cleanedSql,
				metadata: metadataJson,
				contentHash,
				lastSeenInRepoAt: seenAt
			});
			updated += 1;
		} else {
			pcdOpsQueries.create({
				databaseId,
				origin: 'base',
				state: 'published',
				source: 'repo',
				filename: entry.name,
				opNumber,
				sequence,
				sql: cleanedSql,
				metadata: metadataJson,
				contentHash,
				lastSeenInRepoAt: seenAt
			});
			created += 1;
		}
	}

	const orphaned = pcdOpsQueries.markBaseOrphaned(databaseId, seenAt);

	await logger.debug('Imported base ops from repo', {
		source: 'PCDImporter',
		meta: {
			databaseId,
			basePath,
			created,
			updated,
			orphaned
		}
	});

	return { created, updated, orphaned };
}
