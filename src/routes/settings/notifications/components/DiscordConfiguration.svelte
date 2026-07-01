<script lang="ts">
	import FormInput from '$ui/form/FormInput.svelte';
	import Toggle from '$ui/toggle/Toggle.svelte';
	export let config: Record<string, unknown> = {};
	export let mode: 'create' | 'edit' = 'create';

	// Extract config values with defaults
	let webhookUrl = (config.webhook_url as string) || '';
	let username = (config.username as string) || '';
	let avatarUrl = (config.avatar_url as string) || '';
	let enableMentions = (config.enable_mentions as boolean) || false;
</script>

<div class="space-y-4">
	<h3 class="text-sm font-semibold text-text">Discord Configuration</h3>

	<!-- Webhook URL -->
	<FormInput
		label="Webhook URL"
		name="webhook_url"
		type="url"
		value={webhookUrl}
		placeholder={mode === 'edit' ? '••••••••••••••••' : 'https://discord.com/api/webhooks/...'}
		description={mode === 'edit'
			? 'Leave blank to keep existing webhook URL'
			: 'Get this from Server Settings → Integrations → Webhooks in Discord'}
		required={mode === 'create'}
		private_
		on:input={(e) => (webhookUrl = e.detail)}
	/>

	<!-- Bot Username -->
	<FormInput
		label="Bot Username"
		name="username"
		value={username}
		placeholder="Profilarr"
		description="Custom username for the webhook bot (optional)"
		on:input={(e) => (username = e.detail)}
	/>

	<!-- Avatar URL -->
	<FormInput
		label="Avatar URL"
		name="avatar_url"
		type="url"
		value={avatarUrl}
		placeholder="https://example.com/avatar.png"
		description="Custom avatar image for the webhook bot (optional)"
		on:input={(e) => (avatarUrl = e.detail)}
	/>

	<!-- Enable Mentions -->
	<div>
		<Toggle
			label="Enable @here mentions"
			checked={enableMentions}
			on:change={() => (enableMentions = !enableMentions)}
		/>
		<input type="hidden" name="enable_mentions" value={enableMentions ? 'on' : ''} />
		<p class="mt-1 px-3 text-xs text-text-muted">
			Mention @here in notifications to alert online users
		</p>
	</div>
</div>
