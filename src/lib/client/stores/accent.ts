/**
 * Accent color store for app theming
 */

import { writable } from 'svelte/store';

import { browser } from '$app/env';

export type AccentColor = 'blue' | 'yellow' | 'green' | 'orange' | 'teal' | 'purple' | 'rose';

// Color palettes for each accent (matching Tailwind shades)
const colorPalettes: Record<
	AccentColor,
	{
		50: string;
		100: string;
		200: string;
		300: string;
		400: string;
		500: string;
		600: string;
		700: string;
		800: string;
		900: string;
		950: string;
	}
> = {
	blue: {
		50: '#eff6ff',
		100: '#dbeafe',
		200: '#bfdbfe',
		300: '#93c5fd',
		400: '#60a5fa',
		500: '#3b82f6',
		600: '#2563eb',
		700: '#1d4ed8',
		800: '#1e40af',
		900: '#1e3a8a',
		950: '#172554'
	},
	yellow: {
		50: '#fefce8',
		100: '#fef9c3',
		200: '#fef08a',
		300: '#fde047',
		400: '#facc15',
		500: '#eab308',
		600: '#ca8a04',
		700: '#a16207',
		800: '#854d0e',
		900: '#713f12',
		950: '#422006'
	},
	green: {
		50: '#f0fdf4',
		100: '#dcfce7',
		200: '#bbf7d0',
		300: '#86efac',
		400: '#4ade80',
		500: '#22c55e',
		600: '#16a34a',
		700: '#15803d',
		800: '#166534',
		900: '#14532d',
		950: '#052e16'
	},
	orange: {
		50: '#fff7ed',
		100: '#ffedd5',
		200: '#fed7aa',
		300: '#fdba74',
		400: '#fb923c',
		500: '#f97316',
		600: '#ea580c',
		700: '#c2410c',
		800: '#9a3412',
		900: '#7c2d12',
		950: '#431407'
	},
	teal: {
		50: '#f0fdfa',
		100: '#ccfbf1',
		200: '#99f6e4',
		300: '#5eead4',
		400: '#2dd4bf',
		500: '#14b8a6',
		600: '#0d9488',
		700: '#0f766e',
		800: '#115e59',
		900: '#134e4a',
		950: '#042f2e'
	},
	purple: {
		50: '#faf5ff',
		100: '#f3e8ff',
		200: '#e9d5ff',
		300: '#d8b4fe',
		400: '#c084fc',
		500: '#a855f7',
		600: '#9333ea',
		700: '#7e22ce',
		800: '#6b21a8',
		900: '#581c87',
		950: '#3b0764'
	},
	rose: {
		50: '#fff1f2',
		100: '#ffe4e6',
		200: '#fecdd3',
		300: '#fda4af',
		400: '#fb7185',
		500: '#f43f5e',
		600: '#e11d48',
		700: '#be123c',
		800: '#9f1239',
		900: '#881337',
		950: '#4c0519'
	}
};

export const accentColors: { value: AccentColor; label: string; color: string }[] = [
	{ value: 'blue', label: 'Blue', color: '#2563eb' },
	{ value: 'yellow', label: 'Yellow', color: '#eab308' },
	{ value: 'green', label: 'Green', color: '#16a34a' },
	{ value: 'orange', label: 'Orange', color: '#ea580c' },
	{ value: 'teal', label: 'Teal', color: '#0d9488' },
	{ value: 'purple', label: 'Purple', color: '#9333ea' },
	{ value: 'rose', label: 'Rose', color: '#e11d48' }
];

function applyAccentColors(accent: AccentColor) {
	if (!browser) return;
	const palette = colorPalettes[accent];
	const root = document.documentElement;
	Object.entries(palette).forEach(([shade, color]) => {
		root.style.setProperty(`--accent-${shade}`, color);
	});
}

function createAccentStore() {
	let initialAccent: AccentColor = 'blue';
	if (browser) {
		const stored = localStorage.getItem('accent') as AccentColor | null;
		if (stored && accentColors.some((c) => c.value === stored)) {
			initialAccent = stored;
		}
		applyAccentColors(initialAccent);
	}

	const { subscribe, set } = writable<AccentColor>(initialAccent);

	function setAccent(accent: AccentColor) {
		set(accent);
		applyAccentColors(accent);
		if (browser) {
			localStorage.setItem('accent', accent);
		}
	}

	return {
		subscribe,
		set: setAccent
	};
}

export const accentStore = createAccentStore();
