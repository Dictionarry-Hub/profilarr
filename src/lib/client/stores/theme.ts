/**
 * Theme store for resolved light/dark mode.
 *
 * The saved preference may be `system`, but subscribers receive the resolved
 * light/dark theme so existing UI code can stay simple.
 */

import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import {
	getThemeDefinition,
	isThemePreference,
	themeClassNames,
	type ThemeMode,
	type ThemePreference
} from '$lib/client/themes/registry.ts';

function getSystemTheme(): ThemeMode {
	if (!browser) return 'dark';
	return globalThis.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolvePreference(preference: ThemePreference) {
	const definition = getThemeDefinition(preference);
	if (definition.mode !== 'system') return definition;

	return getThemeDefinition(getSystemTheme() === 'dark' ? 'default-dark' : 'default-light');
}

function readPreference(): ThemePreference {
	if (!browser) return 'system';

	const stored = localStorage.getItem('theme');
	if (isThemePreference(stored)) return stored;
	if (stored === 'light') return 'default-light';
	if (stored === 'dark') return 'default-dark';

	return 'system';
}

const preferenceWritable = writable<ThemePreference>(readPreference());

function createThemeStore() {
	let preference = readPreference();
	const initialTheme = resolvePreference(preference);

	const { subscribe, set } = writable<ThemeMode>(initialTheme.mode as ThemeMode);

	// Apply theme on initialization
	if (browser) {
		applyTheme(initialTheme);
		const mediaQuery = globalThis.matchMedia('(prefers-color-scheme: dark)');
		mediaQuery.addEventListener('change', () => {
			if (preference !== 'system') return;
			const nextTheme = resolvePreference(preference);
			set(nextTheme.mode as ThemeMode);
			applyTheme(nextTheme);
		});
	}

	function applyTheme(newTheme: ReturnType<typeof resolvePreference>) {
		if (browser) {
			const apply = () => {
				document.documentElement.classList.remove(...themeClassNames);
				if (newTheme.className) document.documentElement.classList.add(newTheme.className);
				document.documentElement.style.colorScheme = newTheme.mode as ThemeMode;
			};

			// Use View Transitions API if available for smooth theme changes.
			if (document.startViewTransition) document.startViewTransition(apply);
			else apply();
		}
	}

	function setPreference(nextPreference: ThemePreference) {
		preference = nextPreference;
		preferenceWritable.set(preference);
		const nextTheme = resolvePreference(preference);
		set(nextTheme.mode as ThemeMode);
		applyTheme(nextTheme);
		if (browser) localStorage.setItem('theme', preference);
	}

	function toggle() {
		const currentTheme = resolvePreference(preference);
		setPreference(currentTheme.mode === 'light' ? 'default-dark' : 'default-light');
	}

	return {
		subscribe,
		toggle,
		setPreference,
		getPreference: () => preference
	};
}

export const themeStore = createThemeStore();
export const themePreference = { subscribe: preferenceWritable.subscribe };
