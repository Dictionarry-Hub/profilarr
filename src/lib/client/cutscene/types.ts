export type Completion =
	| { type: 'click' }
	| { type: 'route'; path: string }
	| { type: 'state'; check: string }
	| { type: 'manual' };

export interface Step {
	id: string;
	route?: string | { resolve: string };
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

export interface Prerequisite {
	check: string;
	message: string;
}

export interface Stage {
	id: string;
	name: string;
	description: string;
	steps: Step[];
	silent?: boolean;
	prerequisites?: Prerequisite[];
}

export interface StageGroup {
	name: string;
	description: string;
	stages: string[];
}

export interface CutsceneState {
	active: boolean;
	stageId: string | null;
	stepIndex: number;
	manualStart: boolean;
}
