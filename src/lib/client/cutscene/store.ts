import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import type { CutsceneState } from './types.ts';
import { STAGES, PIPELINES } from './definitions/index.ts';

const STORAGE_KEY = 'cutscene-progress';

const DEFAULT_STATE: CutsceneState = {
	active: false,
	pipelineId: null,
	stageId: null,
	stepIndex: 0,
	completedStages: [],
	manualStart: false
};

function loadState(): CutsceneState {
	if (!browser) return DEFAULT_STATE;
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) return JSON.parse(stored);
	} catch {
		// Corrupted storage, ignore
	}
	return DEFAULT_STATE;
}

function saveState(state: CutsceneState): void {
	if (!browser) return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clearState(): void {
	if (!browser) return;
	localStorage.removeItem(STORAGE_KEY);
}

function createCutsceneStore() {
	const state = writable<CutsceneState>(loadState());
	const onboardingShown = writable<boolean>(true);
	const justCompleted = writable<boolean>(false);

	const currentStep = derived(state, ($state) => {
		if (!$state.active || !$state.stageId) return null;
		const stage = STAGES[$state.stageId];
		if (!stage) return null;
		return stage.steps[$state.stepIndex] ?? null;
	});

	const currentStage = derived(state, ($state) => {
		if (!$state.stageId) return null;
		return STAGES[$state.stageId] ?? null;
	});

	const currentPipeline = derived(state, ($state) => {
		if (!$state.pipelineId) return null;
		return PIPELINES[$state.pipelineId] ?? null;
	});

	function init(shown: boolean): void {
		onboardingShown.set(shown);
		if (!shown) {
			// Fresh user, clear any stale localStorage state
			clearState();
			state.set(DEFAULT_STATE);
			return;
		}
		// Restore any in-progress state from localStorage
		const restored = loadState();
		if (restored.active) {
			state.set(restored);
		}
	}

	function startStage(stageId: string): void {
		const stage = STAGES[stageId];
		if (!stage || stage.steps.length === 0) return;

		justCompleted.set(false);
		const newState: CutsceneState = {
			active: true,
			pipelineId: null,
			stageId,
			stepIndex: 0,
			completedStages: [],
			manualStart: true
		};
		state.set(newState);
		saveState(newState);
	}

	function startPipeline(pipelineId: string, manual = true): void {
		const pipeline = PIPELINES[pipelineId];
		if (!pipeline || pipeline.stages.length === 0) return;

		justCompleted.set(false);
		const firstStageId = pipeline.stages[0];
		const newState: CutsceneState = {
			active: true,
			pipelineId,
			stageId: firstStageId,
			stepIndex: 0,
			completedStages: [],
			manualStart: manual
		};
		state.set(newState);
		saveState(newState);
	}

	function advance(): void {
		state.update((current) => {
			if (!current.active || !current.stageId) return current;

			const stage = STAGES[current.stageId];
			if (!stage) return current;

			const nextStepIndex = current.stepIndex + 1;

			// More steps in current stage
			if (nextStepIndex < stage.steps.length) {
				const updated = { ...current, stepIndex: nextStepIndex };
				saveState(updated);
				return updated;
			}

			// Stage complete
			const completedStages = [...current.completedStages, current.stageId];

			// If running a pipeline, try next stage
			if (current.pipelineId) {
				const pipeline = PIPELINES[current.pipelineId];
				if (pipeline) {
					const currentStageIndex = pipeline.stages.indexOf(current.stageId);
					const nextStageId = pipeline.stages[currentStageIndex + 1];

					if (nextStageId) {
						const updated: CutsceneState = {
							...current,
							stageId: nextStageId,
							stepIndex: 0,
							completedStages
						};
						saveState(updated);
						return updated;
					}
				}
			}

			// Done (single stage or pipeline complete)
			clearState();
			const lastStage = current.stageId ? STAGES[current.stageId] : null;
			if (current.manualStart && !lastStage?.silent) {
				justCompleted.set(true);
			}
			return {
				active: false,
				pipelineId: null,
				stageId: null,
				stepIndex: 0,
				completedStages: [],
				manualStart: false
			};
		});
	}

	async function dismiss(): Promise<void> {
		onboardingShown.set(true);
		try {
			await fetch('/api/v1/cutscene', { method: 'POST' });
		} catch {
			// Best effort
		}
	}

	function cancel(): void {
		const current = loadState();
		clearState();
		if (current.manualStart) {
			justCompleted.set(true);
		}
		state.set(DEFAULT_STATE);
	}

	function reset(): void {
		clearState();
		state.set(DEFAULT_STATE);
	}

	function dismissCompleted(): void {
		justCompleted.set(false);
	}

	return {
		subscribe: state.subscribe,
		currentStep,
		currentStage,
		currentPipeline,
		onboardingShown: { subscribe: onboardingShown.subscribe },
		justCompleted: { subscribe: justCompleted.subscribe },
		init,
		startPipeline,
		startStage,
		advance,
		cancel,
		dismiss,
		dismissCompleted,
		reset
	};
}

export const cutscene = createCutsceneStore();
