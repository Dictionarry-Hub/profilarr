<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { enhance } from '$app/forms';
	import X from '@lucide/svelte/icons/x';
	import Check from '@lucide/svelte/icons/check';
	import Loader2 from '@lucide/svelte/icons/loader-circle';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import Modal from '#ui/modal/Modal.svelte';
	import Button from '#ui/button/Button.svelte';
	import FormInput from '#ui/form/FormInput.svelte';
	import { alertStore } from '#client/alerts/store.ts';

	// Asks the session to confirm its identity before an API key can be created.
	// A password session confirms here; an SSO session is sent to its provider
	// and comes back on the key form, or back to Security when the provider
	// could not confirm the person.
	export let open = false;
	export let confirmation: 'password' | 'sso';
	export let reauthFailed = false;

	const dispatch = createEventDispatcher<{ cancel: void; confirmed: void }>();

	let confirming = false;
	let password = '';
	let formEl: HTMLFormElement | null = null;
</script>

<Modal {open} header="Confirm it's you" on:cancel>
	<div slot="body" class="space-y-4">
		<p class="text-sm text-neutral-600 dark:text-neutral-400">
			An API key is a long-lived credential, so creating one asks you to prove your identity first.
		</p>
		{#if confirmation === 'password'}
			<form
				bind:this={formEl}
				method="POST"
				action="/settings/security/api-keys/new?/confirm"
				use:enhance={() => {
					confirming = true;
					return async ({ result }) => {
						confirming = false;
						if (result.type === 'success' || result.type === 'redirect') {
							password = '';
							dispatch('confirmed');
						} else if (result.type === 'failure') {
							alertStore.add(
								'error',
								(result.data as { confirmError?: string } | undefined)?.confirmError ??
									'Could not confirm'
							);
						} else {
							alertStore.add('error', 'Could not confirm');
						}
					};
				}}
			>
				<FormInput
					label="Password"
					name="password"
					type="password"
					autocomplete="current-password"
					placeholder="Your password"
					description="Asked again 30 minutes after your last confirmation"
					private_
					required
					bind:value={password}
				/>
			</form>
		{:else}
			{#if reauthFailed}
				<p class="text-sm text-red-600 dark:text-red-400">
					Your sign-in provider did not confirm it was you. To create API keys, sign in with a local
					account and use its password. You can create one in the Create Local Account section on
					this page.
				</p>
			{/if}
			<p class="text-sm text-neutral-600 dark:text-neutral-400">
				You signed in with SSO, so your provider has to confirm it's you. You'll be sent there and
				brought straight back.
			</p>
		{/if}
	</div>
	<svelte:fragment slot="footer">
		<Button text="Cancel" icon={X} disabled={confirming} on:click={() => dispatch('cancel')} />
		{#if confirmation === 'password'}
			<Button
				text={confirming ? 'Confirming...' : 'Confirm'}
				icon={confirming ? Loader2 : Check}
				variant="primary"
				disabled={confirming || !password}
				loading={confirming}
				on:click={() => formEl?.requestSubmit()}
			/>
		{:else}
			<Button
				text="Confirm with SSO"
				icon={KeyRound}
				variant="primary"
				href="/auth/oidc/login?reauth=1"
				reload
			/>
		{/if}
	</svelte:fragment>
</Modal>
