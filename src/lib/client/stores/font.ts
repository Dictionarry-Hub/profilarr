/**
 * Font store for user-configurable typography.
 *
 * 'auto' means "use the theme's default font" by not setting an inline
 * override, so the CSS variable from the theme file controls the stack.
 */

import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { themeStore } from '$stores/theme.ts';
import { getThemeDefinition } from '$lib/client/themes/registry.ts';

export type SansFont = 'auto' | 'dm-sans' | 'inter' | 'ibm-plex-sans';
export type MonoFont = 'auto' | 'geist-mono' | 'jetbrains-mono' | 'ibm-plex-mono';

export interface FontSettings {
	sans: SansFont;
	mono: MonoFont;
}

const STORAGE_KEY = 'fontSettings';

const sansFontStacks: Record<Exclude<SansFont, 'auto'>, string> = {
	'dm-sans': "'DM Sans', ui-sans-serif, system-ui, sans-serif",
	inter: "'Inter', ui-sans-serif, system-ui, sans-serif",
	'ibm-plex-sans': "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif"
};

const monoFontStacks: Record<Exclude<MonoFont, 'auto'>, string> = {
	'geist-mono': "'Geist Mono', ui-monospace, monospace",
	'jetbrains-mono': "'JetBrains Mono', ui-monospace, monospace",
	'ibm-plex-mono': "'IBM Plex Mono', ui-monospace, monospace"
};

const allSansOptions: { value: Exclude<SansFont, 'auto'>; label: string }[] = [
	{ value: 'dm-sans', label: 'DM Sans' },
	{ value: 'inter', label: 'Inter' },
	{ value: 'ibm-plex-sans', label: 'IBM Plex Sans' }
];

const allMonoOptions: { value: Exclude<MonoFont, 'auto'>; label: string }[] = [
	{ value: 'geist-mono', label: 'Geist Mono' },
	{ value: 'jetbrains-mono', label: 'JetBrains Mono' },
	{ value: 'ibm-plex-mono', label: 'IBM Plex Mono' }
];

function applyFonts(settings: FontSettings) {
	if (!browser) return;
	const root = document.documentElement;

	if (settings.sans === 'auto') {
		root.style.removeProperty('--font-sans');
	} else {
		root.style.setProperty('--font-sans', sansFontStacks[settings.sans]);
	}

	if (settings.mono === 'auto') {
		root.style.removeProperty('--font-mono');
	} else {
		root.style.setProperty('--font-mono', monoFontStacks[settings.mono]);
	}
}

function readStored(): FontSettings {
	if (!browser) return { sans: 'auto', mono: 'auto' };
	try {
		const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
		if (!stored) return { sans: 'auto', mono: 'auto' };
		return {
			sans:
				stored.sans &&
				(stored.sans === 'auto' || sansFontStacks[stored.sans as Exclude<SansFont, 'auto'>])
					? stored.sans
					: 'auto',
			mono:
				stored.mono &&
				(stored.mono === 'auto' || monoFontStacks[stored.mono as Exclude<MonoFont, 'auto'>])
					? stored.mono
					: 'auto'
		};
	} catch {
		return { sans: 'auto', mono: 'auto' };
	}
}

function createFontStore() {
	const initial = readStored();
	if (browser) applyFonts(initial);

	const { subscribe, set } = writable<FontSettings>(initial);

	function setFonts(next: FontSettings) {
		set(next);
		applyFonts(next);
		if (browser) {
			if (next.sans === 'auto' && next.mono === 'auto') {
				localStorage.removeItem(STORAGE_KEY);
			} else {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
			}
		}
	}

	return { subscribe, setFonts };
}

export const fontStore = createFontStore();

/** Sans options filtered to exclude the font that matches the current theme default. */
export const sansFontOptions = derived(themeStore, ($theme) => {
	const pref = themeStore.getPreference();
	const def = getThemeDefinition(pref);
	return allSansOptions.filter((o) => o.value !== def.defaultSans);
});

/** Mono options filtered to exclude the font that matches the current theme default. */
export const monoFontOptions = derived(themeStore, ($theme) => {
	const pref = themeStore.getPreference();
	const def = getThemeDefinition(pref);
	return allMonoOptions.filter((o) => o.value !== def.defaultMono);
});
