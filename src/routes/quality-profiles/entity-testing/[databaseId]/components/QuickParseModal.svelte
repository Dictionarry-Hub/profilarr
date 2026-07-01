<script lang="ts">
	import { browser } from '$app/environment';
	import {
		HardDrive,
		Tag,
		Users,
		Bookmark,
		Earth,
		Layers,
		AlertTriangle,
		X,
		Film,
		Tv
	} from 'lucide-svelte';
	import Modal from '$ui/modal/Modal.svelte';
	import Button from '$ui/button/Button.svelte';
	import FormInput from '$ui/form/FormInput.svelte';
	import DropdownSelect from '$ui/dropdown/DropdownSelect.svelte';
	import Score from '$ui/arr/Score.svelte';
	import CustomFormatBadge from '$ui/arr/CustomFormatBadge.svelte';
	import type { ReleaseEvaluation } from '$shared/pcd/display.ts';

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
	let selectedReleaseType: 'movie' | 'series' = 'movie';
	let loading = false;
	let evaluation: ReleaseEvaluation | null = null;
	let error: string | null = null;
	let selectedArrType: keyof CfScore = 'radarr';
	const RELEASE_TYPE_STORAGE_KEY = 'entityTesting.quickParseReleaseType';

	if (browser) {
		const stored = localStorage.getItem(RELEASE_TYPE_STORAGE_KEY);
		if (stored === 'movie' || stored === 'series') {
			selectedReleaseType = stored;
		}
	}

	$: profileOptions = [
		{ value: '', label: 'No Profile' },
		...qualityProfiles.map((p) => ({ value: String(p.id), label: p.name }))
	];
	$: releaseTypeOptions = [
		{ value: 'movie', label: 'Movie', icon: Film },
		{ value: 'series', label: 'Series', icon: Tv }
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
	$: if (title || selectedReleaseType) {
		clearTimeout(debounceTimer);
		if (title) {
			debounceTimer = setTimeout(() => {
				parse(title, selectedReleaseType);
			}, 400);
		} else {
			evaluation = null;
			error = null;
		}
	}

	$: selectedArrType = selectedReleaseType === 'movie' ? 'radarr' : 'sonarr';
	$: releasePlaceholder =
		selectedReleaseType === 'movie'
			? 'Movie.2024.2160p.UHD.BluRay.REMUX.DV.HDR.DTS-HD.MA.7.1-GROUP'
			: 'Series.S01E01.2160p.WEB-DL.DDP5.1.HDR.H.265-GROUP';

	function setReleaseType(type: string) {
		if (type !== 'movie' && type !== 'series') return;
		if (selectedReleaseType === type) return;
		selectedReleaseType = type;
		if (browser) {
			localStorage.setItem(RELEASE_TYPE_STORAGE_KEY, selectedReleaseType);
		}
		evaluation = null;
		error = null;
	}

	async function parse(value: string, releaseType: 'movie' | 'series') {
		const trimmed = value.trim();
		if (!trimmed || !parserAvailable) return;

		loading = true;
		error = null;

		try {
			const response = await fetch(`/quality-profiles/entity-testing/${databaseId}/evaluate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					releases: [{ id: -1, title: trimmed, type: releaseType }]
				})
			});

			if (!response.ok) {
				throw new Error('Failed to parse release');
			}

			const result = await response.json();
			if (title.trim() !== trimmed || selectedReleaseType !== releaseType) return;
			evaluation = result.evaluations?.[0] ?? null;
		} catch (err) {
			if (title.trim() !== trimmed || selectedReleaseType !== releaseType) return;
			error = err instanceof Error ? err.message : 'Failed to parse release';
		} finally {
			if (title.trim() === trimmed && selectedReleaseType === releaseType) {
				loading = false;
			}
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
				const score = cfScore[selectedArrType];
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
				const score = cfScore[selectedArrType];
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
		<div class="ml-auto flex items-center gap-2">
			<DropdownSelect
				value={selectedReleaseType}
				options={releaseTypeOptions}
				position="right"
				minWidth="8rem"
				on:change={(e) => setReleaseType(e.detail)}
			/>
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
				class="flex items-center gap-2 rounded-card border border-warning-border bg-warning-bg px-3 py-2 text-sm text-warning-text"
			>
				<AlertTriangle size={16} />
				Parser service unavailable. Release parsing is disabled.
			</div>
		{/if}

		<FormInput
			label="Release Title"
			description="Paste a full release title to parse and score"
			bind:value={title}
			placeholder={releasePlaceholder}
			mono
			size="sm"
		/>

		<!-- Results -->
		{#if error}
			<div
				class="rounded-card border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger-text"
			>
				{error}
			</div>
		{/if}

		{#if evaluation}
			<div class="space-y-3 rounded-card border border-border bg-surface-muted p-4">
				<!-- Score -->
				{#if numericProfileId}
					<div class="flex items-center gap-2 text-sm">
						<span class="font-medium text-text-muted">Score</span>
						<Score {score} />
					</div>
				{/if}

				<!-- Parsed Info -->
				{#if evaluation.parsed}
					<div class="space-y-2 text-xs">
						<div class="font-medium text-text-muted">Parsed</div>
						<div class="flex flex-wrap items-center gap-2">
							<span
								class="inline-flex items-center gap-1.5 rounded-card border border-border bg-surface px-2 py-1"
							>
								<HardDrive size={12} class="text-info-icon" />
								<span class="text-text-muted">Source</span>
								<span class="font-medium text-text">{evaluation.parsed.source}</span>
							</span>
							<span
								class="inline-flex items-center gap-1.5 rounded-card border border-border bg-surface px-2 py-1"
							>
								<Layers size={12} class="text-accent-solid" />
								<span class="text-text-muted">Resolution</span>
								<span class="font-medium text-text">{evaluation.parsed.resolution}</span>
							</span>
							{#if evaluation.parsed.modifier !== 'None'}
								<span
									class="inline-flex items-center gap-1.5 rounded-card border border-border bg-surface px-2 py-1"
								>
									<Tag size={12} class="text-warning-icon" />
									<span class="text-text-muted">Modifier</span>
									<span class="font-medium text-text">{evaluation.parsed.modifier}</span>
								</span>
							{/if}
							{#if evaluation.parsed.releaseGroup}
								<span
									class="inline-flex items-center gap-1.5 rounded-card border border-border bg-surface px-2 py-1"
								>
									<Users size={12} class="text-info-icon" />
									<span class="text-text-muted">Group</span>
									<span class="font-medium text-text">{evaluation.parsed.releaseGroup}</span>
								</span>
							{/if}
							{#if evaluation.parsed.edition}
								<span
									class="inline-flex items-center gap-1.5 rounded-card border border-border bg-surface px-2 py-1"
								>
									<Bookmark size={12} class="text-warning-icon" />
									<span class="text-text-muted">Edition</span>
									<span class="font-medium text-text">{evaluation.parsed.edition}</span>
								</span>
							{/if}
							{#if evaluation.parsed.languages.length > 0}
								<span
									class="inline-flex items-center gap-1.5 rounded-card border border-border bg-surface px-2 py-1"
								>
									<Earth size={12} class="text-success-icon" />
									<span class="text-text-muted">Languages</span>
									<span class="font-medium text-text">{evaluation.parsed.languages.join(', ')}</span
									>
									<span class="text-[10px] text-text-subtle"
										>({evaluation.parsed.languageSource})</span
									>
								</span>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Custom Formats -->
				<div class="space-y-2 text-xs">
					<div class="font-medium text-text-muted">Formats</div>
					<div>
						{#if !numericProfileId}
							<span class="text-text-subtle italic">Select a quality profile to see scores.</span>
						{:else if matchingFormats.length === 0}
							<span class="text-text-subtle italic"
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
