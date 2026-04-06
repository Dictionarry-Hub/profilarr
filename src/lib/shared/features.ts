/**
 * Feature flags for gating unreleased functionality.
 * Flip to `true` when ready to ship.
 */

export const FEATURES = {
	/** PCD entity import/export */
	importExport: false,
	/** AI-powered commit message generation */
	ai: false,
	/** Cutscene onboarding system */
	cutscene: true
} as const;
