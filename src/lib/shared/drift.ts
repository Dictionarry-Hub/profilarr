export type DriftRunStatus = 'never_checked' | 'clean' | 'drift_detected' | 'failed';

export type DriftSection =
	'custom_formats' | 'quality_profiles' | 'delay_profiles' | 'media_management';

export type DriftCounts = Partial<Record<DriftSection, number>>;

export type DriftDiff = Record<string, unknown>;

export type DriftDisplayTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export type DriftDisplayState = 'missing' | 'modified' | 'extra';

export interface DriftDisplayValue {
	text: string;
	mono?: boolean;
	tone?: DriftDisplayTone;
	qualityList?: DriftDisplayQualityItem[];
}

export interface DriftDisplayQualityItem {
	type: 'quality' | 'group';
	id: number;
	name: string;
	allowed: boolean;
	upgradeUntil?: boolean;
	items?: DriftDisplayQualityItem[];
}

export interface DriftDisplayChange {
	id: string;
	label: string;
	detail?: string;
	expected?: DriftDisplayValue;
	actual?: DriftDisplayValue;
	tone: DriftDisplayTone;
}

export interface DriftDisplayDuplicateDrift {
	reason: 'lower_priority_duplicate';
	key: string;
	winnerDatabaseId: number;
	winnerDatabaseName: string;
}

export interface DriftDisplayEntity {
	id: string;
	section: DriftSection;
	sectionLabel: string;
	title: string;
	databaseId?: number;
	databaseName?: string;
	state: DriftDisplayState;
	stateLabel: string;
	tone: DriftDisplayTone;
	summary: string;
	changes: DriftDisplayChange[];
	duplicateDrift?: DriftDisplayDuplicateDrift;
}
