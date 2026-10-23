/**
 * Settings › Security: confirming identity before creating an API key, and
 * typed readers for what the page lists.
 */

import { expect, test, type Page } from '@playwright/test';
import type { App } from '$flows/harness/app.ts';
import { ageConfirmations } from '$flows/harness/sessions.ts';
import type { RunningSso, SsoUser } from '$flows/helpers/auth/sso/providers.ts';

/** How long the app trusts a confirmation (src/lib/server/utils/auth/confirmation.ts) */
const CONFIRMATION_WINDOW_MINUTES = 30;
import { pageData } from '$flows/helpers/core/pageData.ts';

export interface SessionRow {
	/** A hash of the session id; the id itself never reaches the page */
	handle: string;
	created_at: string;
	expires_at: string;
	last_active_at: string | null;
	ip_address: string | null;
	browser: string | null;
	os: string | null;
	device_type: string | null;
	/** The session the reading page itself uses */
	isCurrent: boolean;
}

export interface ApiKeyRow {
	name: string;
	expiresAt: string | null;
	expired: boolean;
	[field: string]: unknown;
}

interface SecurityPage {
	sessions: SessionRow[];
	apiKeys: ApiKeyRow[];
	signedInWithSso: boolean;
	hasLocalAccount: boolean;
	/** What creating an API key needs first; `none` after a recent confirmation */
	confirmation: 'none' | 'password' | 'sso';
}

const SECURITY_PATH = '/settings/security';

export const securityPages = {
	/** Every active session, from `/settings/security` */
	async sessions(page: Page): Promise<SessionRow[]> {
		return (await pageData<SecurityPage>(page, SECURITY_PATH)).sessions;
	},

	/** Every API key, from `/settings/security` */
	async apiKeys(page: Page): Promise<ApiKeyRow[]> {
		return (await pageData<SecurityPage>(page, SECURITY_PATH)).apiKeys;
	},

	/** The whole page's data, for the account and confirmation fields */
	async page(page: Page): Promise<SecurityPage> {
		return await pageData<SecurityPage>(page, SECURITY_PATH);
	}
};

/**
 * Make the app ask for confirmation again. Signing in counts as confirming
 * for 30 minutes, so this moves the sessions' last confirmation past that.
 */
export function lapseConfirmation(app: App): void {
	ageConfirmations(app.dir, CONFIRMATION_WINDOW_MINUTES + 1);
}

export type Confirmation = { password: string } | { sso: RunningSso; user?: SsoUser };

/**
 * Complete the "Confirm it's you" dialog that opens before an API key can be
 * created: with the account's password, or by signing in again through SSO.
 */
export async function confirmIdentity(page: Page, how: Confirmation): Promise<void> {
	await test.step(
		`Confirm identity with ${'password' in how ? 'a password' : 'SSO'}`,
		async () => {
			const dialog = page.getByRole('dialog', { name: "Confirm it's you" });
			await expect(dialog, 'The confirm dialog should open').toBeVisible();

			if ('password' in how) {
				await dialog.getByLabel(/^Password/).fill(how.password);
				const confirmed = page.waitForResponse(
					(response) =>
						new URL(response.url()).pathname === '/settings/security/api-keys/new' &&
						response.request().method() === 'POST'
				);
				await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
				expect((await confirmed).ok(), 'The confirm action should answer').toBe(true);
			} else {
				await dialog.getByRole('link', { name: 'Confirm with SSO' }).click();
				await how.sso.signIn(page, how.user);
			}
			await expect(dialog, 'The dialog should close once confirmed').toBeHidden();
		},
		{ box: true }
	);
}
