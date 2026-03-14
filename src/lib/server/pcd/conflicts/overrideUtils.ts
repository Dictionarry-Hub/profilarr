import { pcdOpsQueries } from '$db/queries/pcdOps.ts';
import { pcdOpHistoryQueries } from '$db/queries/pcdOpHistory.ts';
import { uuid } from '$shared/utils/uuid.ts';
import { AUTO_ALIGN_ENTITIES } from '$pcd/entities/registry.ts';

// ── Types ──

export type StoredOpMetadata = {
	operation?: string;
	entity?: string;
	name?: string;
	previousName?: string;
	summary?: string;
	title?: string;
	stable_key?: { key?: string; value?: string };
	changed_fields?: string[];
};

export type StoredDesiredState = Record<string, unknown>;

// ── Parsing ──

export function parseJson<T>(raw: string | null): T | null {
	if (!raw) return null;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

export function parseOpIdFromFilepath(path?: string | null): number | null {
	if (!path) return null;
	if (!path.startsWith('pcd_ops:')) return null;
	const opId = Number(path.slice('pcd_ops:'.length));
	return Number.isFinite(opId) ? opId : null;
}

// ── Op lifecycle ──

export async function supersedeOp(
	databaseId: number,
	oldOpId: number,
	newOpId: number | null
): Promise<boolean> {
	if (!newOpId) return false;
	const updated = pcdOpsQueries.update(oldOpId, {
		state: 'superseded',
		supersededByOpId: newOpId
	});
	if (!updated) return false;

	pcdOpHistoryQueries.create({
		opId: oldOpId,
		databaseId,
		batchId: uuid(),
		status: 'superseded'
	});
	return true;
}

export async function dropOp(databaseId: number, opId: number): Promise<boolean> {
	const updated = pcdOpsQueries.update(opId, { state: 'dropped' });
	if (!updated) return false;
	pcdOpHistoryQueries.create({
		opId,
		databaseId,
		batchId: uuid(),
		status: 'dropped'
	});
	return true;
}

// ── Rename chain ──

/**
 * Follow the rename chain through published base ops to find the current name
 * of an entity. When upstream renames an entity, the user's op still references
 * the old name. This scans base ops for rename operations and follows the chain
 * until it lands on a name that exists (or runs out of renames).
 *
 * Returns the resolved name, or the original name if no renames were found.
 */
export function followRenameChain(
	databaseId: number,
	entityType: string,
	oldName: string,
	maxDepth: number = 10
): string {
	const ops = pcdOpsQueries.listByDatabase(databaseId, 'base');
	// Build a rename map: oldName → newName from published base ops
	const renameMap = new Map<string, string>();

	// Resolve table name for batch SQL parsing
	const registryEntry = AUTO_ALIGN_ENTITIES.get(entityType);
	const tableName = registryEntry?.table;

	for (const op of ops) {
		if (op.state !== 'published') continue;
		const meta = parseJson<StoredOpMetadata>(op.metadata);
		if (!meta) continue;

		// Individual entity ops: metadata has entity + operation
		if (meta.entity === entityType && meta.operation === 'update') {
			const ds = parseJson<StoredDesiredState>(op.desired_state);
			if (!ds) continue;
			const nameField = ds.name;
			if (nameField && typeof nameField === 'object' && 'from' in nameField && 'to' in nameField) {
				const from = (nameField as { from: unknown }).from;
				const to = (nameField as { to: unknown }).to;
				if (typeof from === 'string' && typeof to === 'string' && from !== to) {
					renameMap.set(from, to);
				}
			}
			continue;
		}

		// Batch ops: parse SQL for UPDATE renames on the entity's table
		if (meta.entity === 'batch' && tableName && op.sql) {
			extractRenamesFromSql(op.sql, tableName, renameMap);
		}
	}

	// Follow the chain
	let current = oldName;
	const visited = new Set<string>();
	for (let i = 0; i < maxDepth; i++) {
		const next = renameMap.get(current);
		if (!next || visited.has(next)) break;
		visited.add(current);
		current = next;
	}

	return current;
}

/**
 * Extract rename mappings from batch SQL by looking for UPDATE statements
 * that set the "name" column on a specific table.
 *
 * Matches patterns like:
 *   UPDATE "custom_formats" SET "name" = 'New Name' WHERE "name" = 'Old Name';
 */
function extractRenamesFromSql(
	sql: string,
	tableName: string,
	renameMap: Map<string, string>
): void {
	// Regex: UPDATE "tableName" SET "name" = 'newName' WHERE "name" = 'oldName'
	// SQL single-quote escaping: '' represents a literal '
	const escaped = tableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	// nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp — tableName is from hardcoded callers and regex-escaped
	const pattern = new RegExp(
		`update\\s+"${escaped}"\\s+set\\s+"name"\\s*=\\s*'((?:[^']|'')*)'\\s+where\\s+"name"\\s*=\\s*'((?:[^']|'')*)'`,
		'gi'
	);
	for (const match of sql.matchAll(pattern)) {
		const newName = match[1].replace(/''/g, "'");
		const oldName = match[2].replace(/''/g, "'");
		if (oldName !== newName) {
			renameMap.set(oldName, newName);
		}
	}
}

// ── Value helpers ──

export function isFromTo(value: unknown): value is { to: unknown } {
	return !!value && typeof value === 'object' && 'to' in value;
}

export function getDesiredTo<T = unknown>(value: unknown): T | undefined {
	if (!isFromTo(value)) return undefined;
	return value.to as T;
}

export function normalizeText(value: unknown): string {
	if (value === null || value === undefined) return '';
	return String(value);
}

export function normalizeTags(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	const set = new Set<string>();
	for (const item of value) {
		const name = String(item).trim();
		if (name) set.add(name);
	}
	return Array.from(set).sort();
}

export function tagsEqual(a: string[], b: string[]): boolean {
	if (a.length !== b.length) return false;
	const sortedA = [...a].sort();
	const sortedB = [...b].sort();
	return sortedA.every((value, idx) => value === sortedB[idx]);
}

export function normalizeOrderedItems(items: unknown): Array<{
	type?: string;
	name?: string;
	position?: number;
	enabled?: boolean;
	upgradeUntil?: boolean;
	members?: string[];
}> {
	if (!Array.isArray(items)) return [];
	return items
		.map((item) => {
			const typed = item as {
				type?: string;
				name?: string;
				position?: number;
				enabled?: boolean;
				upgradeUntil?: boolean;
				members?: Array<{ name?: string } | string>;
			};
			const members = Array.isArray(typed.members)
				? typed.members
						.map((member) => (typeof member === 'string' ? member : (member?.name ?? '')))
						.filter(Boolean)
				: [];
			return {
				type: typed.type,
				name: typed.name,
				position: typed.position,
				enabled: typed.enabled,
				upgradeUntil: typed.upgradeUntil,
				members
			};
		})
		.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

export function orderedItemsEqual(a: unknown, b: unknown): boolean {
	const left = normalizeOrderedItems(a);
	const right = normalizeOrderedItems(b);
	return JSON.stringify(left) === JSON.stringify(right);
}

export function valuesEqual(expected: unknown, actual: unknown): boolean {
	if (expected === null || expected === undefined) {
		return actual === null || actual === undefined;
	}
	if (typeof expected === 'boolean') {
		if (typeof actual === 'boolean') return expected === actual;
		if (typeof actual === 'number') return actual === (expected ? 1 : 0);
		if (typeof actual === 'string') return actual === (expected ? '1' : '0');
		return false;
	}
	if (typeof expected === 'number') {
		if (typeof actual === 'number') return expected === actual;
		if (typeof actual === 'bigint') return expected === Number(actual);
		if (typeof actual === 'string') return expected === Number(actual);
		return false;
	}
	if (typeof expected === 'string') {
		return String(actual) === expected;
	}
	return false;
}
