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

	function hasNameConflict(condition: KeyedCondition): boolean {
		return duplicateNames.has(condition.name.trim().toLowerCase());
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

	async function handleSaveClick() {
		if (hasDrafts) {
			alertStore.add('warning', 'Confirm or discard draft conditions before saving.');
			return;
		}
		if (hasEmptyNames) {
			alertStore.add('warning', 'All conditions must have a name.');
			return;
		}
		if (hasDuplicateNames) {
			alertStore.add('warning', 'Condition names must be unique.');
			return;
		}
		if (hasInvalidConditions) {
			alertStore.add('warning', 'Some conditions are missing required values.');
			return;
		}
		if (hasMissingArrType) {
			alertStore.add('warning', 'Each condition must have at least one Arr type selected.');
			return;
		}
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
				<h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Conditions</h2>
				<p class="text-sm text-neutral-600 dark:text-neutral-400">
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
					iconColor="text-blue-600 dark:text-blue-400"
					variant="secondary"
					on:click={addDraftCondition}
				/>
				<Button
					text={saving ? 'Saving...' : 'Save'}
					icon={saving ? Loader2 : Save}
					iconColor="text-green-600 dark:text-green-400"
					variant="secondary"
					disabled={saving || !$isDirty}
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
					<span class="text-sm font-medium text-neutral-600 dark:text-neutral-400">Drafts</span>
					<Badge variant="neutral" size="sm">{draftConditions.length}</Badge>
				</div>
				<div
					class="space-y-2 wide:space-y-0 wide:divide-y wide:divide-neutral-200 wide:dark:divide-neutral-800"
				>
					{#each draftConditions as draft (draft._key)}
						<div
							class="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 wide:rounded-none wide:border-0 wide:bg-transparent wide:px-0 wide:py-0 dark:border-neutral-800 dark:bg-neutral-900"
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
			<p class="px-3 text-sm text-neutral-500 dark:text-neutral-400">No conditions defined</p>
		{:else if conditions.length > 0}
			<div class="space-y-2">
				<div class="flex items-center gap-2 px-3">
					<span class="text-sm font-medium text-neutral-600 dark:text-neutral-400">Conditions</span>
					<Badge variant="neutral" size="sm">{conditions.length}</Badge>
				</div>
				<div
					class="space-y-2 wide:space-y-0 wide:divide-y wide:divide-neutral-200 wide:dark:divide-neutral-800"
				>
					{#each sortedConditions as condition (condition._key)}
						<div
							class="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 wide:rounded-none wide:border-0 wide:bg-transparent wide:px-0 wide:py-0 dark:border-neutral-800 dark:bg-neutral-900"
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
	<div class="space-y-4 text-sm text-neutral-700 dark:text-neutral-300">
		<section>
			<h3 class="mb-2 font-semibold text-neutral-900 dark:text-neutral-100">How Conditions Work</h3>
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

		<div class="border-t border-neutral-200 pt-4 dark:border-neutral-700">
			<h3 class="mb-3 font-semibold text-neutral-900 dark:text-neutral-100">Types</h3>
			<div class="space-y-3">
				<div>
					<div class="font-medium text-neutral-800 dark:text-neutral-200">Release Title</div>
					<p class="mt-0.5">
						Matches regex patterns against the full release name. Uses reusable patterns managed on
						the Regular Expressions page.
					</p>
				</div>
				<div>
					<div class="font-medium text-neutral-800 dark:text-neutral-200">Release Group</div>
					<p class="mt-0.5">
						Matches regex patterns against the release group name (the tag after the final dash,
						e.g. FraMeSToR).
					</p>
				</div>
				<div>
					<div class="font-medium text-neutral-800 dark:text-neutral-200">Edition</div>
					<p class="mt-0.5">
						Matches regex patterns against the edition field (Director's Cut, Extended, etc.).
						Radarr only.
					</p>
				</div>
				<div>
					<div class="font-medium text-neutral-800 dark:text-neutral-200">Resolution</div>
					<p class="mt-0.5">
						Matches the parsed video resolution (360p, 480p, 576p, 720p, 1080p, 2160p).
					</p>
				</div>
				<div>
					<div class="font-medium text-neutral-800 dark:text-neutral-200">Source</div>
					<p class="mt-0.5">
						Matches the release source &mdash; where the content was captured from (BluRay, WEB-DL,
						WEBRip, DVD, Television, etc.).
					</p>
				</div>
				<div>
					<div class="font-medium text-neutral-800 dark:text-neutral-200">Quality Modifier</div>
					<p class="mt-0.5">
						Matches quality modifiers like REMUX, BRDISK, or Regional. Radarr only.
					</p>
				</div>
				<div>
					<div class="font-medium text-neutral-800 dark:text-neutral-200">Language</div>
					<p class="mt-0.5">Matches the detected audio language of the release.</p>
				</div>
				<div>
					<div class="font-medium text-neutral-800 dark:text-neutral-200">Release Type</div>
					<p class="mt-0.5">
						Matches the type of TV release (Season Pack, Single Episode, etc.). Sonarr only.
					</p>
				</div>
				<div>
					<div class="font-medium text-neutral-800 dark:text-neutral-200">Indexer Flag</div>
					<p class="mt-0.5">
						Matches flags set by the indexer (Freeleech, Halfleech, Internal, etc.).
					</p>
				</div>
				<div>
					<div class="font-medium text-neutral-800 dark:text-neutral-200">Size</div>
					<p class="mt-0.5">
						Matches the file size of the release. Set a minimum, maximum, or both (in GB).
					</p>
				</div>
				<div>
					<div class="font-medium text-neutral-800 dark:text-neutral-200">Year</div>
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
