<script lang="ts">
	import { HardDrive, Tag, Users, Bookmark, Earth, Layers, AlertTriangle, X } from 'lucide-svelte';
	import Modal from '$ui/modal/Modal.svelte';
	import Button from '$ui/button/Button.svelte';
	import FormInput from '$ui/form/FormInput.svelte';
	import DropdownSelect from '$ui/dropdown/DropdownSelect.svelte';
	import Score from '$ui/arr/Score.svelte';
	import CustomFormatBadge from '$ui/arr/CustomFormatBadge.svelte';
	import type { components } from '$api/v1.d.ts';

	type ReleaseEvaluation = components['schemas']['ReleaseEvaluation'];

	interface CfScore {
		radarr: number | null;
		sonarr: number | null;
	}

	interface ProfileCfScores {
		profileName: string;
		scores: Record<string, CfScore>;
	}

	interface CustomFormatInfo {
		name: string;
	}

	export let open = false;
	export let databaseId: number;
	export let qualityProfiles: Array<{ id: number; name: string }>;
	export let cfScoresData: { customFormats: CustomFormatInfo[]; profiles: ProfileCfScores[] };
	export let parserAvailable: boolean;

	let title = '';
	let selectedProfileId: string = '';
	let loading = false;
	let evaluation: ReleaseEvaluation | null = null;
	let error: string | null = null;

	$: profileOptions = [
		{ value: '', label: 'No Profile' },
		...qualityProfiles.map((p) => ({ value: String(p.id), label: p.name }))
	];

	let debounceTimer: ReturnType<typeof setTimeout>;

	// Reset state when modal opens
	$: if (open) {
		title = '';
		selectedProfileId = '';
		evaluation = null;
		error = null;
	}

	// Auto-parse on title change with debounce
	$: if (title) {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			parse(title);
		}, 400);
	} else {
		evaluation = null;
		error = null;
	}

	async function parse(value: string) {
		const trimmed = value.trim();
		if (!trimmed || !parserAvailable) return;

		loading = true;
		error = null;

		try {
			const response = await fetch('/api/v1/entity-testing/evaluate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					databaseId,
					releases: [{ id: -1, title: trimmed, type: 'movie' }]
				})
			});

			if (!response.ok) {
				throw new Error('Failed to parse release');
			}

			const result = await response.json();
			evaluation = result.evaluations?.[0] ?? null;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to parse release';
		} finally {
			loading = false;
		}
	}

	$: numericProfileId = selectedProfileId ? parseInt(selectedProfileId, 10) : null;

	// Score calculation
	function calculateScore(): number | null {
		if (!numericProfileId || !evaluation?.cfMatches) return null;

		const profile = qualityProfiles.find((p) => p.id === numericProfileId);
		if (!profile) return null;

		const profileScores = cfScoresData.profiles.find((p) => p.profileName === profile.name);
		if (!profileScores) return null;

		let totalScore = 0;

		for (const [cfName, matched] of Object.entries(evaluation.cfMatches)) {
			if (!matched) continue;
			const cfScore = profileScores.scores[cfName];
			if (cfScore) {
				const score = cfScore.radarr;
				if (score !== null) {
					totalScore += score;
				}
			}
		}

		return totalScore;
	}

	// Get matching CFs with non-zero scores
	function getMatchingFormats(): Array<{ name: string; score: number }> {
		if (!evaluation?.cfMatches || !numericProfileId) return [];

		const profile = qualityProfiles.find((p) => p.id === numericProfileId);
		if (!profile) return [];

		const profileScores = cfScoresData.profiles.find((p) => p.profileName === profile.name);
		if (!profileScores) return [];

		const matches: Array<{ name: string; score: number }> = [];

		for (const [cfName, matched] of Object.entries(evaluation.cfMatches)) {
			if (!matched) continue;
			const cfScore = profileScores.scores[cfName];
			if (cfScore) {
				const score = cfScore.radarr;
				if (score !== null && score !== 0) {
					matches.push({ name: cfName, score });
				}
			}
		}

		return matches.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
	}

	$: score = evaluation ? calculateScore() : null;
	$: matchingFormats = evaluation ? getMatchingFormats() : [];

	// Recalculate when profile changes
	$: if (selectedProfileId !== undefined) {
		score = evaluation ? calculateScore() : null;
		matchingFormats = evaluation ? getMatchingFormats() : [];
	}
</script>

