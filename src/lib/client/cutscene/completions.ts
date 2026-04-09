import type { Step } from './types.ts';
import { stateChecks } from './stateChecks.ts';

let cleanup: (() => void) | null = null;

export function setupCompletion(step: Step, onComplete: () => void): void {
	teardownCompletion();

	switch (step.completion.type) {
		case 'click': {
			if (!step.target) {
				onComplete();
				return;
			}

			const target = step.target;

			const tryAttach = (): boolean => {
				const el = document.querySelector(`[data-onboarding="${target}"]`);
				if (!el) return false;

				const handler = () => {
					onComplete();
				};
				el.addEventListener('click', handler, { once: true });
				cleanup = () => el.removeEventListener('click', handler);
				return true;
			};

			// Try immediately
			if (tryAttach()) return;

			// Watch for element to appear
			const observer = new MutationObserver(() => {
				if (tryAttach()) observer.disconnect();
			});
			observer.observe(document.body, { childList: true, subtree: true });
			cleanup = () => observer.disconnect();
			break;
		}

		case 'route': {
			const targetPath = step.completion.path;

			const checkRoute = (): boolean => {
				return window.location.pathname === targetPath;
			};

			// Already there
			if (checkRoute()) {
				onComplete();
				return;
			}

			// Poll for route change
			const interval = setInterval(() => {
				if (checkRoute()) {
					clearInterval(interval);
					onComplete();
				}
			}, 200);
			cleanup = () => clearInterval(interval);
			break;
		}

		case 'state': {
			const checkName = step.completion.check;
			const checkFn = stateChecks[checkName];
			if (!checkFn) {
				console.warn(`Unknown state check: ${checkName}`);
				return;
			}

			let active = true;
			const poll = async () => {
				while (active) {
					try {
						if (await checkFn()) {
							if (active) onComplete();
							return;
						}
					} catch {
						// Retry on next poll
					}
					await new Promise((r) => setTimeout(r, 1500));
				}
			};
			poll();
			cleanup = () => {
				active = false;
			};
			break;
		}

		case 'manual': {
			// No setup needed, the overlay renders a Continue button
			break;
		}
	}
}

export function teardownCompletion(): void {
	if (cleanup) {
		cleanup();
		cleanup = null;
	}
}
