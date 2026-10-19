/**
 * Why a manual rename run can't start. Manual runs, dry or live, don't depend
 * on the schedule; the schedule toggle only controls automatic runs. Pure, so
 * the rename page's buttons share one set of rules.
 */

export interface RenameRunState {
	hasConfig: boolean;
	dirty: boolean;
	running: boolean;
}

/** The first reason a manual run is blocked, or null if it can start. */
export function renameRunBlockReason(state: RenameRunState): string | null {
	if (!state.hasConfig) return 'Save the config first';
	if (state.dirty) return 'Save or discard your changes first';
	if (state.running) return 'A rename is already running';
	return null;
}
