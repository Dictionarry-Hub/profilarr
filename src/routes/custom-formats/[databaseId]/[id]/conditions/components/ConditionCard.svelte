<script lang="ts">
	import { Check, Trash2 } from 'lucide-svelte';
	import { createEventDispatcher } from 'svelte';
	import RadarrIcon from '$lib/client/assets/Radarr.svg';
	import SonarrIcon from '$lib/client/assets/Sonarr.svg';
	import Button from '$ui/button/Button.svelte';
	import FormInput from '$ui/form/FormInput.svelte';
	import NumberInput from '$ui/form/NumberInput.svelte';
	import Toggle from '$ui/toggle/Toggle.svelte';
	import SearchDropdown from '$ui/form/SearchDropdown.svelte';
	import {
		CONDITION_TYPES,
		PATTERN_TYPES,
		SOURCE_VALUES,
		RESOLUTION_VALUES,
		QUALITY_MODIFIER_VALUES,
		RELEASE_TYPE_VALUES,
		INDEXER_FLAG_VALUES
	} from '$shared/pcd/conditions';
	import type { ConditionData } from '$shared/pcd/display.ts';

	const dispatch = createEventDispatcher<{
		remove: void;
		confirm: ConditionData;
		discard: void;
		change: ConditionData;
	}>();

	// Mode: 'normal' for existing conditions, 'draft' for new unsaved conditions
	export let mode: 'normal' | 'draft' = 'normal';
	export let condition: ConditionData;
	export let nameConflict = false;

	// Available patterns and languages from database (passed in)
	export let availablePatterns: { id: number; name: string; pattern: string }[] = [];
	export let availableLanguages: { name: string; radarr: boolean; sonarr: boolean }[] = [];

	// Computed states based on mode
	$: isDraft = mode === 'draft';
	$: rightPaddingClass = 'pr-3';
	$: conditionNameId = `condition-name-${(condition.name || 'untitled')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')}`;
	$: nameError = '';

	// Helper to emit changes - creates new object to maintain immutability
	function emitChange(updates: Partial<ConditionData>) {
		dispatch('change', { ...condition, ...updates });
	}

	$: radarrEnabled = condition.arrType === 'all' || condition.arrType === 'radarr';
	$: sonarrEnabled = condition.arrType === 'all' || condition.arrType === 'sonarr';

	function getArrType(r: boolean, s: boolean): ConditionData['arrType'] {
		if (r && s) return 'all';
		if (r) return 'radarr';
		if (s) return 'sonarr';
		return '';
	}

	function handleArrTypeToggle(target: 'radarr' | 'sonarr', enabled: boolean) {
		const nextRadarr = target === 'radarr' ? enabled : radarrEnabled;
		const nextSonarr = target === 'sonarr' ? enabled : sonarrEnabled;
		emitChange({ arrType: getArrType(nextRadarr, nextSonarr) });
	}

	// All condition types
	$: filteredConditionTypes = [...CONDITION_TYPES];

	// Get value options based on current type
	$: valueOptions = getValueOptions(condition.type);

	function getValueOptions(type: string) {
		switch (type) {
			case 'source':
				return [...SOURCE_VALUES];
			case 'resolution':
				return [...RESOLUTION_VALUES];
			case 'quality_modifier':
				return [...QUALITY_MODIFIER_VALUES];
			case 'release_type':
				return [...RELEASE_TYPE_VALUES];
			case 'indexer_flag':
				return [...INDEXER_FLAG_VALUES];
			default:
				return [];
		}
	}

	// Check if type is pattern-based
	$: isPatternType = PATTERN_TYPES.includes(condition.type as (typeof PATTERN_TYPES)[number]);

	// SearchDropdown options for patterns
	$: patternOptions = availablePatterns.map((p) => ({ value: p.name, label: p.name }));

	function handlePatternChange(value: string) {
		if (!value) {
			emitChange({ patterns: [] });
			return;
		}
		const pattern = availablePatterns.find((p) => p.name === value);
		emitChange({ patterns: pattern ? [{ name: pattern.name, pattern: pattern.pattern }] : [] });
	}

	// Reactive selected value based on condition type
	$: selectedValue = (() => {
		if (isPatternType) {
			return condition.patterns?.[0]?.name ?? '';
		}
		switch (condition.type) {
			case 'source':
				return condition.sources?.[0] ?? '';
			case 'resolution':
				return condition.resolutions?.[0] ?? '';
			case 'quality_modifier':
				return condition.qualityModifiers?.[0] ?? '';
			case 'release_type':
				return condition.releaseTypes?.[0] ?? '';
			case 'indexer_flag':
				return condition.indexerFlags?.[0] ?? '';
			case 'language':
				return condition.languages?.[0]?.name ?? '';
			default:
				return '';
		}
	})();

	// Update value when Select changes
	function handleSelectChange(value: string) {
		switch (condition.type) {
			case 'source':
				emitChange({ sources: value ? [value] : [] });
				break;
			case 'resolution':
				emitChange({ resolutions: value ? [value] : [] });
				break;
			case 'quality_modifier':
				emitChange({ qualityModifiers: value ? [value] : [] });
				break;
			case 'release_type':
				emitChange({ releaseTypes: value ? [value] : [] });
				break;
			case 'indexer_flag':
				emitChange({ indexerFlags: value ? [value] : [] });
				break;
		}
	}

	// Language options for SearchDropdown
	$: languageOptions = availableLanguages.map((l) => ({
		value: l.name,
		label: l.name,
		radarr: l.radarr,
		sonarr: l.sonarr
	}));

	// Language except state
	$: hasLanguage = (condition.languages?.length ?? 0) > 0;
	$: languageExcept = condition.languages?.[0]?.except ?? false;

	function handleLanguageChange(value: string) {
		if (!value) {
			emitChange({ languages: [] });
			return;
		}
		emitChange({ languages: [{ name: value, except: languageExcept }] });
	}

	function handleLanguageExceptChange(enabled: boolean) {
		if (hasLanguage) {
			emitChange({
				languages: [{ ...condition.languages![0], except: enabled }]
			});
		}
	}

	// Handle type change - reset values
	function handleTypeChange(newType: string) {
		emitChange({
			type: newType,
			patterns: undefined,
			languages: undefined,
			sources: undefined,
			resolutions: undefined,
			qualityModifiers: undefined,
			releaseTypes: undefined,
			indexerFlags: undefined,
			size: undefined,
			years: undefined
		});
	}

	// Type options for Select
	$: typeOptions = filteredConditionTypes.map((t) => ({ value: t.value, label: t.label }));

	// Size helpers (convert between bytes and GB for display)
	$: minSizeGB = condition.size?.minBytes
		? condition.size.minBytes / 1024 / 1024 / 1024
		: undefined;
	$: maxSizeGB = condition.size?.maxBytes
		? condition.size.maxBytes / 1024 / 1024 / 1024
		: undefined;

	function handleMinSizeChange(value: number | undefined) {
		const currentSize = condition.size ?? { minBytes: null, maxBytes: null };
		emitChange({
			size: {
				...currentSize,
				minBytes: value == null ? null : Math.round(value * 1024 * 1024 * 1024)
			}
		});
	}

	function handleMaxSizeChange(value: number | undefined) {
		const currentSize = condition.size ?? { minBytes: null, maxBytes: null };
		emitChange({
			size: {
				...currentSize,
				maxBytes: value == null ? null : Math.round(value * 1024 * 1024 * 1024)
			}
		});
	}

	// Year helpers
	$: minYear = condition.years?.minYear ?? undefined;
	$: maxYear = condition.years?.maxYear ?? undefined;

	function handleMinYearChange(value: number | undefined) {
		const currentYears = condition.years ?? { minYear: null, maxYear: null };
		emitChange({
			years: {
				...currentYears,
				minYear: value ?? null
			}
		});
	}

	function handleMaxYearChange(value: number | undefined) {
		const currentYears = condition.years ?? { minYear: null, maxYear: null };
		emitChange({
			years: {
				...currentYears,
				maxYear: value ?? null
			}
		});
	}
