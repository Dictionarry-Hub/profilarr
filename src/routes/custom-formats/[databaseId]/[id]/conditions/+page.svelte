<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { tick } from 'svelte';
	import { Plus, Save, Loader2, Info } from 'lucide-svelte';
	import ConditionCard from './components/ConditionCard.svelte';
	import Badge from '$ui/badge/Badge.svelte';
	import Button from '$ui/button/Button.svelte';
	import StickyCard from '$ui/card/StickyCard.svelte';
	import InfoModal from '$ui/modal/InfoModal.svelte';
	import SyncPromptModal from '$ui/modal/SyncPromptModal.svelte';
	import { alertStore } from '$alerts/store';
	import { sortConditions } from '$shared/pcd/conditions';
	import { current, isDirty, initEdit, update } from '$lib/client/stores/dirty';
	import type { PageData } from './$types';
	import type { ConditionData } from '$shared/pcd/display.ts';
	import type { AffectedArr } from '$shared/sync/types.ts';

	let infoModalOpen = false;
	let showSyncModal = false;
	let pendingRedirectTo = '';
	let pendingAffectedArrs: AffectedArr[] = [];

	$: cfDatabaseId = parseInt($page.params.databaseId ?? '0', 10);

	// Extended type with stable key for Svelte keying
	type KeyedCondition = ConditionData & { _key: string };

	export let data: PageData;

	// Track next key for stable identification
	let nextKey = 0;
	function genKey() {
		return `cond-${nextKey++}`;
	}

	// Build initial data from server, adding stable keys
	$: initialData = {
		conditions: data.conditions.map((c) => ({
			...structuredClone(c),
			_key: genKey()
		})) as KeyedCondition[],
		draftConditions: [] as KeyedCondition[]
	};

	// Initialize dirty tracking
	$: initEdit(initialData);

	// Loading state
	let saving = false;

	// Layer selection
	let selectedLayer: 'user' | 'base' = data.canWriteToBase ? 'base' : 'user';

	let mainFormElement: HTMLFormElement;

	// Reactive getters for current values
	$: conditions = ($current.conditions ?? []) as KeyedCondition[];
	$: draftConditions = ($current.draftConditions ?? []) as KeyedCondition[];

	// Check if there are draft conditions (blocks saving)
	$: hasDrafts = draftConditions.length > 0;

	// Validation - check all conditions have required values
	$: invalidConditions = conditions.filter((c) => !isConditionValid(c));
	$: hasInvalidConditions = invalidConditions.length > 0;

	// Validation - check for duplicate condition names
	$: duplicateNames = (() => {
		const names = conditions.map((c) => c.name.trim().toLowerCase());
		const seen = new Set<string>();
		const dupes = new Set<string>();
		for (const name of names) {
			if (seen.has(name)) dupes.add(name);
			seen.add(name);
		}
		return dupes;
	})();
	$: hasDuplicateNames = duplicateNames.size > 0;
	$: hasMissingArrType = conditions.some((c) => c.arrType === '');
	$: hasInvalidSizeRange = conditions.some((c) => isInvalidSizeRange(c));

	function hasNameConflict(condition: KeyedCondition): boolean {
		return duplicateNames.has(condition.name.trim().toLowerCase());
	}

	function isInvalidSizeRange(condition: ConditionData): boolean {
		return (
			condition.type === 'size' &&
			condition.size?.minBytes != null &&
			condition.size?.maxBytes != null &&
			condition.size.maxBytes <= condition.size.minBytes
		);
	}

	function isConditionValid(condition: ConditionData): boolean {
		switch (condition.type) {
			case 'release_title':
			case 'release_group':
			case 'edition':
				return (condition.patterns?.length ?? 0) > 0;
			case 'language':
				return (condition.languages?.length ?? 0) > 0;
			case 'source':
				return (condition.sources?.length ?? 0) > 0;
			case 'resolution':
				return (condition.resolutions?.length ?? 0) > 0;
			case 'quality_modifier':
				return (condition.qualityModifiers?.length ?? 0) > 0;
			case 'release_type':
				return (condition.releaseTypes?.length ?? 0) > 0;
			case 'indexer_flag':
				return (condition.indexerFlags?.length ?? 0) > 0;
			case 'size':
				// At least one of min or max must be set
				return condition.size?.minBytes != null || condition.size?.maxBytes != null;
			case 'year':
				// At least one of min or max must be set
				return condition.years?.minYear != null || condition.years?.maxYear != null;
			default:
				return true;
		}
	}

	// Sort conditions by status (required -> negated -> optional), then type, then alphabetical
	let sortSnapshot: string[] = [];
	let sortedConditions: KeyedCondition[] = [];

	function orderBySnapshot(items: KeyedCondition[], order: string[]) {
		const map = new Map(items.map((item) => [item._key, item]));
		const ordered: KeyedCondition[] = [];

		for (const key of order) {
			const item = map.get(key);
			if (item) {
				ordered.push(item);
				map.delete(key);
			}
		}

		// Append any new items (e.g., drafts confirmed while dirty)
		for (const item of map.values()) {
			ordered.push(item);
		}

		return ordered;
	}

	$: if (!$isDirty) {
		sortedConditions = sortConditions(conditions);
		sortSnapshot = sortedConditions.map((c) => c._key);
	} else {
		sortedConditions = orderBySnapshot(conditions, sortSnapshot);
	}

	function handleRemove(key: string) {
		update(
			'conditions',
			conditions.filter((c) => c._key !== key)
		);
	}

	function handleConditionChange(updatedCondition: ConditionData, key: string) {
		update(
			'conditions',
			conditions.map((c) => (c._key === key ? { ...updatedCondition, _key: key } : c))
		);
	}

	function addDraftCondition() {
		const draft: KeyedCondition = {
			_key: genKey(),
			name: 'New Condition',
			type: 'release_title',
			arrType: 'all',
			negate: false,
			required: false
		};
		update('draftConditions', [...draftConditions, draft]);
	}

	function handleDraftChange(updatedDraft: ConditionData, key: string) {
		update(
			'draftConditions',
			draftConditions.map((d) => (d._key === key ? { ...updatedDraft, _key: key } : d))
		);
	}

	function confirmDraft(draft: KeyedCondition) {
		// Remove from drafts and add to main conditions
		update(
			'draftConditions',
			draftConditions.filter((d) => d._key !== draft._key)
		);
		update('conditions', [...conditions, draft]);
	}

	function discardDraft(key: string) {
		update(
			'draftConditions',
			draftConditions.filter((d) => d._key !== key)
		);
	}

	$: hasEmptyNames = conditions.some((c) => !c.name.trim());
	$: saveBlocked =
		hasDrafts ||
		hasEmptyNames ||
		hasDuplicateNames ||
		hasInvalidConditions ||
		hasInvalidSizeRange ||
		hasMissingArrType;
	$: saveTooltip = (() => {
		if (hasDrafts) return 'Confirm or discard draft conditions before saving.';
		if (hasEmptyNames) return 'All conditions must have a name.';
		if (hasDuplicateNames) return 'Condition names must be unique.';
		if (hasInvalidConditions) return 'Some conditions are missing required values.';
		if (hasInvalidSizeRange) return 'Max size must be greater than min size.';
		if (hasMissingArrType) return 'Each condition must have at least one Arr type selected.';
		return '';
	})();

	async function handleSaveClick() {
		if (saveBlocked) return;
		selectedLayer = data.canWriteToBase ? 'base' : 'user';
		await tick();
		mainFormElement?.requestSubmit();
	}
