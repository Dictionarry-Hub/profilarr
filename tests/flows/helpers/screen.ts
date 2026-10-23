/**
 * Screen sizes. Scenarios run at the desktop size by default; switch to
 * mobile to reach controls that only show on small screens, such as the
 * quality reorder arrows.
 */

import { test, type Page } from '@playwright/test';

export const SCREENS = {
	// Above the app's widest breakpoint (`wide`, 1600px), so pages use their desktop layout
	desktop: { width: 1920, height: 1080 },
	// Below `md` (768px): the sidebar hides and the bottom bar takes over
	mobile: { width: 390, height: 844 }
} as const;

export type Screen = keyof typeof SCREENS;

/** Resize the page; the layout follows straight away, without a reload */
export async function setScreen(page: Page, screen: Screen): Promise<void> {
	await test.step(
		`Switch to the ${screen} screen`,
		async () => {
			await page.setViewportSize(SCREENS[screen]);
		},
		{ box: true }
	);
}
