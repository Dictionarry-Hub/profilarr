import { test } from 'vitest';
import { assertEquals } from '@std/assert';
import { validateLinkInput } from '$pcd/core/validate.ts';

function branchFor(repositoryUrl: string, branch?: string): string | undefined {
	const result = validateLinkInput({
		name: 'Dictionarry',
		repository_url: repositoryUrl,
		branch
	});

	if (!result.ok) {
		throw new Error(result.error);
	}

	return result.input.branch;
}

test('validateLinkInput defaults first-party database links to v2', () => {
	const urls = [
		'https://github.com/Dictionarry-Hub/database',
		'https://github.com/Dictionarry-Hub/database.git',
		'git@github.com:Dictionarry-Hub/database.git',
		'github.com/Dictionarry-Hub/database'
	];

	for (const url of urls) {
		assertEquals(branchFor(url), 'v2', url);
	}
});

test('validateLinkInput keeps explicit branch for first-party database links', () => {
	assertEquals(branchFor('https://github.com/Dictionarry-Hub/database', 'main'), 'main');
});

test('validateLinkInput does not default other database links', () => {
	assertEquals(branchFor('https://github.com/TRaSH-Guides/Guides'), undefined);
});