</script>

<svelte:head>
	<title>{data.format.name} - Conditions - Profilarr</title>
</svelte:head>

<form
	bind:this={mainFormElement}
	method="POST"
	action="?/update"
	use:enhance={() => {
		saving = true;
		return async ({ result, update: formUpdate }) => {
			if (result.type === 'failure' && result.data) {
				alertStore.add('error', (result.data as { error?: string }).error || 'Operation failed');
			} else if (result.type === 'success' && result.data) {
				const resData = result.data as {
					success?: boolean;
					redirectTo?: string;
					affectedArrs?: AffectedArr[];
				};
				if (resData.success) {
					alertStore.add('success', 'Conditions updated!');
					initEdit($current);
					if (resData.affectedArrs && resData.affectedArrs.length > 0) {
						pendingRedirectTo = resData.redirectTo || '';
						pendingAffectedArrs = resData.affectedArrs;
						showSyncModal = true;
					} else {
						goto(resData.redirectTo || '');
					}
					saving = false;
					return;
				}
			} else if (result.type === 'redirect') {
				alertStore.add('success', 'Conditions updated!');
				initEdit($current);
			}
			await formUpdate();
			saving = false;
		};
	}}
>
	<!-- Hidden fields for form data -->
	<input type="hidden" name="conditions" value={JSON.stringify(conditions)} />
	<input type="hidden" name="layer" value={selectedLayer} />

	<StickyCard position="top">
		<svelte:fragment slot="left">
			<div>
				<h2 class="text-lg font-semibold text-text">Conditions</h2>
				<p class="text-sm text-text-soft">
					Define the conditions that must be met for this custom format to match a release.
				</p>
			</div>
		</svelte:fragment>
		<svelte:fragment slot="right">
			<div class="flex items-center gap-2">
				<Button
					text="Info"
					icon={Info}
					variant="secondary"
					on:click={() => (infoModalOpen = true)}
				/>
				<Button
					text="Add Condition"
					icon={Plus}
					iconColor="text-info-icon "
					variant="secondary"
					onboarding="cf-conditions-add"
					on:click={addDraftCondition}
				/>
				<Button
					text={saving ? 'Saving...' : 'Save'}
					icon={saving ? Loader2 : Save}
					iconColor="text-success-icon "
					variant="secondary"
					disabled={saving || !$isDirty || saveBlocked}
					tooltip={saveTooltip}
					on:click={handleSaveClick}
				/>
			</div>
		</svelte:fragment>
	</StickyCard>

	<div class="mt-6 space-y-6 pb-12">
		<!-- Draft conditions -->
		{#if draftConditions.length > 0}
			<div class="space-y-2">
				<div class="flex items-center gap-2 px-3">
					<span class="text-sm font-medium text-text-soft">Drafts</span>
					<Badge variant="neutral" size="sm">{draftConditions.length}</Badge>
				</div>
				<div class="space-y-2 wide:space-y-0 wide:divide-y wide:divide-border wide:">
					{#each draftConditions as draft (draft._key)}
						<div
							class="rounded-card border border-border bg-surface px-2 py-1.5 wide:rounded-none wide:border-0 wide:bg-transparent wide:px-0 wide:py-0"
						>
							<ConditionCard
								mode="draft"
								condition={draft}
								availablePatterns={data.availablePatterns}
								availableLanguages={data.availableLanguages}
								on:confirm={() => confirmDraft(draft)}
								on:discard={() => discardDraft(draft._key)}
								on:change={(e) => handleDraftChange(e.detail, draft._key)}
							/>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Existing conditions sorted by status, type, then name -->
		{#if conditions.length === 0 && draftConditions.length === 0}
			<p class="px-3 text-sm text-text-muted">No conditions defined</p>
		{:else if conditions.length > 0}
			<div class="space-y-2">
				<div class="flex items-center gap-2 px-3">
					<span class="text-sm font-medium text-text-soft">Conditions</span>
					<Badge variant="neutral" size="sm">{conditions.length}</Badge>
				</div>
				<div class="space-y-2 wide:space-y-0 wide:divide-y wide:divide-border wide:">
					{#each sortedConditions as condition (condition._key)}
						<div
							class="rounded-card border border-border bg-surface px-2 py-1.5 wide:rounded-none wide:border-0 wide:bg-transparent wide:px-0 wide:py-0"
						>
							<ConditionCard
								{condition}
								availablePatterns={data.availablePatterns}
								availableLanguages={data.availableLanguages}
								nameConflict={hasNameConflict(condition)}
								on:remove={() => handleRemove(condition._key)}
								on:change={(e) => handleConditionChange(e.detail, condition._key)}
							/>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</form>

<InfoModal bind:open={infoModalOpen} header="Condition Types">
	<div class="space-y-4 text-sm text-text-soft">
		<section>
			<h3 class="mb-2 font-semibold text-text">How Conditions Work</h3>
			<p>
				Conditions are grouped by type. Between types, logic is <strong>AND</strong> &mdash; every
				type must pass. Within a type, logic is <strong>OR</strong> &mdash; any condition can satisfy
				it. Two modifiers change this:
			</p>
			<ul class="mt-2 list-inside list-disc space-y-1">
				<li>
					<strong>Required</strong> &mdash; Changes the type's logic from OR to AND. All required conditions
					in that type must match.
				</li>
				<li>
					<strong>Negate</strong> &mdash; Inverts the condition so it matches when the pattern is absent.
				</li>
			</ul>
		</section>

		<div class="border-t border-border pt-4">
			<h3 class="mb-3 font-semibold text-text">Types</h3>
			<div class="space-y-3">
				<div>
					<div class="font-medium text-text">Release Title</div>
					<p class="mt-0.5">
						Matches regex patterns against the full release name. Uses reusable patterns managed on
						the Regular Expressions page.
					</p>
				</div>
				<div>
					<div class="font-medium text-text">Release Group</div>
					<p class="mt-0.5">
						Matches regex patterns against the release group name (the tag after the final dash,
						e.g. FraMeSToR).
					</p>
				</div>
				<div>
					<div class="font-medium text-text">Edition</div>
					<p class="mt-0.5">
						Matches regex patterns against the edition field (Director's Cut, Extended, etc.).
						Radarr only.
					</p>
				</div>
				<div>
					<div class="font-medium text-text">Resolution</div>
					<p class="mt-0.5">
						Matches the parsed video resolution (360p, 480p, 576p, 720p, 1080p, 2160p).
					</p>
				</div>
				<div>
					<div class="font-medium text-text">Source</div>
					<p class="mt-0.5">
						Matches the release source &mdash; where the content was captured from (BluRay, WEB-DL,
						WEBRip, DVD, Television, etc.).
					</p>
				</div>
				<div>
					<div class="font-medium text-text">Quality Modifier</div>
					<p class="mt-0.5">
						Matches quality modifiers like REMUX, BRDISK, or Regional. Radarr only.
					</p>
				</div>
				<div>
					<div class="font-medium text-text">Language</div>
					<p class="mt-0.5">Matches the detected audio language of the release.</p>
				</div>
				<div>
					<div class="font-medium text-text">Release Type</div>
					<p class="mt-0.5">
						Matches the type of TV release (Season Pack, Single Episode, etc.). Sonarr only.
					</p>
				</div>
				<div>
					<div class="font-medium text-text">Indexer Flag</div>
					<p class="mt-0.5">
						Matches flags set by the indexer (Freeleech, Halfleech, Internal, etc.).
					</p>
				</div>
				<div>
					<div class="font-medium text-text">Size</div>
					<p class="mt-0.5">
						Matches the file size of the release. Set a minimum, maximum, or both (in GB).
					</p>
				</div>
				<div>
					<div class="font-medium text-text">Year</div>
					<p class="mt-0.5">Matches the release year. Set a minimum, maximum, or both.</p>
				</div>
			</div>
		</div>
	</div>
</InfoModal>

<!-- Sync Prompt Modal -->
<SyncPromptModal
	bind:open={showSyncModal}
	redirectTo={pendingRedirectTo}
	affectedArrs={pendingAffectedArrs}
	entityType="customFormat"
	databaseId={cfDatabaseId}
	entityName={data.formatName}
/>
