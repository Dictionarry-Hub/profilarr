<script lang="ts">
	import { goto } from '$app/navigation';
	import Modal from './Modal.svelte';
	import Button from '$ui/button/Button.svelte';
	import Label from '$ui/label/Label.svelte';
	import { Check, X, Loader2, RefreshCw, ArrowRight } from 'lucide-svelte';
	import type { AffectedArr } from '$shared/sync/types.ts';

	export let open = false;
	export let redirectTo: string;
	export let affectedArrs: AffectedArr[];
	export let databaseId: number;
	export let entityName: string;
	export let entityType:
		| 'qualityProfile'
		| 'customFormat'
		| 'regularExpression'
		| 'delayProfile'
		| 'naming'
		| 'qualityDefinitions'
		| 'mediaSettings' = 'qualityProfile';

	type InstanceState = 'idle' | 'syncing' | 'done' | 'failed' | 'cooldown';

	let instanceStates: Map<number, InstanceState> = new Map();
	let instanceErrors: Map<number, string> = new Map();
	let instanceRetry: Map<number, number> = new Map();

	$: if (open) {
		instanceStates = new Map(affectedArrs.map((a) => [a.instanceId, 'idle']));
		instanceErrors = new Map();
		instanceRetry = new Map();
	}

	$: allDone =
		affectedArrs.length > 0 &&
		affectedArrs.every((a) => {
			const state = instanceStates.get(a.instanceId);
			return state === 'done' || state === 'failed' || state === 'cooldown';
		});

	$: anySyncing = affectedArrs.some((a) => instanceStates.get(a.instanceId) === 'syncing');

	async function syncInstance(instanceId: number) {
		instanceStates.set(instanceId, 'syncing');
		instanceStates = instanceStates;

		try {
			const res = await fetch('/api/v1/arr/sync-entity', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ instanceId, databaseId, entityName, entityType })
			});

			if (res.ok) {
				instanceStates.set(instanceId, 'done');
			} else {
				const data = await res.json();
				if (res.status === 409) {
					if (data.retryAfter) {
						instanceStates.set(instanceId, 'cooldown');
						instanceRetry.set(instanceId, data.retryAfter);
						instanceRetry = instanceRetry;
					} else {
						instanceStates.set(instanceId, 'cooldown');
						instanceErrors.set(instanceId, data.error || 'Sync in progress');
					}
				} else {
					instanceStates.set(instanceId, 'failed');
					instanceErrors.set(instanceId, data.error || 'Sync failed');
				}
			}
		} catch {
			instanceStates.set(instanceId, 'failed');
			instanceErrors.set(instanceId, 'Network error');
		}

		instanceStates = instanceStates;
		instanceErrors = instanceErrors;
	}

	function syncAll() {
		for (const arr of affectedArrs) {
			const state = instanceStates.get(arr.instanceId);
			if (state === 'idle' || state === 'failed') {
				syncInstance(arr.instanceId);
			}
		}
	}

	function skip() {
		open = false;
		goto(redirectTo);
	}

	function done() {
		open = false;
		goto(redirectTo);
	}

	function getStateVariant(state: InstanceState): 'secondary' | 'success' | 'danger' | 'warning' {
		switch (state) {
			case 'done':
				return 'success';
			case 'failed':
				return 'danger';
			case 'cooldown':
				return 'warning';
			default:
				return 'secondary';
		}
	}

	function getStateLabel(state: InstanceState, instanceId: number): string {
		switch (state) {
			case 'syncing':
				return 'Syncing...';
			case 'done':
				return 'Synced';
			case 'failed':
				return instanceErrors.get(instanceId) || 'Failed';
			case 'cooldown': {
				const retry = instanceRetry.get(instanceId);
				return retry ? `Wait ${retry}s` : instanceErrors.get(instanceId) || 'Cooldown';
			}
			default:
				return 'Pending';
		}
	}
</script>

<Modal {open} header="Sync Changes" on:cancel={skip}>
	<svelte:fragment slot="body">
		<div class="space-y-3">
			<p class="text-sm text-neutral-600 dark:text-neutral-400">
				The following instances sync this entity. Would you like to push your changes now?
			</p>

			<div class="space-y-2">
				{#each affectedArrs as arr (arr.instanceId)}
					{@const state = instanceStates.get(arr.instanceId) || 'idle'}
					<div
						class="rounded-xl border border-neutral-200 bg-white px-3 py-2.5 dark:border-neutral-700/60 dark:bg-neutral-800/50"
					>
						<div class="flex items-center justify-between">
							<div>
								<span class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
									{arr.instanceName}
								</span>
								{#if state !== 'idle'}
									<div class="mt-1">
										<Label variant={getStateVariant(state)} size="sm" rounded="md">
											{getStateLabel(state, arr.instanceId)}
										</Label>
									</div>
								{/if}
							</div>

							<div class="flex items-center">
								{#if affectedArrs.length > 1}
									{#if state === 'idle' || state === 'failed'}
										<Button
											text="Sync"
											icon={state === 'failed' ? RefreshCw : ArrowRight}
											size="xs"
											variant="primary"
											on:click={() => syncInstance(arr.instanceId)}
										/>
									{:else if state === 'syncing'}
										<Loader2 size={16} class="animate-spin text-neutral-400" />
									{:else if state === 'done'}
										<Check size={16} class="text-green-500" />
									{/if}
								{:else if state === 'syncing'}
									<Loader2 size={16} class="animate-spin text-neutral-400" />
								{:else if state === 'done'}
									<Check size={16} class="text-green-500" />
								{:else if state === 'failed' || state === 'cooldown'}
									<Button
										text="Retry"
										icon={RefreshCw}
										size="xs"
										variant="primary"
										on:click={() => syncInstance(arr.instanceId)}
									/>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</svelte:fragment>

	<svelte:fragment slot="footer">
		<Button text="Skip" icon={X} disabled={anySyncing} on:click={skip} />
		{#if allDone}
			<Button text="Done" icon={Check} variant="primary" on:click={done} />
		{:else}
			<Button
				text="Sync All"
				icon={RefreshCw}
				variant="primary"
				disabled={anySyncing}
				on:click={syncAll}
			/>
		{/if}
	</svelte:fragment>
</Modal>
