/**
 * Navigation icon style store (emoji vs lucide icons)
 */

import { writable } from 'svelte/store';
import { browser } from '$app/env';

export type NavIconStyle = 'emoji' | 'lucide';

function createNavIconStore() {
	let initialStyle: NavIconStyle = 'lucide';
	if (browser) {
		const stored = localStorage.getItem('navIconStyle') as NavIconStyle | null;
		if (stored && (stored === 'emoji' || stored === 'lucide')) {
			initialStyle = stored;
		}
	}

	const { subscribe, set } = writable<NavIconStyle>(initialStyle);

	function setStyle(style: NavIconStyle) {
		set(style);
		if (browser) {
			localStorage.setItem('navIconStyle', style);
			document.documentElement.dataset.navIcons = style;
		}
	}

	function toggle() {
		if (browser) {
			const current = localStorage.getItem('navIconStyle') as NavIconStyle | null;
			const newStyle = current === 'emoji' ? 'lucide' : 'emoji';
			setStyle(newStyle);
		}
	}

	return {
		subscribe,
		setStyle,
		toggle
	};
}

export const navIconStore = createNavIconStore();
