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
	},
	firstCustomFormatGeneral: async () => {
		const dbs = await (await fetch('/api/v1/databases')).json();
		if (!dbs.length) return '/custom-formats';
		const { path } = await (await fetch(`/custom-formats/${dbs[0].id}/first/general`)).json();
		return path;
	},
	firstCustomFormatConditions: async () => {
		const dbs = await (await fetch('/api/v1/databases')).json();
		if (!dbs.length) return '/custom-formats';
		const { path } = await (await fetch(`/custom-formats/${dbs[0].id}/first/conditions`)).json();
		return path;
	},
	firstDevCustomFormatTesting: async () => {
		const dbs: Array<{ id: number; hasPat: boolean; local_ops_enabled: number }> = await (
			await fetch('/api/v1/databases')
		).json();
		const dev = dbs.find((d) => d.hasPat && !d.local_ops_enabled);
		if (!dev) return '/custom-formats';
		const { path } = await (await fetch(`/custom-formats/${dev.id}/first/testing`)).json();
		return path;
	},
	firstQualityProfileGeneral: async () => {
		const dbs = await (await fetch('/api/v1/databases')).json();
		if (!dbs.length) return '/quality-profiles';
		const { path } = await (await fetch(`/quality-profiles/${dbs[0].id}/first/general`)).json();
		return path;
	},
	firstQualityProfileScoring: async () => {
		const dbs = await (await fetch('/api/v1/databases')).json();
		if (!dbs.length) return '/quality-profiles';
		const { path } = await (await fetch(`/quality-profiles/${dbs[0].id}/first/scoring`)).json();
		return path;
	},
	firstQualityProfileQualities: async () => {
		const dbs = await (await fetch('/api/v1/databases')).json();
		if (!dbs.length) return '/quality-profiles';
		const { path } = await (await fetch(`/quality-profiles/${dbs[0].id}/first/qualities`)).json();
		return path;
	},
	firstRegularExpression: async () => {
		const dbs = await (await fetch('/api/v1/databases')).json();
		if (!dbs.length) return '/regular-expressions';
		const { path } = await (await fetch(`/regular-expressions/${dbs[0].id}/first`)).json();
		return path;
	}
};
