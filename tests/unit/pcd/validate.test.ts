import { expect, test } from 'vitest';
import { validateLinkInput } from '#pcd/core/validate.ts';

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
		expect(branchFor(url), url).toStrictEqual('v2');
	}
});

test('validateLinkInput keeps explicit branch for first-party database links', () => {
	expect(branchFor('https://github.com/Dictionarry-Hub/database', 'main')).toStrictEqual('main');
});

test('validateLinkInput does not default other database links', () => {
	expect(branchFor('https://github.com/TRaSH-Guides/Guides')).toStrictEqual(undefined);
});
