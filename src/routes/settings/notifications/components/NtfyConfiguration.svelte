<script lang="ts">
	import FormInput from '$ui/form/FormInput.svelte';
	export let config: Record<string, unknown> = {};
	export let mode: 'create' | 'edit' = 'create';

	let serverUrl = (config.server_url as string) || 'https://ntfy.sh';
	let topic = (config.topic as string) || '';
	let accessToken = (config.access_token as string) || '';
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
			? 'Leave blank to keep existing token'
			: "Required if your ntfy server has access control enabled. Generate a token via your server's admin interface or ntfy token add"}
		private_
		on:input={(e) => (accessToken = e.detail)}
	/>
</div>
