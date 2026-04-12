<script lang="ts">
	import type { ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { UserPlus, Shield, Wifi, KeyRound, ShieldOff } from 'lucide-svelte';
	import Button from '$ui/button/Button.svelte';
	import FormInput from '$ui/form/FormInput.svelte';
	import { alertStore } from '$alerts/store';
	import logo from '$assets/logo-512.png';

	export let form: ActionData;

	let submitting = false;
	let username = form?.username ?? '';
	let password = '';
	let confirmPassword = '';
	// Show errors via alert system
	$: if (form?.error) {
		alertStore.add('error', form.error);
	}
</script>

<svelte:head>
	<title>Setup - Profilarr</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-neutral-100 p-4 dark:bg-neutral-900">
	<div class="flex w-full max-w-3xl flex-col gap-8 md:flex-row md:gap-12">
		<!-- Header - always first -->
		<div class="flex flex-col space-y-6 md:flex-1">
			<div class="flex items-center gap-4">
				<img src={logo} alt="Profilarr logo" class="h-12 w-12" />
				<div>
					<h1 class="text-xl font-bold text-neutral-900 dark:text-neutral-50">
						Welcome to Profilarr
					</h1>
					<p class="text-sm text-neutral-600 dark:text-neutral-400">
						Create your admin account to get started.
					</p>
				</div>
			</div>

			<!-- Auth info - visible on desktop, hidden on mobile (shown below form) -->
			<div
				class="hidden rounded-xl border border-neutral-200/60 bg-white/50 p-5 shadow-sm backdrop-blur-sm md:block dark:border-neutral-700/60 dark:bg-neutral-800/50"
			>
				<p class="text-xs font-medium text-neutral-700 dark:text-neutral-300">
					Configure authentication via the <code
						class="rounded bg-neutral-200 px-1 py-0.5 text-[11px] dark:bg-neutral-700">AUTH</code
					> environment variable:
				</p>
				<ul class="mt-3 space-y-2 text-xs text-neutral-600 dark:text-neutral-400">
					<li class="flex items-center gap-2">
						<Shield size={12} class="text-neutral-400" />
						<code class="font-mono text-neutral-800 dark:text-neutral-200">on</code>
						<span>— Full authentication</span>
						<span class="text-neutral-400 dark:text-neutral-500">(default)</span>
					</li>
					<li class="flex items-center gap-2">
						<Wifi size={12} class="text-neutral-400" />
						<code class="font-mono text-neutral-800 dark:text-neutral-200">local</code>
						<span>— Skip auth for local network</span>
					</li>
					<li class="flex items-center gap-2">
						<KeyRound size={12} class="text-neutral-400" />
						<code class="font-mono text-neutral-800 dark:text-neutral-200">oidc</code>
						<span>— Use external provider</span>
					</li>
					<li class="flex items-center gap-2">
						<ShieldOff size={12} class="text-neutral-400" />
						<code class="font-mono text-neutral-800 dark:text-neutral-200">off</code>
						<span>— For reverse proxy setups</span>
					</li>
				</ul>
			</div>
		</div>

		<!-- Form -->
		<div class="w-full md:flex-1">
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
					placeholder="admin"
					autocomplete="username"
					bind:value={username}
				/>

				<FormInput
					name="password"
					label="Password"
					hideLabel
					type="password"
					placeholder="Minimum 8 characters"
					autocomplete="new-password"
					private_
					bind:value={password}
				/>

				<FormInput
					name="confirmPassword"
					label="Confirm Password"
					hideLabel
					type="password"
					placeholder="Re-enter your password"
					autocomplete="new-password"
					private_
					bind:value={confirmPassword}
				/>

				<Button
					type="submit"
					variant="primary"
					size="md"
					fullWidth
					icon={UserPlus}
					text={submitting ? 'Creating Account...' : 'Create Account'}
					disabled={submitting}
				/>
			</form>
		</div>
	</div>
</div>
