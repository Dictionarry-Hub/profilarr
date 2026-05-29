import type { ComponentType } from 'svelte';
import { History, Monitor, MoonStar, Sparkle, Sun, Turntable, Zap } from 'lucide-svelte';

export type ThemePreference =
	| 'system'
	| 'default-light'
	| 'default-dark'
	| 'retro'
	| 'classic'
	| 'vesper'
	| 'ashruvarsha';
export type ThemeMode = 'light' | 'dark';

export interface ThemeDefinition {
	value: ThemePreference;
	label: string;
	shortLabel: string;
	description: string;
	icon: ComponentType;
	className: string | null;
	mode: ThemeMode | 'system';
	defaultSans?: string;
	defaultMono?: string;
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
		mode: 'light',
		defaultSans: 'dm-sans',
		defaultMono: 'geist-mono'
	},
	{
		value: 'default-dark',
		label: 'Default Dark',
		shortLabel: 'Dark',
		description: 'Profilarr default dark theme',
		icon: MoonStar,
		className: 'dark',
		mode: 'dark',
		defaultSans: 'dm-sans',
		defaultMono: 'geist-mono'
	},
	{
		value: 'retro',
		label: 'Retro',
		shortLabel: 'Retro',
		description: 'Windows 98 and Napster-era aesthetic',
		icon: Turntable,
		className: 'theme-retro',
		mode: 'light'
	},
	{
		value: 'classic',
		label: 'Classic',
		shortLabel: 'Classic',
		description: 'The original Profilarr v1 look',
		icon: History,
		className: 'theme-classic',
		mode: 'dark',
		defaultSans: 'dm-sans',
		defaultMono: 'geist-mono'
	},
	{
		value: 'vesper',
		label: 'Vesper',
		shortLabel: 'Vesper',
		description: 'Twilight indigo with amber starlight',
		icon: Sparkle,
		className: 'theme-vesper',
		mode: 'dark',
		defaultSans: 'ibm-plex-sans',
		defaultMono: 'ibm-plex-mono'
	},
	{
		value: 'ashruvarsha',
		label: 'Ashruvarsha',
		shortLabel: 'Ashruvarsha',
		description: 'Tears in rain',
		icon: Zap,
		className: 'theme-ashruvarsha',
		mode: 'dark',
		defaultSans: 'rajdhani',
		defaultMono: 'space-mono'
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
