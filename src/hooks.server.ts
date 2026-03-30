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
import { printBanner, getServerInfo, logContainerConfig } from '$logger/startup.ts';
import { logSettings } from '$logger/settings.ts';
import { logger } from '$logger/logger.ts';
import { db } from '$db/db.ts';
import { runMigrations } from '$db/migrations.ts';
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
import { setupStateQueries } from '$db/queries/setupState.ts';

if (!isReload) {
	// Initialize configuration on server startup
	await config.init();

	// Initialize database
	await db.initialize();

	// Run database migrations
	await runMigrations();

	// Load log settings from database (must be after migrations)
	logSettings.load();

	// Log container config (if running in Docker)
	await logContainerConfig();

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

	// AUTH=off or local bypass with local IP - skip auth after setup
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

	// API key auth is scoped to /api/ paths only (excluding /api/internal/ when it exists).
	// Browser pages and form actions require a real session.
	if (auth.user && !auth.session && auth.user.username === 'api') {
		if (
			!event.url.pathname.startsWith('/api/') ||
			event.url.pathname.startsWith('/api/internal/')
		) {
			return new Response(JSON.stringify({ error: 'API key auth is not accepted for this path' }), {
				status: 403,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	}

	// Not authenticated - redirect or return 401
	if (!auth.user) {
		if (event.url.pathname.startsWith('/api')) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
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

	return resolveAndStrip();
};
