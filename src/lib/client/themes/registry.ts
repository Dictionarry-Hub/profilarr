import type { ComponentType } from 'svelte';
import { Monitor, MoonStar, Sun, Turntable } from 'lucide-svelte';

export type ThemePreference = 'system' | 'default-light' | 'default-dark' | 'retro';
export type ThemeMode = 'light' | 'dark';

export interface ThemeDefinition {
	value: ThemePreference;
	label: string;
	shortLabel: string;
	description: string;
	icon: ComponentType;
	className: string | null;
	mode: ThemeMode | 'system';
	author?: string;
	url?: string;
}

export const themeDefinitions: ThemeDefinition[] = [
	{
		value: 'system',
		label: 'System',
		shortLabel: 'System',
		description: 'Follow the device light or dark preference',
		icon: Monitor,
		className: null,
		mode: 'system'
	},
	{
		value: 'default-light',
		label: 'Default Light',
		shortLabel: 'Light',
		description: 'Profilarr default light theme',
		icon: Sun,
		className: 'light',
		mode: 'light'
	},
	{
		value: 'default-dark',
		label: 'Default Dark',
		shortLabel: 'Dark',
		description: 'Profilarr default dark theme',
		icon: MoonStar,
		className: 'dark',
		mode: 'dark'
	},
	{
		value: 'retro',
		label: 'Retro',
		shortLabel: 'Retro',
		description: 'Windows 98 and Napster-era aesthetic',
		icon: Turntable,
		className: 'theme-retro',
		mode: 'light'
	}
];

export const themeClassNames = themeDefinitions
	.map((theme) => theme.className)
	.filter((className): className is string => className !== null);

export function isThemePreference(value: string | null): value is ThemePreference {
	return themeDefinitions.some((theme) => theme.value === value);
}

export function getThemeDefinition(value: ThemePreference): ThemeDefinition {
	return themeDefinitions.find((theme) => theme.value === value) ?? themeDefinitions[0];
}
