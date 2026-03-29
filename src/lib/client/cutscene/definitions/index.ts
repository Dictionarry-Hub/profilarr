import type { Stage, Pipeline } from '../types.ts';
import { testWelcomeStage } from './stages/test-welcome.ts';
import { gettingStartedPipeline } from './pipelines/getting-started.ts';

export const STAGES: Record<string, Stage> = {
	'test-welcome': testWelcomeStage
};

export const PIPELINES: Record<string, Pipeline> = {
	'getting-started': gettingStartedPipeline
};
