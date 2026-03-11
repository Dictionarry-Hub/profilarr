export interface ThemeVariant {
	bg: string;
	text: string;
	keyword: string;
	identifier: string;
	string: string;
	number: string;
	comment: string;
	operator: string;
	punctuation: string;
	key: string;
	literal: string;
}

export interface CodeTheme {
	name: string;
	light: ThemeVariant;
	dark: ThemeVariant;
}

import { defaultTheme } from './default';

export const themes: CodeTheme[] = [defaultTheme];

export function getTheme(name: string): CodeTheme {
	return themes.find((t) => t.name === name) ?? themes[0];
}
