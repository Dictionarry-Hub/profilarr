import type { Stage } from '$cutscene/types.ts';

export const settingsSecurityStage: Stage = {
	id: 'settings-security',
	name: 'Security',
	description: 'Password, API key, and active sessions',
	steps: [
		{
			id: 'settings-security-intro',
			route: '/settings/security',
			title: 'Security',
			body: 'Your password, API key, and active sessions all live on this page. The account section depends on how you signed in: with a password you can change it here; with SSO your identity provider owns your credentials, but you can add a local account to fall back on. With `AUTH=off` no auth is applied at all. API keys and sessions behave the same either way.',
			completion: { type: 'manual' }
		},
		{
			id: 'settings-security-password',
			target: 'security-password',
			title: 'Your Account',
			body: 'Signed in with a password, this is where you change it: current password, new password, and confirm. Signed in with SSO, you can instead create a local account here, so you can still sign in if your identity provider is unavailable. Only one local account can exist.',
			position: 'below',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'settings-security-api-key',
			target: 'security-api-key',
			title: 'API Keys',
			body: 'Named keys for scripts and integrations, sent via the `X-Api-Key` header. Each key has full access or read / read & write access per API area, and an optional expiry. Keys are bcrypt-hashed and shown once at creation, then cannot be changed. To rotate, create a new key, move your clients over, then delete the old one.',
			position: 'above',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'settings-security-sessions',
			target: 'security-sessions',
			title: 'Active Sessions',
			body: 'Browser sessions tied to the current Profilarr user. Each row shows browser, OS, device type, IP, and last active time, which is how you spot a session you do not recognize. Per-row Revoke ends that session specifically; "Revoke Others" in the section header ends every session except the one you are using right now.',
			position: 'above',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'settings-security-summary',
			title: 'Summary',
			body: 'Security is a cross-mode toolkit: use the parts that match your auth mode, replace an API key when it leaks, and revoke sessions you do not recognize.',
			completion: { type: 'manual' }
		}
	]
};
