/**
 * Font store for user-configurable typography
 */

import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type SansFont = 'dm-sans' | 'inter' | 'ibm-plex-sans';
export type MonoFont = 'geist-mono' | 'jetbrains-mono' | 'ibm-plex-mono';

export interface FontSettings {
	sans: SansFont;
	mono: MonoFont;
}

const STORAGE_KEY = 'fontSettings';

const DEFAULT_FONTS: FontSettings = {
	sans: 'dm-sans',
	mono: 'geist-mono'
};

const sansFontStacks: Record<SansFont, string> = {
	'dm-sans': "'DM Sans', ui-sans-serif, system-ui, sans-serif",
	inter: "'Inter', ui-sans-serif, system-ui, sans-serif",
	'ibm-plex-sans': "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif"
};

const monoFontStacks: Record<MonoFont, string> = {
	'geist-mono': "'Geist Mono', ui-monospace, monospace",
	'jetbrains-mono': "'JetBrains Mono', ui-monospace, monospace",
	'ibm-plex-mono': "'IBM Plex Mono', ui-monospace, monospace"
};

export const sansFontOptions: { value: SansFont; label: string }[] = [
	{ value: 'dm-sans', label: 'DM Sans' },
	{ value: 'inter', label: 'Inter' },
	{ value: 'ibm-plex-sans', label: 'IBM Plex Sans' }
];

export const monoFontOptions: { value: MonoFont; label: string }[] = [
	{ value: 'geist-mono', label: 'Geist Mono' },
	{ value: 'jetbrains-mono', label: 'JetBrains Mono' },
	{ value: 'ibm-plex-mono', label: 'IBM Plex Mono' }
];

function applyFonts(settings: FontSettings) {
	if (!browser) return;
	const root = document.documentElement;
	root.style.setProperty('--font-sans', sansFontStacks[settings.sans]);
	root.style.setProperty('--font-mono', monoFontStacks[settings.mono]);
}

function createFontStore() {
	const initial = { ...DEFAULT_FONTS };
	if (browser) {
		try {
			const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
			if (stored?.sans && sansFontStacks[stored.sans as SansFont]) {
				initial.sans = stored.sans;
			}
			if (stored?.mono && monoFontStacks[stored.mono as MonoFont]) {
				initial.mono = stored.mono;
			}
		} catch {
			/* use defaults */
		}
		applyFonts(initial);
	}

	const { subscribe, set } = writable<FontSettings>(initial);

	function setFonts(next: FontSettings) {
		set(next);
		applyFonts(next);
		if (browser) {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
		}
	}

	return { subscribe, setFonts };
}

export const fontStore = createFontStore();
