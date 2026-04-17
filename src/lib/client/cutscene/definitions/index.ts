import type { Stage, StageGroup } from '../types.ts';
import { welcomeStage } from './stages/getting-started/welcome.ts';
import { navigationStage } from './stages/getting-started/navigation.ts';
import { personalizeStage } from './stages/getting-started/personalize.ts';
import { helpStage } from './stages/getting-started/help.ts';
import { databaseLinkStage } from './stages/databases/link.ts';
import { databaseOverviewStage } from './stages/databases/overview.ts';
import { arrLinkStage } from './stages/arrs/link.ts';
import { arrOverviewStage } from './stages/arrs/overview.ts';
import { arrSyncStage } from './stages/arrs/sync.ts';
import { arrUpgradesStage } from './stages/arrs/upgrades.ts';
import { arrRenameStage } from './stages/arrs/renames.ts';
import { cfGeneralStage } from './stages/custom-formats/general.ts';
import { cfConditionsStage } from './stages/custom-formats/conditions.ts';
import { cfTestingStage } from './stages/custom-formats/testing.ts';
import { qpGeneralStage } from './stages/quality-profiles/general.ts';
import { qpScoringStage } from './stages/quality-profiles/scoring.ts';
import { qpQualitiesStage } from './stages/quality-profiles/qualities.ts';
import { regexGeneralStage } from './stages/regular-expressions/general.ts';
import { delayGeneralStage } from './stages/delay-profiles/general.ts';
import { mediaNamingStage } from './stages/media-management/naming.ts';
import { mediaQualityDefinitionsStage } from './stages/media-management/quality-definitions.ts';
import { mediaSettingsStage } from './stages/media-management/media-settings.ts';
import { settingsGeneralStage } from './stages/settings/general.ts';
import { settingsJobsStage } from './stages/settings/jobs.ts';
import { settingsLogsStage } from './stages/settings/logs.ts';
import { settingsBackupsStage } from './stages/settings/backups.ts';
import { settingsNotificationsStage } from './stages/settings/notifications.ts';
import { settingsSecurityStage } from './stages/settings/security.ts';

export const STAGES: Record<string, Stage> = {
	welcome: welcomeStage,
	navigation: navigationStage,
	personalize: personalizeStage,
	'database-link': databaseLinkStage,
	'database-manage': databaseOverviewStage,
	'arr-link': arrLinkStage,
	'arr-manage': arrOverviewStage,
	'arr-sync': arrSyncStage,
	'arr-upgrades': arrUpgradesStage,
	'arr-renames': arrRenameStage,
	'cf-general': cfGeneralStage,
	'cf-conditions': cfConditionsStage,
	'cf-testing': cfTestingStage,
	'qp-general': qpGeneralStage,
	'qp-scoring': qpScoringStage,
	'qp-qualities': qpQualitiesStage,
	'regex-general': regexGeneralStage,
	'delay-general': delayGeneralStage,
	'media-naming': mediaNamingStage,
	'media-quality-definitions': mediaQualityDefinitionsStage,
	'media-settings': mediaSettingsStage,
	'settings-general': settingsGeneralStage,
	'settings-jobs': settingsJobsStage,
	'settings-logs': settingsLogsStage,
	'settings-backups': settingsBackupsStage,
	'settings-notifications': settingsNotificationsStage,
	'settings-security': settingsSecurityStage,
	help: helpStage
};

export const GROUPS: StageGroup[] = [
	{
		name: 'Getting Started',
		description: 'Learn the basics of Profilarr',
		stages: ['welcome', 'navigation', 'personalize', 'help']
	},
	{
		name: 'Databases',
		description: 'Connect and manage configuration databases',
		stages: ['database-link', 'database-manage']
	},
	{
		name: 'Arr Instances',
		description: 'Connect and manage Radarr/Sonarr instances',
		stages: ['arr-link', 'arr-manage', 'arr-sync', 'arr-upgrades', 'arr-renames']
	},
	{
		name: 'Media Management',
		description: 'Naming, quality definitions, and media settings',
		stages: ['media-naming', 'media-quality-definitions', 'media-settings']
	},
	{
		name: 'Regular Expressions',
		description: 'Build reusable regex patterns for custom format conditions',
		stages: ['regex-general']
	},
	{
		name: 'Custom Formats',
		description: 'Build and test custom formats',
		stages: ['cf-general', 'cf-conditions', 'cf-testing']
	},
	{
		name: 'Quality Profiles',
		description: 'Rank releases with qualities and custom format scores',
		stages: ['qp-general', 'qp-scoring', 'qp-qualities']
	},
	{
		name: 'Delay Profiles',
		description: 'Wait for better releases before committing to a grab',
		stages: ['delay-general']
	},
	{
		name: 'Settings',
		description:
			'App-wide preferences, background jobs, logs, backups, notifications, and security',
		stages: [
			'settings-general',
			'settings-jobs',
			'settings-logs',
			'settings-backups',
			'settings-notifications',
			'settings-security'
		]
	}
];
