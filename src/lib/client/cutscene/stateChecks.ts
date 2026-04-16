/**
 * Named state check functions for Cutscene completion conditions.
 * Each function returns true when the condition is satisfied.
 * Add new checks here as stages require them.
 */
import { get } from 'svelte/store';
import { page } from '$app/stores';

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
	},
	hasDevDatabase: async () => {
		const res = await fetch('/api/v1/databases');
		if (!res.ok) return false;
		const data: Array<{ hasPat: boolean; local_ops_enabled: number }> = await res.json();
		return data.some((d) => d.hasPat && !d.local_ops_enabled);
	},
	parserHealthy: async () => {
		return get(page).data?.parserAvailable === true;
	}
};
