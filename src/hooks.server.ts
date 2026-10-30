import process from 'node:process';
import type { Handle } from '@sveltejs/kit/hooks';
import { redirect } from '@sveltejs/kit';

// HMR guard: skip heavy initialization on Vite hot reloads
const isReload = (globalThis as Record<string, unknown>).__profilarr_initialized__ === true;
(globalThis as Record<string, unknown>).__profilarr_initialized__ = true;

import { config } from '#utils/config/config.ts';
import { printBanner, getServerInfo, logContainerConfig, logProxyConfig } from '#logger/startup.ts';
import { getSocksProxyError } from '#utils/http/proxy.ts';
import { logSettings } from '#logger/settings.ts';
import { logger } from '#logger/logger.ts';
import { db } from '#db/db.ts';
import { runMigrations } from '#db/migrations.ts';
import { applyPendingRestore } from '#utils/backup/applyPending.ts';
import { initializeJobs } from '#server/jobs/init.ts';
import { recoverInterruptedSyncs } from '#server/sync/utils.ts';
import { pcdManager } from '#pcd/core/manager.ts';
import {
	getAuthState,
	isPublicPath,
	maybeExtendSession,
	cleanupExpiredSessions
} from '#utils/auth/middleware.ts';
import { cleanupExpiredAttempts } from '#utils/auth/rateLimit.ts';
import { checkApiKeyAccess } from '#utils/auth/apiPermissions.ts';
import { getStartupAuthError } from '#utils/auth/loginOptions.ts';
import { setupStateQueries } from '#db/queries/setupState.ts';
import { usersQueries } from '#db/queries/users.ts';
import { firstSightings } from '#runtime/origins.js';

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
		process.exit(1);
	}

	// Log container config (if running in Docker)
	await logContainerConfig();

	// Log outbound proxy settings (if any are set)
	await logProxyConfig();

	// Refuse to start with a SOCKS proxy, which Bun's fetch can't use. It would
	// fail every request, or with ALL_PROXY skip the proxy without a warning.
	const proxyError = getSocksProxyError();
	if (proxyError) {
		await logger.error(proxyError, { source: 'Proxy' });
		process.exit(1);
	}

	// Initialize PCD caches (must be after migrations and log settings)
	await pcdManager.initialize();

	// Auto-link default database on first startup (only once)
	if (!setupStateQueries.isDefaultDatabaseLinked() && !process.env.INTEGRATION_TEST) {
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
	// (see parseAuthConfig in #utils/config/auth.ts).
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
// With several origins in ORIGIN, a request on an address outside the list is
// served from its own Host. Say so once per address, up to a few, in case a
// browser was meant to use it and its forms fail the CSRF check.
const unlistedOrigin = firstSightings(10);

export const handle: Handle = async ({ event, resolve }) => {
	if (
		config.origins.length > 1 &&
		!config.origins.includes(event.url.origin) &&
		unlistedOrigin(event.url.origin)
	) {
		await logger.warn(`Serving ${event.url.origin}, which is not in ORIGIN`, {
			source: 'Auth:Origin',
			meta: {
				origins: config.origins,
				hint: 'If browsers use this address, add it to ORIGIN or make the reverse proxy forward the original Host. See https://profilarr.com/installation#authentication'
			}
		});
	}
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
