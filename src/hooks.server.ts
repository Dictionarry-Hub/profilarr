// HMR guard: skip heavy initialization on Vite hot reloads
const isReload = (globalThis as Record<string, unknown>).__profilarr_initialized__ === true;
(globalThis as Record<string, unknown>).__profilarr_initialized__ = true;

if (!isReload) {
	// Auto-spawn parser binary for standalone builds (must run before config import)
	await import('$lib/server/utils/parser/spawn.ts');
}

import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { config } from '$config';
import { printBanner, getServerInfo, logContainerConfig, logProxyConfig } from '$logger/startup.ts';
import { logSettings } from '$logger/settings.ts';
import { logger } from '$logger/logger.ts';
import { db } from '$db/db.ts';
import { runMigrations } from '$db/migrations.ts';
import { applyPendingRestore } from '$utils/backup/applyPending.ts';
import { initializeJobs } from '$jobs/init.ts';
import { recoverInterruptedSyncs } from '$lib/server/sync/utils.ts';
import { pcdManager } from '$pcd/core/manager.ts';
import {
	getAuthState,
	isPublicPath,
	maybeExtendSession,
	cleanupExpiredSessions
} from '$auth/middleware.ts';
import { cleanupExpiredAttempts } from '$auth/rateLimit.ts';
import { checkApiKeyAccess } from '$auth/apiPermissions.ts';
import { getStartupAuthError } from '$auth/loginOptions.ts';
import { setupStateQueries } from '$db/queries/setupState.ts';
import { usersQueries } from '$db/queries/users.ts';

if (!isReload) {
	// Initialize configuration on server startup
	await config.init();

	// Apply any pending restore before opening the DB. This is the only
	// safe window: directories exist (config.init mkdir'd them) but no
	// SQLite handle is open yet, so we can swap files freely.
	await applyPendingRestore();

	// Initialize database
	await db.initialize();

	// Run database migrations
	await runMigrations();

	// Load log settings from database (must be after migrations)
	logSettings.load();

	// Refuse to start rather than open first-run setup on an instance whose
	// SSO settings went missing (needs the database, so it runs here rather
	// than with the other auth checks in config).
	const startupAuthError = getStartupAuthError({
		authMode: config.authMode,
		oidcEnabled: config.oidcEnabled,
		hasLocalAccount: usersQueries.existsLocal(),
		hasSsoAccounts: usersQueries.existsOidc()
	});
	if (startupAuthError) {
		await logger.error(startupAuthError, { source: 'Auth' });
		Deno.exit(1);
	}

	// Log container config (if running in Docker)
	await logContainerConfig();

	// Log outbound proxy settings (if any are set)
	await logProxyConfig();

	// Initialize PCD caches (must be after migrations and log settings)
	await pcdManager.initialize();

	// Auto-link default database on first startup (only once)
	if (!setupStateQueries.isDefaultDatabaseLinked() && !Deno.env.get('INTEGRATION_TEST')) {
		try {
			await pcdManager.link({
				name: 'Dictionarry',
				repositoryUrl: 'https://github.com/Dictionarry-Hub/database',
				branch: 'v2',
				syncStrategy: 60,
				autoPull: true,
				personalAccessToken: undefined
			});

			setupStateQueries.markDefaultDatabaseLinked();

			await logger.info('Default database auto-linked', {
				source: 'Setup',
				meta: { database: 'Dictionarry' }
			});
		} catch (error) {
			// Don't fail startup, but mark as attempted so we don't retry every startup
			setupStateQueries.markDefaultDatabaseLinked();

			await logger.warn('Failed to auto-link default database', {
				source: 'Setup',
				meta: { error: String(error) }
			});
		}
	}

	// Initialize and start job queue
	await initializeJobs();

	// Recover any syncs that were interrupted by a restart
	await recoverInterruptedSyncs();

	// Clean expired sessions and login attempts on startup
	cleanupExpiredAttempts();
	const expiredCount = cleanupExpiredSessions();
	if (expiredCount > 0) {
		await logger.info(
			`Cleaned up ${expiredCount} expired session${expiredCount === 1 ? '' : 's'}`,
			{
				source: 'Auth:Session',
				meta: { count: expiredCount }
			}
		);
	}

	// TODO(v3.0.0): Remove this warning along with the AUTH=oidc alias
	// (see parseAuthConfig in $utils/config/auth.ts).
	if (config.deprecatedOidcMode) {
		const leftover = usersQueries.existsLocal()
			? ' A local password account exists, so the login page now also shows the password form.'
			: '';
		await logger.warn(
			`AUTH=oidc is deprecated and will stop working in v3.0.0. Set AUTH=on instead; SSO stays enabled while the OIDC_* settings are set.${leftover}`,
			{ source: 'Auth' }
		);
	}

	// Log server ready
	await logger.info('Server ready', {
		source: 'Startup',
		meta: getServerInfo()
	});

	// Print startup banner with URL
	printBanner();
}

/**
 * Auth middleware
 * Handles authentication, authorization, and session management
 */
export const handle: Handle = async ({ event, resolve }) => {
	// Strip Link preload headers from all responses to keep response headers
	// small enough for reverse proxies with default buffer sizes.
	async function resolveAndStrip(): Promise<Response> {
		const response = await resolve(event);
		response.headers.delete('link');
		return response;
	}

	const auth = await getAuthState(event);

	// First-run setup flow (applies to all auth modes except AUTH=off)
	if (auth.needsSetup) {
		if (event.url.pathname === '/auth/setup') {
			return resolveAndStrip();
		}
		throw redirect(303, '/auth/setup');
	}

	// AUTH=off - skip auth after setup
	if (auth.skipAuth) {
		return resolveAndStrip();
	}

	// Block setup page after user exists
	if (event.url.pathname === '/auth/setup') {
		throw redirect(303, '/');
	}

	// Public paths don't need auth
	if (isPublicPath(event.url.pathname)) {
		return resolveAndStrip();
	}

	// API key auth is scoped to /api/v1 paths only.
	// Browser pages and form actions require a real session.
	if (auth.apiKey) {
		if (!event.url.pathname.startsWith('/api/v1/')) {
			return new Response(JSON.stringify({ error: 'API key auth is not accepted for this path' }), {
				status: 403,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Unmatched routes fall through to SvelteKit's 404
		if (event.route.id) {
			const denial = checkApiKeyAccess(auth.apiKey, event.route.id, event.request.method);
			if (denial) {
				void logger.warn('API key denied', {
					source: 'Auth:APIKey',
					meta: {
						name: auth.apiKey.name,
						method: event.request.method,
						endpoint: event.url.pathname
					}
				});
				return new Response(JSON.stringify({ error: denial }), {
					status: 403,
					headers: { 'Content-Type': 'application/json' }
				});
			}
		}
	}

	// Not authenticated - redirect or return 401
	if (!auth.user) {
		if (event.url.pathname.startsWith('/api')) {
			const error = auth.apiKeyExpired ? 'API key has expired' : 'Unauthorized';
			return new Response(JSON.stringify({ error }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		throw redirect(303, '/auth/login');
	}

	// Sliding expiration: extend session if past halfway point
	if (auth.session) {
		maybeExtendSession(auth.session);
	}

	// Authenticated - attach user to locals for use in routes
	event.locals.user = auth.user;
	event.locals.session = auth.session;
	event.locals.apiKey = auth.apiKey;

	return resolveAndStrip();
};
