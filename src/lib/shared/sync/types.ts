export type SyncSection = 'qualityProfiles' | 'delayProfiles' | 'mediaManagement';

export interface AffectedSection {
	section: SyncSection;
	syncStatus: string;
	lastSyncedAt: string | null;
}

export interface AffectedArr {
	instanceId: number;
	instanceName: string;
	sections: AffectedSection[];
}

/**
 * Outcome of pushing one entity to one Arr instance. `skipped` is set when
 * the push succeeded by doing nothing, with a sentence saying why.
 */
export interface EntitySyncResult {
	success: boolean;
	error?: string;
	skipped?: string;
}
