import type { Stage } from '$cutscene/types.ts';

export const settingsSecurityStage: Stage = {
	id: 'settings-security',
	name: 'Security',
	description: 'Password, API key, local-network bypass, and active sessions',
	steps: [
		{
			id: 'settings-security-intro',
			route: '/settings/security',
			title: 'Security',
			body: 'Your password, API key, local-network bypass, and active sessions all live on this page. Which sections are meaningful depends on the `AUTH` mode you started Profilarr with: password change applies when `AUTH=on`; with `AUTH=oidc` your identity provider owns credentials; with `AUTH=off` no auth is applied at all. API keys and sessions behave the same across modes.',
			completion: { type: 'manual' }
		},
		{
			id: 'settings-security-password',
			target: 'security-password',
			title: 'Change Password',
			body: 'A three-field form: current password, new password, and confirm. Only meaningful under `AUTH=on`, where Profilarr owns the credential; under `AUTH=oidc` or `AUTH=off` this form does nothing useful because Profilarr is not the source of truth for your identity.',
			position: 'below',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'settings-security-local-bypass',
			target: 'security-local-bypass',
			title: 'Local Bypass',
			body: 'When on, requests originating from local network addresses skip authentication entirely. The tradeoff: easier API access from scripts on the same machine or LAN, but anyone else on that network is now implicitly trusted. Safe when your LAN is single-user; risky on a shared or untrusted network.',
			position: 'below',
			freeInteract: true,
			completion: { type: 'manual' }
		},
		{
			id: 'settings-security-api-key',
			target: 'security-api-key',
			title: 'API Key',
			body: 'A single API key per instance, sent via the `X-Api-Key` header, bcrypt-hashed on the server so the raw value cannot be recovered after it is generated. Generate once, copy the key immediately (it is shown once and never again), and regenerate to rotate. Regenerating invalidates anything still using the old key, so rotate before deleting old clients, not after.',
			position: 'below',
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
			body: 'Security is a cross-mode toolkit: use the parts that match your auth mode, rotate the API key when credentials leak, flip local bypass only when you trust the LAN, and revoke sessions you do not recognize.',
			completion: { type: 'manual' }
		}
	]
};
