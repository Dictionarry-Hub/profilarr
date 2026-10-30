/**
 * ESLint config for Profilarr.
 *
 * General rules cover JS and TS outside `src/routes/` and `tests/`. Routes,
 * Svelte components and tests only get the project's own rules
 * (`scripts/lint/rules/`), each scoped to the files it's about.
 *
 * Every disable comment needs a reason after `--`.
 */

import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';

import disableComments from '#scripts/lint/rules/disable-comments.ts';
import importPaths from '#scripts/lint/rules/import-paths.ts';
import {
	noDirectClipboardCopy,
	noDirectClipboardPaste
} from '#scripts/lint/rules/no-direct-clipboard.ts';
import noInsecureUuid from '#scripts/lint/rules/no-insecure-uuid.ts';
import noRawDates from '#scripts/lint/rules/no-raw-dates.ts';
import noRawUi from '#scripts/lint/rules/no-raw-ui.ts';
import pageMeta from '#scripts/lint/rules/page-meta.ts';
import secretDestination from '#scripts/lint/rules/secret-destination.ts';

const profilarr = {
	rules: {
		'disable-comments': disableComments,
		'import-paths': importPaths,
		'no-direct-clipboard-copy': noDirectClipboardCopy,
		'no-direct-clipboard-paste': noDirectClipboardPaste,
		'no-insecure-uuid': noInsecureUuid,
		'no-raw-dates': noRawDates,
		'no-raw-ui': noRawUi,
		'page-meta': pageMeta,
		'secret-destination': secretDestination
	}
};

const CODE = '{svelte,ts,js}';

// SvelteKit server-only files, which never run in the browser
const SERVER_FILES = ['**/+server.{ts,js}', '**/*.server.{ts,js}'];

// Code that runs in the browser
const BROWSER_FILES = [`src/lib/client/**/*.${CODE}`, `src/routes/**/*.${CODE}`];

export default defineConfig(
	{
		ignores: [
			'dist/',
			'static/',
			'temp/',
			'config/',
			'.svelte-kit/',
			'.claude/',
			'.notes/',
			'.arr/',
			'blob-report/',
			'tests/flows/playwright-report/',
			'tests/flows/test-results/',
			'tests/flows/test-results-ui/',
			'src/services/'
		]
	},

	// General rules
	{
		files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
		ignores: ['src/routes/**', 'tests/**'],
		extends: [js.configs.recommended, ts.configs.recommended],
		rules: {
			// Type checking catches undefined names
			'no-undef': 'off',
			'no-eval': 'error',
			'no-throw-literal': 'error',
			'prefer-const': 'error',
			// A leading `_` marks a name as deliberately unused
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
					destructuredArrayIgnorePattern: '^_'
				}
			]
		}
	},

	// Parse Svelte components, with TypeScript in their scripts. No Svelte rule
	// presets: only the project's own rules run on components.
	...svelte.configs.base,
	{
		files: ['**/*.svelte'],
		languageOptions: { parserOptions: { parser: ts.parser } }
	},
	{
		files: ['src/routes/**/*.{ts,js}', 'tests/**/*.ts'],
		languageOptions: { parser: ts.parser }
	},

	// The project's own rules
	{
		plugins: { profilarr },
		rules: { 'profilarr/disable-comments': 'error' }
	},
	{
		files: BROWSER_FILES,
		ignores: SERVER_FILES,
		rules: {
			'profilarr/disable-comments': ['error', { locked: ['profilarr/no-insecure-uuid'] }]
		}
	},
	{
		files: [`src/**/*.${CODE}`, `scripts/**/*.${CODE}`, 'tests/**/*.ts', `*.config.{js,ts}`],
		rules: {
			'profilarr/import-paths': ['error', { maxDepth: 2, unlimited: ['#routes', '#integration'] }]
		}
	},
	{
		files: ['src/routes/**/*.svelte', 'src/lib/client/**/*.svelte'],
		ignores: ['src/lib/client/ui/**'],
		rules: { 'profilarr/no-raw-ui': 'error' }
	},
	{
		files: ['src/routes/**/+page.svelte'],
		rules: { 'profilarr/page-meta': 'error' }
	},
	{
		files: ['src/lib/server/db/queries/*.ts', 'src/routes/**/*.svelte'],
		rules: { 'profilarr/no-raw-dates': 'error' }
	},
	{
		files: ['src/routes/**/+page.server.ts'],
		rules: { 'profilarr/secret-destination': 'error' }
	},
	{
		files: BROWSER_FILES,
		ignores: SERVER_FILES,
		rules: { 'profilarr/no-insecure-uuid': 'error' }
	},
	{
		files: [`src/lib/shared/**/*.${CODE}`],
		ignores: ['src/lib/shared/utils/uuid.ts'],
		rules: { 'profilarr/no-insecure-uuid': 'warn' }
	},
	{
		files: BROWSER_FILES,
		ignores: [...SERVER_FILES, 'src/lib/client/utils/clipboard.ts'],
		rules: {
			'profilarr/no-direct-clipboard-copy': 'error',
			'profilarr/no-direct-clipboard-paste': 'error'
		}
	},

	// Lucide icons come from their own module: the package root re-exports
	// every icon, and the Vite dev server doesn't tree-shake. Types are fine.
	{
		files: [`src/**/*.${CODE}`],
		plugins: { '@typescript-eslint': ts.plugin },
		rules: {
			'@typescript-eslint/no-restricted-imports': [
				'error',
				{
					paths: ['@lucide/svelte', '@lucide/svelte/icons'].map((name) => ({
						name,
						allowTypeImports: true,
						message: "Import each icon from '@lucide/svelte/icons/<name>'"
					}))
				}
			],
			'no-restricted-syntax': [
				'error',
				{
					selector: 'ImportExpression[source.value=/^@lucide\\/svelte(\\/icons)?$/]',
					message: "Import each icon from '@lucide/svelte/icons/<name>'"
				}
			]
		}
	}
);
