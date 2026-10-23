/**
 * Checks for the screen helper in helpers/core/screen.ts.
 */
import { test, expect } from '$flows/helpers/core/test.ts';
import { openSidebarPage } from '$flows/helpers/core/nav.ts';
import { setScreen } from '$flows/helpers/core/screen.ts';

test('setScreen switches between the desktop and mobile layouts', async ({ page }) => {
	await openSidebarPage(page, 'Quality Profiles');
	const sidebar = page.getByRole('navigation', { name: 'Sidebar' });
	const bottomBar = page.getByRole('navigation', { name: 'Bottom bar' });

	await setScreen(page, 'mobile');
	await expect(bottomBar, 'mobile shows the bottom bar').toBeVisible();
	await expect(sidebar, 'mobile slides the sidebar off screen').not.toBeInViewport();

	await setScreen(page, 'desktop');
	await expect(bottomBar, 'desktop hides the bottom bar').toBeHidden();
	await expect(sidebar, 'desktop shows the sidebar').toBeInViewport();
});
