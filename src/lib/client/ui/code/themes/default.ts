import type { CodeTheme } from './index';

export const defaultTheme: CodeTheme = {
	name: 'Default',
	dark: {
		bg: '#171717',
		text: '#cdd6f4',
		keyword: '#89b4fa',
		identifier: '#a6e3a1',
		string: '#cdd6f4',
		number: '#fab387',
		comment: '#6c7086',
		operator: '#89dceb',
		punctuation: '#7f849c',
		key: '#89b4fa',
		literal: '#89dceb'
	},
	light: {
		bg: '#ffffff',
		text: '#4c4f69',
		keyword: '#1e66f5',
		identifier: '#40a02b',
		string: '#4c4f69',
		number: '#fe640b',
		comment: '#9ca0b0',
		operator: '#04a5e5',
		punctuation: '#8c8fa1',
		key: '#1e66f5',
		literal: '#04a5e5'
	}
};
