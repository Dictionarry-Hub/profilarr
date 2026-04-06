import type { Stage, StageGroup } from '../types.ts';
import { welcomeStage } from './stages/welcome.ts';
import { navigationStage } from './stages/navigation.ts';
import { personalizeStage } from './stages/personalize.ts';
import { databaseLinkStage } from './stages/database-link.ts';
import { databaseManageStage } from './stages/database-manage.ts';
import { arrLinkStage } from './stages/arr-link.ts';
import { arrManageStage } from './stages/arr-manage.ts';
import { arrSyncStage } from './stages/arr-sync.ts';
import { helpStage } from './stages/help.ts';

export const STAGES: Record<string, Stage> = {
	welcome: welcomeStage,
	navigation: navigationStage,
	personalize: personalizeStage,
	'database-link': databaseLinkStage,
	'database-manage': databaseManageStage,
	'arr-link': arrLinkStage,
	'arr-manage': arrManageStage,
	'arr-sync': arrSyncStage,
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
		stages: ['arr-link', 'arr-manage', 'arr-sync']
	}
];
