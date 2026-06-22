import type { Database } from '@db/sqlite';

export type ConflictStrategy = 'override' | 'align' | 'ask';

export type ParsedOpMetadata = {
	operation?: string;
	entity?: string;
	name?: string;
	stableKey?: { key?: string; value?: string };
};

export type AutoAlignDecision = {
	shouldAlign: boolean;
	reason: 'forced' | 'auto_delete' | 'auto_update' | 'none';
	rule?: string;
};

export type UpdateRuleContext = {
	db: Database;
	entityName: string | undefined;
	metadata: ParsedOpMetadata | null;
	desiredState: Record<string, unknown> | null;
};

export type UpdateRule = {
	name: string;
	matches: (ctx: UpdateRuleContext) => boolean;
	shouldAlign: (ctx: UpdateRuleContext) => boolean;
};

export type DeleteRuleContext = {
	db: Database;
	entityName: string | undefined;
	metadata: ParsedOpMetadata | null;
};

export type DeleteRule = {
	name: string;
	matches: (ctx: DeleteRuleContext) => boolean;
	shouldAlign: (ctx: DeleteRuleContext) => boolean;
};
