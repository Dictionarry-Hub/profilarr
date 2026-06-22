import type { Database } from '@db/sqlite';
import { defaultFieldGuardRule } from './rules/defaultFieldGuard.ts';
import { missingTargetDeleteRule } from './rules/missingTargetDelete.ts';
import { qualityProfileQualitiesRowRule } from './rules/qualityProfileQualitiesRow.ts';
import { qualityProfileScoringRowRule } from './rules/qualityProfileScoringRow.ts';
import type {
	AutoAlignDecision,
	ConflictStrategy,
	DeleteRule,
	ParsedOpMetadata,
	UpdateRule
} from './types.ts';

const UPDATE_RULES: UpdateRule[] = [
	qualityProfileQualitiesRowRule,
	qualityProfileScoringRowRule,
	defaultFieldGuardRule
];

const DELETE_RULES: DeleteRule[] = [missingTargetDeleteRule];

export function evaluateAutoAlign(input: {
	db: Database;
	conflictStrategy: ConflictStrategy;
	metadata: ParsedOpMetadata | null;
	desiredState: Record<string, unknown> | null;
}): AutoAlignDecision {
	if (input.conflictStrategy === 'align') {
		return {
			shouldAlign: true,
			reason: 'forced',
			rule: 'force_align_strategy'
		};
	}

	if (input.metadata?.operation === 'delete') {
		const ctx = {
			db: input.db,
			entityName: input.metadata.entity,
			metadata: input.metadata
		};
		for (const rule of DELETE_RULES) {
			if (!rule.matches(ctx)) continue;
			if (rule.shouldAlign(ctx)) {
				return { shouldAlign: true, reason: 'auto_delete', rule: rule.name };
			}
		}
	}

	if (input.metadata?.operation === 'update') {
		const ctx = {
			db: input.db,
			entityName: input.metadata.entity,
			metadata: input.metadata,
			desiredState: input.desiredState
		};
		for (const rule of UPDATE_RULES) {
			if (!rule.matches(ctx)) continue;
			if (rule.shouldAlign(ctx)) {
				return { shouldAlign: true, reason: 'auto_update', rule: rule.name };
			}
		}
	}

	return { shouldAlign: false, reason: 'none' };
}

export function parseOpMetadata(raw: string | null): ParsedOpMetadata | null {
	if (!raw) return null;
	try {
		return JSON.parse(raw) as ParsedOpMetadata;
	} catch {
		return null;
	}
}

export function parseDesiredState(raw: string | null): Record<string, unknown> | null {
	if (!raw) return null;
	try {
		return JSON.parse(raw) as Record<string, unknown>;
	} catch {
		return null;
	}
}

export type { AutoAlignDecision, ConflictStrategy, ParsedOpMetadata } from './types.ts';
