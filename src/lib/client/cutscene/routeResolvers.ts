/**
 * Named route resolver functions for dynamic step routing.
 * Each function returns the resolved path string.
 * Add new resolvers here as stages require them.
 */
export const routeResolvers: Record<string, () => Promise<string>> = {
	firstDatabaseChanges: async () => {
		const res = await fetch('/api/v1/databases');
		const dbs = await res.json();
		return `/databases/${dbs[0].id}/changes`;
	},
	firstDatabaseCommits: async () => {
		const res = await fetch('/api/v1/databases');
		const dbs = await res.json();
		return `/databases/${dbs[0].id}/commits`;
	},
	firstDatabaseConflicts: async () => {
		const res = await fetch('/api/v1/databases');
		const dbs = await res.json();
		return `/databases/${dbs[0].id}/conflicts`;
	},
	firstDatabaseTweaks: async () => {
		const res = await fetch('/api/v1/databases');
		const dbs = await res.json();
		return `/databases/${dbs[0].id}/tweaks`;
	},
	firstDatabaseSettings: async () => {
		const res = await fetch('/api/v1/databases');
		const dbs = await res.json();
		return `/databases/${dbs[0].id}/settings`;
	},
	firstArrLibrary: async () => {
		const res = await fetch('/api/v1/arr');
		const arr = await res.json();
		return `/arr/${arr[0].id}/library`;
	},
	firstArrSync: async () => {
		const res = await fetch('/api/v1/arr');
		const arr = await res.json();
		return `/arr/${arr[0].id}/sync`;
	},
	firstArrUpgrades: async () => {
		const res = await fetch('/api/v1/arr');
		const arr = await res.json();
		return `/arr/${arr[0].id}/upgrades`;
	},
	firstArrRename: async () => {
		const res = await fetch('/api/v1/arr');
		const arr = await res.json();
		return `/arr/${arr[0].id}/rename`;
	},
	firstArrLogs: async () => {
		const res = await fetch('/api/v1/arr');
		const arr = await res.json();
		return `/arr/${arr[0].id}/logs`;
	},
	firstArrSettings: async () => {
		const res = await fetch('/api/v1/arr');
		const arr = await res.json();
		return `/arr/${arr[0].id}/settings`;
	}
};
