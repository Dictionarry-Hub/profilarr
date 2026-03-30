export type Completion =
	| { type: 'click' }
	| { type: 'route'; path: string }
	| { type: 'state'; check: string }
	| { type: 'manual' };

export interface Step {
	id: string;
	route?: string;
	target?: string;
	title: string;
	body: string;
	position?:
		| 'above'
		| 'below'
		| 'left'
		| 'right'
		| 'above-left'
		| 'above-right'
		| 'below-left'
		| 'below-right';
	freeInteract?: boolean;
	completion: Completion;
}

export interface Stage {
	id: string;
	name: string;
	description: string;
	steps: Step[];
	silent?: boolean;
}

export interface Pipeline {
	id: string;
	name: string;
	description: string;
	stages: string[];
}

export interface CutsceneState {
	active: boolean;
	pipelineId: string | null;
	stageId: string | null;
	stepIndex: number;
	completedStages: string[];
	manualStart: boolean;
}
