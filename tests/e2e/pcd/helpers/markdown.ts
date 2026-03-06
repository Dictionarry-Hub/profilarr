/**
 * Helper for interacting with MarkdownInput components.
 * Supports both modes:
 * - edit mode (textarea visible)
 * - preview mode (toggle back to edit, then fill textarea)
 */
import type { Page } from '@playwright/test';

/**
 * Fill a MarkdownInput field by its element id.
 * Switches from preview to edit mode if needed, then fills the textarea.
 */
export async function fillMarkdownInput(page: Page, id: string, value: string): Promise<void> {
	// Find the outer .space-y-2 container via the label[for] attribute.
	// This works whether textarea is visible or the component is in preview mode.
	const container = page.locator(`.space-y-2:has(label[for="${id}"])`);
	const textarea = page.locator(`#${id}`);

	// New default is edit mode. If textarea is hidden, switch from preview to edit.
	if (!(await textarea.isVisible())) {
		await container.locator('button[title="Edit"]').click();
	}

	// Wait for the textarea to appear/be visible, then fill it
	await textarea.waitFor({ state: 'visible' });
	await textarea.fill(value);
}
