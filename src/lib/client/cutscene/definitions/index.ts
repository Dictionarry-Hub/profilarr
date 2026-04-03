import type { Stage, Pipeline } from '../types.ts';
import { welcomeStage } from './stages/welcome.ts';
import { navigationStage } from './stages/navigation.ts';
import { personalizeStage } from './stages/personalize.ts';
import { databaseLinkStage } from './stages/database-link.ts';
import { databaseManageStage } from './stages/database-manage.ts';
import { arrLinkStage } from './stages/arr-link.ts';
import { arrManageStage } from './stages/arr-manage.ts';
import { helpStage } from './stages/help.ts';
import { gettingStartedPipeline } from './pipelines/getting-started.ts';
import { databasesPipeline } from './pipelines/databases.ts';
import { arrsPipeline } from './pipelines/arrs.ts';

export const STAGES: Record<string, Stage> = {
	welcome: welcomeStage,
	navigation: navigationStage,
	personalize: personalizeStage,
	'database-link': databaseLinkStage,
	'database-manage': databaseManageStage,
	'arr-link': arrLinkStage,
	'arr-manage': arrManageStage,
	help: helpStage
};

export const PIPELINES: Record<string, Pipeline> = {
	'getting-started': gettingStartedPipeline,
	databases: databasesPipeline,
	arrs: arrsPipeline
};
