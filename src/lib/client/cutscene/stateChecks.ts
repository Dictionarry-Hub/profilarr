/**
 * Named state check functions for Cutscene completion conditions.
 * Each function returns true when the condition is satisfied.
 * Add new checks here as stages require them.
 */
export const stateChecks: Record<string, () => Promise<boolean>> = {
	hasDatabase: async () => {
		const res = await fetch('/api/v1/databases');
		if (!res.ok) return false;
		const data = await res.json();
		return data.length > 0;
	},
	hasArrInstance: async () => {
		const res = await fetch('/api/v1/arr');
		if (!res.ok) return false;
		const data = await res.json();
		return data.length > 0;
	}
};
