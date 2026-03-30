import type { Stage, Pipeline } from '../types.ts';
import { welcomeStage } from './stages/welcome.ts';
import { personalizeStage } from './stages/personalize.ts';
import { databasesStage } from './stages/databases.ts';
import { helpStage } from './stages/help.ts';
import { gettingStartedPipeline } from './pipelines/getting-started.ts';

export const STAGES: Record<string, Stage> = {
	welcome: welcomeStage,
	personalize: personalizeStage,
	databases: databasesStage,
	help: helpStage
};

export const PIPELINES: Record<string, Pipeline> = {
	'getting-started': gettingStartedPipeline
};
