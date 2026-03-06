<script lang="ts">
	import QualityDefinitionsForm from '../components/QualityDefinitionsForm.svelte';
	import DirtyModal from '$ui/modal/DirtyModal.svelte';
	import RadarrIcon from '$lib/client/assets/Radarr.svg';
	import SonarrIcon from '$lib/client/assets/Sonarr.svg';
	import type { PageData } from './$types';
	import type { ArrType } from '$shared/pcd/types.ts';

	export let data: PageData;

	let selectedArrType: ArrType | null = null;

	const arrTypeOptions: { value: ArrType; label: string; description: string; icon: string }[] = [
		{
			value: 'radarr',
			label: 'Radarr',
			description: 'Movie quality definitions configuration',
			icon: RadarrIcon
		},
		{
			value: 'sonarr',
			label: 'Sonarr',
			description: 'TV series quality definitions configuration',
			icon: SonarrIcon
		}
	];

	$: availableQualities =
		selectedArrType === 'radarr' ? data.radarrQualities : data.sonarrQualities;
</script>

{#if !selectedArrType}
	<div class="grid gap-4 sm:grid-cols-2">
		{#each arrTypeOptions as option}
			<button
				type="button"
				onclick={() => (selectedArrType = option.value)}
				class="flex items-center gap-4 rounded-lg border border-neutral-200 bg-white p-6 text-left transition-colors hover:border-accent-500 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-accent-400"
			>
				<div class="flex h-12 w-12 items-center justify-center">
					<img src={option.icon} alt={option.label} class="h-10 w-10" />
				</div>
				<div>
					<div class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
						{option.label}
					</div>
					<div class="text-sm text-neutral-500 dark:text-neutral-400">
						{option.description}
					</div>
				</div>
			</button>
		{/each}
	</div>
{:else}
	<QualityDefinitionsForm
		mode="create"
		arrType={selectedArrType}
		databaseName={data.currentDatabase?.name}
		canWriteToBase={data.canWriteToBase}
		{availableQualities}
		initialData={null}
	/>
{/if}

<DirtyModal />
