/**
 * Defaults (upstream values) for a custom format's conditions and a regex's
 * pattern, for the hint beside the edited field. Regex names inside condition
 * patterns compare by upstream name, so a regex rename alone isn't a change.
 */

import type { LiveOpEntityRow, OpDetails } from '$db/queries/pcdOpEntities.ts';
import { pcdOpEntitiesQueries } from '$db/queries/pcdOpEntities.ts';
import type { PCDCache } from '$pcd/index.ts';
import type { ConditionData } from '$shared/pcd/display.ts';
import type { ConditionField, NormalizedCondition } from '$shared/pcd/conditionFormat.ts';
import type { PortableCustomFormat, PortableRegularExpression } from '$shared/pcd/portable.ts';
import type { UpstreamSnapshot } from './capture.ts';
import { didNotApply, entityKey, parseOpMetadata } from './opEntities.ts';
import { resolveAliases } from './touched.ts';

export interface ConditionDefault {
	/** modified: differs from its default. added: not in the defaults. */
	status: 'modified' | 'added' | 'unchanged';
	default: NormalizedCondition | null;
	changed: ConditionField[];
	/** A change you made to this condition didn't apply. */
	pending: boolean;
}

export interface CustomFormatDefaults {
	/**
	 * Keyed by current condition name; only conditions with something to show. A Map,
	 * because a name can be anything, including __proto__.
	 */
	conditions: Map<string, ConditionDefault>;
	/** In the defaults, but removed locally. */
	removed: Array<{ name: string; condition: NormalizedCondition }>;
	/** Conditions whose change didn't apply and that aren't here now, like a failed addition. */
	notApplied: string[];
}

export interface RegexDefaults {
	/** The default pattern, when yours differs or your change didn't apply. */
	pattern: string | null;
	pending: boolean;
}

const sorted = (values: string[] | undefined) => [...(values ?? [])].sort();

export function normalizeCondition(
	c: ConditionData,
	regexUpstreamName: (name: string) => string | null
): NormalizedCondition {
	return {
		type: c.type,
		arrType: c.arrType || 'all',
		negate: c.negate,
		required: c.required,
		// A regex with no default identity must never match a default regex's name.
		patterns: sorted(c.patterns?.map((p) => regexUpstreamName(p.name) ?? `\u0000local:${p.name}`)),
		languages: sorted(c.languages?.map((l) => (l.except ? `${l.name} (except)` : l.name))),
		sources: sorted(c.sources),
		resolutions: sorted(c.resolutions),
		qualityModifiers: sorted(c.qualityModifiers),
		releaseTypes: sorted(c.releaseTypes),
		indexerFlags: sorted(c.indexerFlags),
		size: c.size ?? null,
		years: c.years ?? null
	};
}

function changedFields(a: NormalizedCondition, b: NormalizedCondition): ConditionField[] {
	return (Object.keys(a) as ConditionField[]).filter(
		(k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])
	);
}

export function customFormatConditionDefaults(input: {
	/** undefined: not captured. null: not in the defaults (created locally). */
	upstream: PortableCustomFormat | null | undefined;
	current: ConditionData[];
	regexUpstreamName: (name: string) => string | null;
	/** Condition names with a change that didn't apply. */
	pendingConditions: Set<string>;
}): CustomFormatDefaults {
	const currentNames = new Set(input.current.map((c) => c.name));
	const result: CustomFormatDefaults = {
		conditions: new Map(),
		removed: [],
		notApplied: [...input.pendingConditions].filter((name) => !currentNames.has(name)).sort()
	};
	if (!input.upstream) return result;

	const defaults = new Map(
		input.upstream.conditions.map((c) => [c.name, normalizeCondition(c, (n) => n)])
	);
	for (const c of input.current) {
		const now = normalizeCondition(c, input.regexUpstreamName);
		const def = defaults.get(c.name) ?? null;
		const changed = def ? changedFields(def, now) : [];
		const status = def === null ? 'added' : changed.length > 0 ? 'modified' : 'unchanged';
		const pending = input.pendingConditions.has(c.name);
		if (status === 'unchanged' && !pending) continue;
		result.conditions.set(c.name, { status, default: def, changed, pending });
	}
	for (const [name, condition] of defaults) {
		if (!currentNames.has(name)) result.removed.push({ name, condition });
	}
	return result;
}

export function regexPatternDefaults(input: {
	upstream: PortableRegularExpression | null | undefined;
	currentPattern: string;
	pending: boolean;
}): RegexDefaults {
	if (!input.upstream) return { pattern: null, pending: false };
	const differs = input.upstream.pattern !== input.currentPattern;
	return {
		pattern: differs || input.pending ? input.upstream.pattern : null,
		pending: input.pending
	};
}

interface EntityContext {
	upstream: unknown;
	upstreamNameOf: (entity: string, name: string) => string | null;
	/** Changed fields of this entity's live ops whose change didn't apply. */
	pendingFields: Set<string>;
}

function entityContext(
	snapshot: UpstreamSnapshot,
	live: LiveOpEntityRow[],
	opDetails: (ids: number[]) => OpDetails[],
	entity: string,
	name: string
): EntityContext | null {
	const { upstreamNameOf, rowUpstreamName } = resolveAliases(live);
	const upstreamName = upstreamNameOf(entity, name);
	if (upstreamName === null) return null;
	const ids = live
		.filter(
			(r) => r.role === 'target' && r.entity === entity && rowUpstreamName(r) === upstreamName
		)
		.map((r) => r.opId);
	const pendingFields = new Set(
		opDetails([...new Set(ids)])
			.filter((d) => didNotApply(d.status))
			.flatMap((d) => parseOpMetadata(d.metadata).changedFields)
	);
	return {
		upstream: snapshot.entities.get(entityKey(entity, upstreamName)),
		upstreamNameOf,
		pendingFields
	};
}

export function customFormatDefaults(
	cache: PCDCache,
	databaseId: number,
	formatName: string,
	current: ConditionData[]
): CustomFormatDefaults {
	const snapshot = cache.getUpstreamSnapshot();
	if (snapshot.status !== 'captured') return { conditions: new Map(), removed: [], notApplied: [] };
	const ctx = entityContext(
		snapshot,
		pcdOpEntitiesQueries.listLive(databaseId),
		(ids) => pcdOpEntitiesQueries.listOpDetails(ids),
		'custom_format',
		formatName
	);
	if (!ctx) return { conditions: new Map(), removed: [], notApplied: [] };
	const pendingConditions = new Set(
		[...ctx.pendingFields]
			.filter((f) => f.startsWith('condition:'))
			.map((f) => f.slice('condition:'.length))
	);
	return customFormatConditionDefaults({
		upstream: ctx.upstream as PortableCustomFormat | null | undefined,
		current,
		regexUpstreamName: (name) => ctx.upstreamNameOf('regular_expression', name),
		pendingConditions
	});
}

export function regexDefaults(
	cache: PCDCache,
	databaseId: number,
	regexName: string,
	currentPattern: string
): RegexDefaults {
	const snapshot = cache.getUpstreamSnapshot();
	if (snapshot.status !== 'captured') return { pattern: null, pending: false };
	const ctx = entityContext(
		snapshot,
		pcdOpEntitiesQueries.listLive(databaseId),
		(ids) => pcdOpEntitiesQueries.listOpDetails(ids),
		'regular_expression',
		regexName
	);
	if (!ctx) return { pattern: null, pending: false };
	return regexPatternDefaults({
		upstream: ctx.upstream as PortableRegularExpression | null | undefined,
		currentPattern,
		pending: ctx.pendingFields.has('pattern')
	});
}
