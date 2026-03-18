<script lang="ts">
	import FormInput from '$ui/form/FormInput.svelte';
	export let config: Record<string, unknown> = {};
	export let mode: 'create' | 'edit' = 'create';

	let webhookUrl = (config.webhook_url as string) || '';
	let authHeader = (config.auth_header as string) || '';
</script>

<div class="space-y-4">
	<h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
		Webhook Configuration
	</h3>

	<!-- Webhook URL -->
	<FormInput
		label="Webhook URL"
		name="webhook_url"
		type="url"
		value={webhookUrl}
		placeholder={mode === 'edit' ? '••••••••••••••••' : 'https://example.com/webhook'}
		description={mode === 'edit'
			? 'Leave blank to keep existing URL'
			: 'The URL to POST notification JSON to'}
		required={mode === 'create'}
		private_
		on:input={(e) => (webhookUrl = e.detail)}
	/>

	<!-- Authorization Header -->
	<FormInput
		label="Authorization Header"
		name="auth_header"
		value={authHeader}
		placeholder={mode === 'edit' ? '••••••••••••••••' : 'Bearer your-token'}
		description={mode === 'edit'
			? 'Leave blank to keep existing value'
			: 'Raw value for the Authorization header (e.g., Bearer token, Basic base64). Optional'}
		private_
		on:input={(e) => (authHeader = e.detail)}
	/>
</div>
