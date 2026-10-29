/**
 * Quality profiles sync module
 * Exports handler, syncer, and transformer for quality profile syncing
 */

// Handler (for registry)
export { qualityProfilesHandler } from './handler.ts';

// Syncer
export { QualityProfileSyncer } from './syncer.ts';

// Transformer functions
export {
	transformQualityProfile,
	fetchQualityProfileFromPcd,
	getQualityApiMappings
} from './transformer.ts';

// Re-export from centralized references module
export { getCustomFormatsForProfile } from '#pcd/references.ts';

// Transformer types (internal PCD representations)
export type {
	PcdQualityProfile,
	PcdQualityItem,
	PcdLanguageConfig,
	PcdCustomFormatScore
} from './transformer.ts';

// Arr types - import directly from #arr/types.ts
export type {
	ArrQualityProfilePayload,
	ArrQualityProfileItem,
	QualityProfileFormatItem
} from '#arr/types.ts';
