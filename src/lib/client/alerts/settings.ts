import { writable } from 'svelte/store';
import { browser } from '$app/env';

export const ALERT_POSITIONS = [
	'top-left',
	'top-center',
	'top-right',
	'bottom-left',
	'bottom-center',
	'bottom-right'
] as const;

export type AlertPosition = (typeof ALERT_POSITIONS)[number];

export interface AlertSettings {
	position: AlertPosition;
	durationMs: number;
}

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
	position: 'top-center',
	durationMs: 8000
};

const ALERT_SETTINGS_STORAGE_KEY = 'alertSettings';
const ALERT_POSITION_SET = new Set<AlertPosition>(ALERT_POSITIONS);

function isAlertPosition(value: unknown): value is AlertPosition {
	return typeof value === 'string' && ALERT_POSITION_SET.has(value as AlertPosition);
}

function parseStoredSettings(value: string | null): AlertSettings | null {
	if (!value) return null;
	try {
		const parsed = JSON.parse(value) as Partial<AlertSettings> | null;
		if (!parsed || !isAlertPosition(parsed.position)) return null;
		const durationMs = Number(parsed.durationMs);
		if (!Number.isFinite(durationMs) || durationMs < 0) return null;
		return { position: parsed.position, durationMs: Math.round(durationMs) };
	} catch {
		return null;
	}
}

function persist(settings: AlertSettings) {
	if (!browser) return;
	localStorage.setItem(ALERT_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function createAlertSettingsStore() {
	let initial = DEFAULT_ALERT_SETTINGS;
	if (browser) {
		const stored = parseStoredSettings(localStorage.getItem(ALERT_SETTINGS_STORAGE_KEY));
		if (stored) {
			initial = stored;
		}
	}

	const { subscribe, set } = writable<AlertSettings>(initial);

	function setSettings(next: AlertSettings) {
		set(next);
		persist(next);
	}

	return {
		subscribe,
		setSettings
	};
}

export const alertSettingsStore = createAlertSettingsStore();