<Modal bind:open header="Quick Parse" size="xl" on:cancel={() => (open = false)}>
	<svelte:fragment slot="header-extra">
		<div class="ml-auto">
			<DropdownSelect
				value={selectedProfileId}
				options={profileOptions}
				placeholder="No Profile"
				position="right"
				minWidth="16rem"
				on:change={(e) => (selectedProfileId = e.detail)}
			/>
		</div>
	</svelte:fragment>

	<div slot="body" class="space-y-4">
		{#if !parserAvailable}
			<div
				class="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-400"
			>
				<AlertTriangle size={16} />
				Parser service unavailable. Release parsing is disabled.
			</div>
		{/if}

		<FormInput
			label="Release Title"
			description="Paste a full release title to parse and score"
			bind:value={title}
			placeholder="Movie.2024.2160p.UHD.BluRay.REMUX.DV.HDR.DTS-HD.MA.7.1-GROUP"
			mono
			size="sm"
		/>

		<!-- Results -->
		{#if error}
			<div
				class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-400"
			>
				{error}
			</div>
		{/if}

		{#if evaluation}
			<div
				class="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50"
			>
				<!-- Score -->
				{#if numericProfileId}
					<div class="flex items-center gap-2 text-sm">
						<span class="font-medium text-neutral-500 dark:text-neutral-400">Score</span>
						<Score {score} />
					</div>
				{/if}

				<!-- Parsed Info -->
				{#if evaluation.parsed}
					<div class="space-y-2 text-xs">
						<div class="font-medium text-neutral-500 dark:text-neutral-400">Parsed</div>
						<div class="flex flex-wrap items-center gap-2">
							<span
								class="inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-700/60 dark:bg-neutral-800/50"
							>
								<HardDrive size={12} class="text-blue-500" />
								<span class="text-neutral-500 dark:text-neutral-400">Source</span>
								<span class="font-medium text-neutral-800 dark:text-neutral-100"
									>{evaluation.parsed.source}</span
								>
							</span>
							<span
								class="inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-700/60 dark:bg-neutral-800/50"
							>
								<Layers size={12} class="text-indigo-500" />
								<span class="text-neutral-500 dark:text-neutral-400">Resolution</span>
								<span class="font-medium text-neutral-800 dark:text-neutral-100"
									>{evaluation.parsed.resolution}</span
								>
							</span>
							{#if evaluation.parsed.modifier !== 'None'}
								<span
									class="inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-700/60 dark:bg-neutral-800/50"
								>
									<Tag size={12} class="text-amber-500" />
									<span class="text-neutral-500 dark:text-neutral-400">Modifier</span>
									<span class="font-medium text-neutral-800 dark:text-neutral-100"
										>{evaluation.parsed.modifier}</span
									>
								</span>
							{/if}
							{#if evaluation.parsed.releaseGroup}
								<span
									class="inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-700/60 dark:bg-neutral-800/50"
								>
									<Users size={12} class="text-teal-500" />
									<span class="text-neutral-500 dark:text-neutral-400">Group</span>
									<span class="font-medium text-neutral-800 dark:text-neutral-100"
										>{evaluation.parsed.releaseGroup}</span
									>
								</span>
							{/if}
							{#if evaluation.parsed.edition}
								<span
									class="inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-700/60 dark:bg-neutral-800/50"
								>
									<Bookmark size={12} class="text-orange-500" />
									<span class="text-neutral-500 dark:text-neutral-400">Edition</span>
									<span class="font-medium text-neutral-800 dark:text-neutral-100"
										>{evaluation.parsed.edition}</span
									>
								</span>
							{/if}
							{#if evaluation.parsed.languages.length > 0}
								<span
									class="inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-700/60 dark:bg-neutral-800/50"
								>
									<Earth size={12} class="text-emerald-500" />
									<span class="text-neutral-500 dark:text-neutral-400">Languages</span>
									<span class="font-medium text-neutral-800 dark:text-neutral-100"
										>{evaluation.parsed.languages.join(', ')}</span
									>
									<span class="text-[10px] text-neutral-400 dark:text-neutral-500"
										>({evaluation.parsed.languageSource})</span
									>
								</span>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Custom Formats -->
				<div class="space-y-2 text-xs">
					<div class="font-medium text-neutral-500 dark:text-neutral-400">Formats</div>
					<div>
						{#if !numericProfileId}
							<span class="text-neutral-400 italic">Select a quality profile to see scores.</span>
						{:else if matchingFormats.length === 0}
							<span class="text-neutral-400 italic"
								>No custom formats matched with non-zero scores.</span
							>
						{:else}
							<div class="flex flex-wrap gap-2">
								{#each matchingFormats as cf}
									<CustomFormatBadge name={cf.name} score={cf.score} />
								{/each}
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	</div>

	<svelte:fragment slot="footer">
		<div></div>
		<Button text="Close" icon={X} on:click={() => (open = false)} />
	</svelte:fragment>
</Modal>
