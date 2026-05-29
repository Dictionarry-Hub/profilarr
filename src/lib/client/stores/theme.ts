/**
 * Theme store for resolved light/dark mode.
 *
 * The saved preference may be `system`, but subscribers receive the resolved
 * light/dark theme so existing UI code can stay simple.
 */

import { writable } from 'svelte/store';
import { browser } from '$app/environment';

type Theme = 'light' | 'dark';
export type ThemePreference = Theme | 'system';

const THEME_CLASSES = ['light', 'dark'];

function getSystemTheme(): Theme {
	if (!browser) return 'dark';
	return globalThis.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(preference: ThemePreference): Theme {
	return preference === 'system' ? getSystemTheme() : preference;
}

function readPreference(): ThemePreference {
	if (!browser) return 'system';

	const stored = localStorage.getItem('theme');
	if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;

	return 'system';
}

function createThemeStore() {
	let preference = readPreference();
	const initialTheme = resolveTheme(preference);

	const { subscribe, set } = writable<Theme>(initialTheme);

	// Apply theme on initialization
	if (browser) {
		applyTheme(initialTheme);
		const mediaQuery = globalThis.matchMedia('(prefers-color-scheme: dark)');
		mediaQuery.addEventListener('change', () => {
			if (preference !== 'system') return;
			const nextTheme = resolveTheme(preference);
			set(nextTheme);
			applyTheme(nextTheme);
		});
	}

	function applyTheme(newTheme: Theme) {
		if (browser) {
			const apply = () => {
				document.documentElement.classList.remove(...THEME_CLASSES);
				document.documentElement.classList.add(newTheme);
				document.documentElement.style.colorScheme = newTheme;
			};

			// Use View Transitions API if available for smooth theme changes.
			if (document.startViewTransition) document.startViewTransition(apply);
			else apply();
		}
	}

	function setPreference(nextPreference: ThemePreference) {
		preference = nextPreference;
		const nextTheme = resolveTheme(preference);
		set(nextTheme);
		applyTheme(nextTheme);
		if (browser) localStorage.setItem('theme', preference);
	}

	function toggle() {
		const currentTheme = resolveTheme(preference);
		setPreference(currentTheme === 'light' ? 'dark' : 'light');
	}

	return {
		subscribe,
		toggle,
		setPreference,
		getPreference: () => preference
	};
}

export const themeStore = createThemeStore();
