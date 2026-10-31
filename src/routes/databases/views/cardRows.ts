import RefreshCw from '@lucide/svelte/icons/refresh-cw';
import GitPullRequest from '@lucide/svelte/icons/git-pull-request';
import Sliders from '@lucide/svelte/icons/sliders-vertical';
import Palette from '@lucide/svelte/icons/palette';
import Clock from '@lucide/svelte/icons/clock';
import type { CardRowOption } from '#stores/dataPage.ts';

/** Every row a database card can show, in card order, for the card rows picker. */
export const DATABASE_CARD_ROWS = [
	{ key: 'sync', label: 'Sync', icon: RefreshCw, defaultVisible: true },
	{ key: 'autoPull', label: 'Auto Pull', icon: GitPullRequest, defaultVisible: true },
	{ key: 'qualityProfiles', label: 'Quality Profiles', icon: Sliders, defaultVisible: true },
	{ key: 'customFormats', label: 'Custom Formats', icon: Palette, defaultVisible: true },
	{ key: 'delayProfiles', label: 'Delay Profiles', icon: Clock, defaultVisible: true }
] as const satisfies readonly CardRowOption[];

export type DatabaseRowKey = (typeof DATABASE_CARD_ROWS)[number]['key'];
