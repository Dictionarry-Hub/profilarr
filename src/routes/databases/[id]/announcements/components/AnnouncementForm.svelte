<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { Save, Trash2, Loader2 } from '@lucide/svelte';
	import { alertStore } from '$alerts/store';
	import { isDirty, initEdit, initCreate, update, current, clear } from '$lib/client/stores/dirty';
	import type { AnnouncementSeverity } from '$announcements/database/types.ts';
	import FormInput from '$ui/form/FormInput.svelte';
	import DropdownSelect from '$ui/dropdown/DropdownSelect.svelte';
	import DateInput from '$ui/form/DateInput.svelte';
	import MarkdownInput from '$ui/form/MarkdownInput.svelte';
	import Button from '$ui/button/Button.svelte';
	import StickyCard from '$ui/card/StickyCard.svelte';
	import DirtyModal from '$ui/modal/DirtyModal.svelte';
	import WithdrawAnnouncementModal from './WithdrawAnnouncementModal.svelte';

	export let mode: 'create' | 'edit';
	export let databaseId: number = 0;
	export let initial: {
		id?: string;
		title: string;
		severity: AnnouncementSeverity;
		publishedAt: string;
		expiresAt: string | null;
		link: string;
		body: string;
	};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export let form: any = undefined;

	const severityOptions = [
		{ value: 'info', label: 'Info' },
		{ value: 'warning', label: 'Warning' },
		{ value: 'critical', label: 'Critical' }
	];

	function splitIso(iso: string | null): { date: string; time: string } {
		if (!iso) return { date: '', time: '' };
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return { date: '', time: '' };
		const yyyy = d.getUTCFullYear();
		const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
		const dd = String(d.getUTCDate()).padStart(2, '0');
		const hh = String(d.getUTCHours()).padStart(2, '0');
		const min = String(d.getUTCMinutes()).padStart(2, '0');
		return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` };
	}

	function combineIso(date: string, time: string): string | null {
		if (!date) return null;
		const t = time || '00:00';
		const d = new Date(`${date}T${t}:00.000Z`);
		if (Number.isNaN(d.getTime())) return null;
		return d.toISOString();
	}

	function oneYearFromNowIso(): string {
		const d = new Date();
		d.setUTCFullYear(d.getUTCFullYear() + 1);
		return d.toISOString();
	}

	const initialPub = splitIso(initial.publishedAt);
	const initialExp = splitIso(initial.expiresAt ?? oneYearFromNowIso());

	onMount(() => {
		const snapshot = {
			title: initial.title,
			severity: initial.severity,
			publishedDate: initialPub.date,
			publishedTime: initialPub.time,
			expiresDate: initialExp.date,
			expiresTime: initialExp.time,
			link: initial.link,
			body: initial.body
		};
		if (mode === 'edit') initEdit(snapshot);
		else initCreate(snapshot);
		return () => clear();
	});

	$: title = ($current.title ?? '') as string;
	$: severity = ($current.severity ?? 'info') as AnnouncementSeverity;
	$: publishedDate = ($current.publishedDate ?? '') as string;
	$: publishedTime = ($current.publishedTime ?? '') as string;
	$: expiresDate = ($current.expiresDate ?? '') as string;
	$: expiresTime = ($current.expiresTime ?? '') as string;
	$: link = ($current.link ?? '') as string;
	$: body = ($current.body ?? '') as string;

	$: publishedIso = combineIso(publishedDate, publishedTime);
	$: expiresIso = combineIso(expiresDate, expiresTime);

	$: canSubmit =
		$isDirty && !!title.trim() && !!body.trim() && publishedIso !== null && expiresIso !== null;

	let saving = false;
	let showDeleteModal = false;
	let withdrawing = false;

	function onSubmitClick() {
		const f = document.getElementById('announcement-save-form');
		if (f instanceof HTMLFormElement) f.requestSubmit();
	}

	type ActionPayload = { success?: boolean; message?: string; error?: string } | undefined;

	$: void form;
</script>

<DirtyModal />

<div class="space-y-5">
	<StickyCard position="top">
		<svelte:fragment slot="left">
			<h1 class="text-neutral-900 dark:text-neutral-50">
				{mode === 'create' ? 'New announcement' : 'Edit announcement'}
			</h1>
			<p class="text-neutral-600 dark:text-neutral-400">
				{mode === 'create'
					? 'Publish a message that linked instances of this database will see in their inbox.'
					: 'Edit, save, or withdraw this announcement.'}
			</p>
		</svelte:fragment>
		<svelte:fragment slot="right">
			{#if mode === 'edit'}
				<Button
					text="Withdraw"
					icon={Trash2}
					variant="secondary"
					iconColor="text-red-600 dark:text-red-400"
					loading={withdrawing}
					disabled={withdrawing || saving}
					on:click={() => (showDeleteModal = true)}
				/>
			{/if}
			<Button
				text={saving ? 'Saving...' : 'Save'}
				icon={saving ? Loader2 : Save}
				iconColor="text-blue-600 dark:text-blue-400"
				disabled={!canSubmit || saving || withdrawing}
				on:click={onSubmitClick}
			/>
		</svelte:fragment>
	</StickyCard>

	<form
		id="announcement-save-form"
		method="POST"
		action="?/save"
		use:enhance={() => {
			saving = true;
			return async ({ result, update: applyUpdate }) => {
				if (result.type === 'redirect') {
					// Snapshot the submitted state instead of zeroing the
					// store. clear() makes $current = {}, which propagates
					// value='' into the DateInputs; their self-init block
					// (DateInput.svelte) then dispatches today's date back
					// into the store before applyUpdate's goto() runs,
					// re-dirtying right as beforeNavigate reads $isDirty.
					initEdit($current);
					alertStore.add(
						'success',
						mode === 'create' ? 'Announcement created' : 'Announcement saved'
					);
				} else if (result.type === 'success') {
					// Validation/write failures from either action come back
					// as { success: false, error } rather than a fail() — surface
					// the error and stay on the page.
					const data = result.data as ActionPayload;
					if (data?.error) alertStore.add('error', data.error);
				} else if (result.type === 'failure') {
					const data = result.data as ActionPayload;
					alertStore.add('error', data?.error ?? 'Failed to save');
				}
				await applyUpdate({ reset: false });
				saving = false;
			};
		}}
	>
		<input type="hidden" name="title" value={title} />
		<input type="hidden" name="severity" value={severity} />
		<input type="hidden" name="publishedAt" value={publishedIso ?? ''} />
		<input type="hidden" name="expiresAt" value={expiresIso ?? ''} />
		<input type="hidden" name="link" value={link} />
		<input type="hidden" name="body" value={body} />

		<div
			class="space-y-5 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
		>
			<div class="grid gap-4 md:grid-cols-10">
				<div class="md:col-span-9">
					<FormInput
						label="Title"
						required
						value={title}
						placeholder="Migration to v2"
						on:input={(e) => update('title', e.detail)}
					/>
				</div>
				<div class="space-y-2 md:col-span-1">
					<span class="block text-sm font-medium text-neutral-900 dark:text-neutral-100">
						Severity<span class="text-red-500">*</span>
					</span>
					<DropdownSelect
						value={severity}
						options={severityOptions}
						fullWidth
						on:change={(e) => update('severity', e.detail)}
					/>
				</div>
			</div>

			<div class="grid gap-4 md:flex md:items-start">
				<div class="min-w-0 space-y-2">
					<span class="block text-sm font-medium text-neutral-900 dark:text-neutral-100">
						Published<span class="text-red-500">*</span>
					</span>
					<DateInput
						label="Published date"
						hideLabel
						value={publishedDate}
						on:change={(e) => update('publishedDate', e.detail)}
					/>
				</div>

				<div class="min-w-0 space-y-2">
					<span class="block text-sm font-medium text-neutral-900 dark:text-neutral-100">
						Expires<span class="text-red-500">*</span>
					</span>
					<DateInput
						label="Expires date"
						hideLabel
						value={expiresDate}
						on:change={(e) => update('expiresDate', e.detail)}
					/>
				</div>
			</div>

			<FormInput
				label="Link"
				value={link}
				type="url"
				description="Optional external URL surfaced as 'Read more' on the announcements page."
				on:input={(e) => update('link', e.detail)}
			/>

			<MarkdownInput
				label="Body"
				required
				value={body}
				description="Markdown supported."
				onchange={(next) => update('body', next)}
			/>
		</div>
	</form>
</div>

{#if mode === 'edit'}
	<WithdrawAnnouncementModal
		open={showDeleteModal}
		{databaseId}
		announcementId={initial.id ?? null}
		bind:withdrawing
		on:cancel={() => (showDeleteModal = false)}
		on:withdrawn={() => {
			// Snapshot dirty state before the modal's enhance triggers
			// the redirect's beforeNavigate. Same rationale as the save
			// handler above: clear() would let DateInputs re-dispatch
			// today's date and re-dirty the store mid-navigation.
			initEdit($current);
			showDeleteModal = false;
		}}
	/>
{/if}
