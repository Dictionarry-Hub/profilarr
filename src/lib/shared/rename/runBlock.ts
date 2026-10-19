/**
 * Why a manual rename run can't start. A dry run only previews, so it works
 * while renaming is disabled; a live run renames files and needs it enabled.
 * Pure, so the rename page's buttons and the run action share it.
 */

export interface RenameRunState {
	hasConfig: boolean;
	dirty: boolean;
	running: boolean;
	enabled: boolean;
	dryRun: boolean;
}

export const LIVE_RUN_DISABLED_REASON = 'Enable renaming to run a live rename';

/** The first reason the run is blocked, or null if it can start. */
export function renameRunBlockReason(state: RenameRunState): string | null {
	if (!state.hasConfig) return 'Save the config first';
	if (state.dirty) return 'Save or discard your changes first';
	if (state.running) return 'A rename is already running';
	if (!state.dryRun && !state.enabled) return LIVE_RUN_DISABLED_REASON;
	return null;
}
