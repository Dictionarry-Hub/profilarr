/**
 * - Covers: entity names containing `/` behind a proxy that normalizes
 *   encoded slashes (`%2F` → `/`), which breaks `[name]` route segments.
 * - The fake proxy decodes `%2F` before forwarding, the way Envoy Gateway
 *   does by default.
 */
import { test, expect } from '#flows/helpers/core/test.ts';
import { fillField, saveForm } from '#flows/helpers/core/forms.ts';
import { newEntity, openEntity } from '#flows/helpers/core/nav.ts';
import { namingPages } from '#flows/helpers/entities/mediaManagement.ts';

test.use({ appProxy: { normalizeEncodedSlashes: true } });

const NAME = 'Test / Slash';
const FORMAT = '{Movie Title} ({Release Year})';

/**
 * Flow:
 * 1. The user creates a Radarr naming config whose name contains `/`.
 * 2. The user opens it from the naming list.
 *
 * Expects:
 * - the entity page loads through the normalizing proxy
 * - the movie format matches what was saved
 */
test('opens a naming config whose name contains a slash', async ({ page }) => {
	await newEntity(page, 'Naming Settings', 'Radarr');
	const main = page.getByRole('main');
	await fillField(main, 'Name', NAME);
	await fillField(main, 'Movie Format', FORMAT);
	await saveForm(page, { button: 'Create' });

	await openEntity(page, 'Naming Settings', NAME);
	const config = await namingPages.radarr(page);
	expect(config.movie_format, 'the movie format should match what was saved').toBe(FORMAT);
});