</script>

<div
	class="relative flex flex-col gap-3 px-3 py-3 {rightPaddingClass} wide:flex-row wide:items-center"
>
	<!-- Identity -->
	<div
		class="rounded-xl border border-neutral-200 bg-neutral-50/40 p-2 wide:contents wide:border-0 wide:bg-transparent wide:p-0 dark:border-neutral-800 dark:bg-neutral-900/40"
	>
		<div
			class="mb-2 text-[11px] font-medium tracking-wide text-neutral-500 uppercase wide:hidden dark:text-neutral-400"
		>
			Identity
		</div>
		<div class="grid gap-2 wide:contents">
			<div
				class="w-full min-w-0 shrink-0 wide:w-48"
				title={nameConflict ? 'Duplicate condition name' : ''}
				data-onboarding="cf-cond-name"
			>
				<FormInput
					label="Name"
					hideLabel
					name={conditionNameId}
					value={condition.name}
					placeholder="Condition name"
					description={nameError}
					on:input={(e) => emitChange({ name: e.detail })}
				/>
			</div>
			<div class="w-full min-w-0 shrink-0 wide:w-52" data-onboarding="cf-cond-type">
				<SearchDropdown
					options={typeOptions}
					value={condition.type}
					placeholder="Select type..."
					constrainMenuHeight={false}
					on:change={(e) => handleTypeChange(e.detail)}
				/>
			</div>
		</div>
	</div>

	<!-- Value -->
	<div
		class="rounded-xl border border-neutral-200 bg-neutral-50/40 p-2 wide:contents wide:border-0 wide:bg-transparent wide:p-0 dark:border-neutral-800 dark:bg-neutral-900/40"
	>
		<div
			class="mb-2 text-[11px] font-medium tracking-wide text-neutral-500 uppercase wide:hidden dark:text-neutral-400"
		>
			Value
		</div>
		<div class="min-w-0 wide:flex-1" data-onboarding="cf-cond-value">
			{#if isPatternType}
				<SearchDropdown
					options={patternOptions}
					value={selectedValue}
					placeholder="Select pattern..."
					on:change={(e) => handlePatternChange(e.detail)}
				/>
			{:else if condition.type === 'language'}
				<div class="flex flex-col gap-2 wide:flex-row wide:items-center">
					<div class="min-w-0 flex-1">
						<SearchDropdown
							options={languageOptions}
							value={selectedValue}
							placeholder="Select language..."
							on:change={(e) => handleLanguageChange(e.detail)}
						>
							<svelte:fragment slot="item" let:option>
								<span class="flex w-full items-center justify-between">
									<span>{option.label}</span>
									<span class="flex gap-1">
										{#if option.radarr}
											<img src={RadarrIcon} alt="Radarr" class="h-3.5 w-3.5" title="Radarr" />
										{/if}
										{#if option.sonarr}
											<img src={SonarrIcon} alt="Sonarr" class="h-3.5 w-3.5" title="Sonarr" />
										{/if}
									</span>
								</span>
							</svelte:fragment>
						</SearchDropdown>
					</div>
					<Toggle
						checked={languageExcept}
						ariaLabel="Except language"
						label="Except"
						color="red"
						disabled={!hasLanguage}
						on:change={(e) => handleLanguageExceptChange(e.detail)}
					/>
				</div>
			{:else if condition.type === 'size'}
				<div class="flex flex-col gap-2 wide:flex-row wide:items-center">
					<div class="w-full flex-1">
						<NumberInput
							name="minSize"
							value={minSizeGB}
							min={0}
							step={1}
							font="mono"
							responsive
							placeholder="Min GB"
							on:change={(e) => handleMinSizeChange(e.detail)}
						/>
					</div>
					<span class="hidden text-sm text-neutral-500 wide:inline">-</span>
					<div class="w-full flex-1">
						<NumberInput
							name="maxSize"
							value={maxSizeGB}
							min={0}
							step={1}
							font="mono"
							responsive
							placeholder="Max GB"
							on:change={(e) => handleMaxSizeChange(e.detail)}
						/>
					</div>
				</div>
			{:else if condition.type === 'year'}
				<div class="flex flex-col gap-2 wide:flex-row wide:items-center">
					<div class="w-full flex-1">
						<NumberInput
							name="minYear"
							value={minYear}
							min={1900}
							max={2100}
							step={1}
							font="mono"
							responsive
							placeholder="Min Year"
							on:change={(e) => handleMinYearChange(e.detail)}
						/>
					</div>
					<span class="hidden text-sm text-neutral-500 wide:inline">-</span>
					<div class="w-full flex-1">
						<NumberInput
							name="maxYear"
							value={maxYear}
							min={1900}
							max={2100}
							step={1}
							font="mono"
							responsive
							placeholder="Max Year"
							on:change={(e) => handleMaxYearChange(e.detail)}
						/>
					</div>
				</div>
			{:else}
				<SearchDropdown
					options={valueOptions}
					value={selectedValue}
					placeholder="Select value..."
					constrainMenuHeight={false}
					on:change={(e) => handleSelectChange(e.detail)}
				/>
			{/if}
		</div>
	</div>

	<!-- Flags -->
	<div
		class="rounded-xl border border-neutral-200 bg-neutral-50/40 p-2 wide:contents wide:border-0 wide:bg-transparent wide:p-0 dark:border-neutral-800 dark:bg-neutral-900/40"
	>
		<div
			class="mb-2 text-[11px] font-medium tracking-wide text-neutral-500 uppercase wide:hidden dark:text-neutral-400"
		>
			Flags
		</div>
		<div
			class="grid grid-cols-1 gap-2 wide:ml-auto wide:flex wide:shrink-0 wide:flex-wrap wide:items-center wide:gap-2 md:grid-cols-2"
		>
			<div
				class="grid grid-cols-2 gap-2 wide:flex wide:flex-wrap wide:items-center wide:gap-2"
				data-onboarding="cf-cond-flags-modifiers"
			>
				<Toggle
					checked={condition.negate}
					ariaLabel="Negate"
					label="Negate"
					color="red"
					on:change={(e) => emitChange({ negate: e.detail })}
				/>
				<Toggle
					checked={condition.required}
					ariaLabel="Required"
					label="Required"
					color="green"
					on:change={(e) => emitChange({ required: e.detail })}
				/>
			</div>
			<div
				class="grid grid-cols-2 gap-2 wide:flex wide:flex-wrap wide:items-center wide:gap-2"
				data-onboarding="cf-cond-flags-arr"
			>
				<Toggle
					checked={radarrEnabled}
					ariaLabel="Radarr"
					label="Radarr"
					checkboxColor="var(--arr-radarr-color)"
					on:change={(e) => handleArrTypeToggle('radarr', e.detail)}
				/>
				<Toggle
					checked={sonarrEnabled}
					ariaLabel="Sonarr"
					label="Sonarr"
					checkboxColor="var(--arr-sonarr-color)"
					on:change={(e) => handleArrTypeToggle('sonarr', e.detail)}
				/>
			</div>
		</div>
	</div>

	<!-- Actions -->
	<div
		class="rounded-xl border border-neutral-200 bg-neutral-50/40 p-2 wide:contents wide:border-0 wide:bg-transparent wide:p-0 dark:border-neutral-800 dark:bg-neutral-900/40"
	>
		<div
			class="mb-2 text-[11px] font-medium tracking-wide text-neutral-500 uppercase wide:hidden dark:text-neutral-400"
		>
			Actions
		</div>
		{#if isDraft}
			<div class="grid grid-cols-2 gap-2 wide:flex wide:flex-wrap wide:items-center wide:gap-2">
				<Button
					text="Discard"
					icon={Trash2}
					iconColor="text-red-600 dark:text-red-400"
					variant="secondary"
					title="Discard condition"
					ariaLabel="Discard condition"
					on:click={() => dispatch('discard')}
				/>
				<Button
					text="Accept"
					icon={Check}
					iconColor="text-green-600 dark:text-green-400"
					variant="secondary"
					title="Confirm condition"
					ariaLabel="Confirm condition"
					on:click={() => dispatch('confirm', condition)}
				/>
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-2 wide:flex wide:flex-wrap wide:items-center wide:gap-2">
				<Button
					text="Remove"
					icon={Trash2}
					iconColor="text-red-600 dark:text-red-400"
					variant="secondary"
					title="Remove condition"
					ariaLabel="Remove condition"
					on:click={() => dispatch('remove')}
				/>
			</div>
		{/if}
	</div>
</div>
