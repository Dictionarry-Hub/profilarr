import { get, writable } from 'svelte/store';
import { uuid } from '#shared/utils/uuid.ts';
import { alertSettingsStore } from './settings.ts';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

export interface Alert {
	id: string;
	type: AlertType;
	message: string;
	duration?: number; // Auto-dismiss duration in ms (default: 5000)
}

function createAlertStore() {
	const { subscribe, update } = writable<Alert[]>([]);

	return {
		subscribe,
		add: (type: AlertType, message: string, duration?: number) => {
			const settingsDuration = get(alertSettingsStore).durationMs;
			const resolvedDuration = typeof duration === 'number' ? duration : settingsDuration;
			const id = uuid();
			const alert: Alert = { id, type, message, duration: resolvedDuration };

			update((alerts) => [...alerts, alert]);

			// Auto-dismiss after duration
			if (resolvedDuration > 0) {
				setTimeout(() => {
					update((alerts) => alerts.filter((a) => a.id !== id));
				}, resolvedDuration);
			}

			return id;
		},
		remove: (id: string) => {
			update((alerts) => alerts.filter((a) => a.id !== id));
		},
		clear: () => {
			update(() => []);
		}
	};
}

export const alertStore = createAlertStore();
