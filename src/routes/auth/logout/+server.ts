import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sessionsQueries } from '$db/queries/sessions.ts';
import { usersQueries } from '$db/queries/users.ts';
import { logger } from '$logger/logger.ts';

export const POST: RequestHandler = async ({ cookies }) => {
	const sessionId = cookies.get('session');

	if (sessionId) {
		// Get session info before deleting for logging
		const session = sessionsQueries.getById(sessionId);
		if (session) {
			const user = usersQueries.getById(session.user_id);
			await logger.info(`User '${user?.username ?? 'unknown'}' logged out`, {
				source: 'Auth:Session',
				meta: { userId: session.user_id, username: user?.username }
			});
		}
		sessionsQueries.deleteById(sessionId);
	}

	cookies.delete('session', { path: '/' });

	throw redirect(303, '/auth/login');
};
