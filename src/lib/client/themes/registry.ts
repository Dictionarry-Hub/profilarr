import type { ComponentType } from 'svelte';
import {
	History,
	Monitor,
	MoonStar,
	Flame,
	RectangleVertical,
	Sparkle,
	Sun,
	Turntable,
	Radar,
	Skull,
	Zap
} from 'lucide-svelte';

export type ThemePreference =
	| 'system'
	| 'default-light'
	| 'default-dark'
	| 'retro'
	| 'classic'
	| 'vesper'
	| 'ashruvarsha'
	| 'monolith'
	| 'velouria'
	| 'roswell'
	| 'larbalestier';
export type ThemeMode = 'light' | 'dark';

export interface ThemeDefinition {
	value: ThemePreference;
	label: string;
	shortLabel: string;
	description: string;
	icon: ComponentType;
	className: string | null;
	mode: ThemeMode | 'system';
	fixedAccent?: boolean;
	accentColor?: string;
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
		mode: 'light',
		fixedAccent: true,
		accentColor: '#000080'
	},
	{
		value: 'classic',
		label: 'Classic',
		shortLabel: 'Classic',
		description: 'The original Profilarr v1 look',
		icon: History,
		className: 'theme-classic',
		mode: 'dark',
		fixedAccent: true,
		accentColor: '#2563eb',
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
		fixedAccent: true,
		accentColor: '#d4a24c',
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
		fixedAccent: true,
		accentColor: '#f72585',
		defaultSans: 'rajdhani',
		defaultMono: 'space-mono'
	},
	{
		value: 'monolith',
		label: 'Monolith',
		shortLabel: 'Monolith',
		description: 'Open the pod bay doors',
		icon: RectangleVertical,
		className: 'theme-monolith',
		mode: 'light',
		fixedAccent: true,
		accentColor: '#c62828',
		defaultSans: 'jost',
		defaultMono: 'space-mono'
	},
	{
		value: 'velouria',
		label: 'Velouria',
		shortLabel: 'Velouria',
		description: 'Dig for fire',
		icon: Flame,
		className: 'theme-velouria',
		mode: 'dark',
		fixedAccent: true,
		accentColor: '#e63a1e',
		defaultSans: 'syne',
		defaultMono: 'space-mono'
	},
	{
		value: 'roswell',
		label: 'Roswell',
		shortLabel: 'Roswell',
		description: 'Motorway to Roswell',
		icon: Radar,
		className: 'theme-roswell',
		mode: 'light',
		fixedAccent: true,
		accentColor: '#7c3aed',
		defaultSans: 'outfit',
		defaultMono: 'space-mono'
	},
	{
		value: 'larbalestier',
		label: 'Larbalestier',
		shortLabel: 'Larbalestier',
		description: 'Monkey gone to heaven',
		icon: Skull,
		className: 'theme-larbalestier',
		mode: 'dark',
		fixedAccent: true,
		accentColor: '#cc8800',
		defaultSans: 'archivo',
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
