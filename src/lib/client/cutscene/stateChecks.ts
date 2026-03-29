/**
 * Named state check functions for Cutscene completion conditions.
 * Each function returns true when the condition is satisfied.
 * Add new checks here as stages require them.
 */
export const stateChecks: Record<string, () => Promise<boolean>> = {
	// Future checks will be added here as stages are built, e.g.:
	// hasDatabase: async () => { ... },
	// hasArrInstance: async () => { ... },
	// hasSyncedProfile: async () => { ... },
};
