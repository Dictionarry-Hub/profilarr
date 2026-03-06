<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { LogIn, KeyRound } from 'lucide-svelte';
	import Button from '$ui/button/Button.svelte';
	import FormInput from '$ui/form/FormInput.svelte';
	import { alertStore } from '$alerts/store';
	import logo from '$assets/logo-512.png';

	export let data: PageData;
	export let form: ActionData;

	let submitting = false;
	let username = form?.username ?? '';
	let password = '';

	// Show errors via alert system
	$: if (form?.error) {
		alertStore.add('error', form.error);
	}
</script>

<svelte:head>
	<title>Login - Profilarr</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-neutral-100 p-4 dark:bg-neutral-900">
	<div class="w-full max-w-sm">
		<div class="mb-8 flex items-center gap-4">
			<img src={logo} alt="Profilarr logo" class="h-12 w-12" />
			<div>
				<h1 class="text-xl font-bold text-neutral-900 dark:text-neutral-50">Welcome back</h1>
				<p class="text-sm text-neutral-600 dark:text-neutral-400">Sign in to continue.</p>
			</div>
		</div>

		{#if data.authMode === 'oidc'}
			<!-- OIDC login button -->
			<Button
				href="/auth/oidc/login"
				variant="primary"
				size="md"
				fullWidth
				icon={KeyRound}
				text="Sign in with SSO"
			/>
		{:else}
			<!-- Username/password form -->
			<form
				method="POST"
				class="space-y-6"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						await update({ reset: false });
						submitting = false;
					};
				}}
			>
				<FormInput
					name="username"
					label="Username"
					hideLabel
					type="text"
					placeholder="Username"
					autocomplete="username"
					bind:value={username}
				/>

				<FormInput
					name="password"
					label="Password"
					hideLabel
					type="password"
					placeholder="Password"
					autocomplete="current-password"
					private_
					bind:value={password}
				/>

				<Button
					type="submit"
					variant="primary"
					size="md"
					fullWidth
					icon={LogIn}
					text={submitting ? 'Signing In...' : 'Sign In'}
					disabled={submitting}
				/>
			</form>
		{/if}
	</div>
</div>
