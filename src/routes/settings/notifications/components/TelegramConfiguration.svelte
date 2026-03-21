<script lang="ts">
	import FormInput from '$ui/form/FormInput.svelte';
	export let config: Record<string, unknown> = {};
	export let mode: 'create' | 'edit' = 'create';

	let botToken = (config.bot_token as string) || '';
	let chatId = (config.chat_id as string) || '';
</script>

<div class="space-y-4">
	<h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
		Telegram Configuration
	</h3>

	<!-- Bot Token -->
	<FormInput
		label="Bot Token"
		name="bot_token"
		value={botToken}
		placeholder={mode === 'edit' ? '••••••••••••••••' : '123456789:ABCdefGHI...'}
		description={mode === 'edit'
			? 'Leave blank to keep existing token'
			: 'Create a bot via @BotFather on Telegram to get a token'}
		private_
		on:input={(e) => (botToken = e.detail)}
	/>

	<!-- Chat ID -->
	<FormInput
		label="Chat ID"
		name="chat_id"
		value={chatId}
		placeholder="e.g., 123456789"
		description="Your user or group chat ID. Message @userinfobot on Telegram to find yours"
		required
		on:input={(e) => (chatId = e.detail)}
	/>
</div>
