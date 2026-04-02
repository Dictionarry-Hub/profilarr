import type { Stage, Pipeline } from '../types.ts';
import { welcomeStage } from './stages/welcome.ts';
import { navigationStage } from './stages/navigation.ts';
import { personalizeStage } from './stages/personalize.ts';
import { databasesStage } from './stages/databases.ts';
import { databaseNavigationStage } from './stages/database-navigation.ts';
import { helpStage } from './stages/help.ts';
import { gettingStartedPipeline } from './pipelines/getting-started.ts';
import { databasesPipeline } from './pipelines/databases.ts';

export const STAGES: Record<string, Stage> = {
	welcome: welcomeStage,
	navigation: navigationStage,
	personalize: personalizeStage,
	'database-link': databasesStage,
	'database-navigation': databaseNavigationStage,
	help: helpStage
};

export const PIPELINES: Record<string, Pipeline> = {
	'getting-started': gettingStartedPipeline,
	databases: databasesPipeline
};
