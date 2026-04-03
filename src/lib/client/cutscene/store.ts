import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import type { CutsceneState } from './types.ts';
import { STAGES } from './definitions/index.ts';
import { checkPrerequisites } from './prerequisites.ts';
import { alertStore } from '$lib/client/alerts/store';

const STORAGE_KEY = 'cutscene-progress';

const DEFAULT_STATE: CutsceneState = {
	active: false,
	stageId: null,
	stepIndex: 0,
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

	async function startStage(stageId: string, manual = true): Promise<void> {
		const stage = STAGES[stageId];
		if (!stage || stage.steps.length === 0) return;

		const result = await checkPrerequisites(stageId);
		if (!result.ok) {
			alertStore.add('error', result.message);
			return;
		}

		justCompleted.set(false);
		const newState: CutsceneState = {
			active: true,
			stageId,
			stepIndex: 0,
			manualStart: manual
		};
		state.set(newState);
		saveState(newState);
	}

	function goBack(): void {
		state.update((current) => {
			if (!current.active || !current.stageId) return current;

			if (current.stepIndex > 0) {
				const updated = { ...current, stepIndex: current.stepIndex - 1 };
				saveState(updated);
				return updated;
			}

			return current;
		});
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
			clearState();
			const lastStage = STAGES[current.stageId];
			if (current.manualStart && !lastStage?.silent) {
				justCompleted.set(true);
			}
			return DEFAULT_STATE;
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
		onboardingShown: { subscribe: onboardingShown.subscribe },
		justCompleted: { subscribe: justCompleted.subscribe },
		init,
		startStage,
		advance,
		goBack,
		cancel,
		dismiss,
		dismissCompleted,
		reset
	};
}

export const cutscene = createCutsceneStore();
