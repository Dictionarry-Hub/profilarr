export type DriftRunStatus = 'never_checked' | 'clean' | 'drift_detected' | 'failed';

export type DriftSection =
	| 'custom_formats'
	| 'quality_profiles'
	| 'delay_profiles'
	| 'media_management';

export type DriftCounts = Partial<Record<DriftSection, number>>;

export type DriftDiff = Record<string, unknown>;
