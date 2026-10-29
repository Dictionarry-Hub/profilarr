<script lang="ts">
	import FormInput from '#ui/form/FormInput.svelte';
	export let config: Record<string, unknown> = {};
	export let mode: 'create' | 'edit' = 'create';
	/** Secret keys that hold a stored value (the values themselves never reach the browser) */
	export let storedSecrets: string[] = [];

	let serverUrl = (config.server_url as string) || 'https://ntfy.sh';
	let topic = (config.topic as string) || '';
	let accessToken = (config.access_token as string) || '';

	// The stored token is sent to the server URL, so a new server needs the token re-entered
	$: serverChanged =
		mode === 'edit' && serverUrl.trim() !== ((config.server_url as string) ?? '').trim();
	$: tokenRequired = serverChanged && storedSecrets.includes('access_token');
	/** Why saving is blocked, for the parent's Save button tooltip. Empty when it isn't. */
	export let requiredSecretMessage = '';
	$: requiredSecretMessage =
		tokenRequired && !accessToken.trim() ? 'Enter the access token to change the server URL' : '';
</script>

<div class="space-y-4">
	<h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Ntfy Configuration</h3>

	<!-- Server URL -->
	<FormInput
		label="Server URL"
		name="server_url"
		type="url"
		value={serverUrl}
		placeholder="https://ntfy.sh"
		description="The ntfy server URL. Use https://ntfy.sh for the public instance or your self-hosted URL"
		required
		on:input={(e) => (serverUrl = e.detail)}
	/>

	<!-- Topic -->
	<FormInput
		label="Topic"
		name="topic"
		value={topic}
		placeholder="profilarr"
		description="The ntfy topic to publish notifications to"
		required
		on:input={(e) => (topic = e.detail)}
	/>

	<!-- Access Token -->
	<FormInput
		label="Access Token"
		name="access_token"
		value={accessToken}
		placeholder={mode === 'edit' ? '••••••••••••••••' : 'tk_...'}
		description={mode === 'edit'
			? tokenRequired
				? 'Required when the server URL changes'
				: 'Leave blank to keep existing token'
			: "Required if your ntfy server has access control enabled. Generate a token via your server's admin interface or ntfy token add"}
		required={tokenRequired}
		private_
		on:input={(e) => (accessToken = e.detail)}
	/>
</div>
