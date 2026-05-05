/**
 * Build metadata stamped at Docker image build time.
 *
 * This file is committed with dev-fallback values so `deno task dev` and
 * fresh clones work out of the box. During `docker build`, the ARGs
 * PROFILARR_VERSION / VITE_CHANNEL / PROFILARR_COMMIT are written into
 * this file by the Dockerfile before `vite build` runs, so the stamped
 * values end up inlined in both the server and client bundles.
 *
 * Do not hand-edit outside of the dev-fallback values below.
 */

export type Channel = 'stable' | 'develop' | 'dev';

export interface BuildInfo {
	readonly version: string;
	readonly channel: Channel;
	readonly commit: string | null;
	readonly builtAt: string | null;
}

export const build: BuildInfo = {
	version: 'dev',
	channel: 'dev',
	commit: null,
	builtAt: null
};
