import type { Stage } from '$cutscene/types.ts';

export const settingsNotificationsStage: Stage = {
	id: 'settings-notifications',
	name: 'Notifications',
	description: 'Push alerts to external services when specific events happen',
	steps: [
		{
			id: 'settings-notifications-intro',
			route: '/settings/notifications',
			title: 'Notifications',
			body: 'Profilarr can push alerts out to external services when specific events happen: job success and failure, sync outcomes, backup results, and similar. A range of service types is supported (chat apps, push services, generic webhooks, and more), and multiple services can be active at once, each with its own subset of enabled event types, so you can route critical failures one way and routine completions another.',
			completion: { type: 'manual' }
		},
		{
			id: 'settings-notifications-add',
			target: 'notifications-add',
			title: 'Add Service',
			body: 'Add Service opens the new-service form, where you pick a service type, fill in the credentials that type needs (webhook URL, bot token, topic, and so on), and choose which event types this service will listen for. We will not walk the form in this stage since it requires real credentials to finish, but it is the single entry point for wiring up a new destination.',
			position: 'center',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'settings-notifications-table',
			target: 'notifications-table',
			title: 'Services Table',
			body: 'One row per configured service, showing its type, enabled or disabled status, and a running count of successes and failures. Per-row actions are Test (fires a sample notification to confirm credentials and network path), Edit (reopens the form), and Delete.',
			position: 'below',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'settings-notifications-history',
			target: 'notifications-history',
			title: 'Notification History',
			body: 'Every delivery attempt is recorded here with its outcome, which is how you audit whether alerts actually made it through. If a service is silently failing, this is the view that shows it; pair with the Test action above to confirm you have fixed it.',
			position: 'center',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'settings-notifications-summary',
			title: 'Summary',
			body: 'Add a service, pick the event types it should listen for, use Test to confirm credentials work, and audit deliveries in the history panel. Multiple services can run side-by-side if you want different destinations for different severities.',
			completion: { type: 'manual' }
		}
	]
};
