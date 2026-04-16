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
		name: 'Custom Formats',
		description: 'Build and test custom formats',
		stages: ['cf-general', 'cf-conditions', 'cf-testing']
	}
];
