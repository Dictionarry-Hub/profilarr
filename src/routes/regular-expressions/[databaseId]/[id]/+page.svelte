<script lang="ts">
	import { goto } from '$app/navigation';
	import RegularExpressionForm from '../components/RegularExpressionForm.svelte';
	import DirtyModal from '$ui/modal/DirtyModal.svelte';
	import Table from '$ui/table/Table.svelte';
	import Badge from '$ui/badge/Badge.svelte';
	import InlineLink from '$ui/link/InlineLink.svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	// Build initial data from server
	$: initialData = {
		name: data.regularExpression.name,
		tags: data.regularExpression.tags.map((t) => t.name),
		pattern: data.regularExpression.pattern,
		description: data.regularExpression.description ?? '',
		regex101Id: data.regularExpression.regex101_id ?? ''
	};

	function handleCancel() {
		goto(`/regular-expressions/${data.currentDatabase.id}`);
	}

	const columns = [
		{ key: 'cfName', header: 'Custom Format' },
		{ key: 'conditionName', header: 'Condition' },
		{ key: 'flags', header: 'Flags', align: 'center' as const }
	];
</script>

<svelte:head>
	<title>{data.regularExpression.name} - Regular Expressions - Profilarr</title>
</svelte:head>

<div class="p-4 md:p-8">
	<RegularExpressionForm
		mode="edit"
		databaseName={data.currentDatabase?.name}
		canWriteToBase={data.canWriteToBase}
		actionUrl="?/update"
		{initialData}
		onCancel={handleCancel}
		breadcrumbItems={[
			{ label: data.currentDatabase.name, href: `/regular-expressions/${data.currentDatabase.id}` }
		]}
		breadcrumbCurrent={data.regularExpression.name}
	/>

	<div data-onboarding="regex-references" class="mt-6 space-y-3 md:px-4">
		<div class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
			References ({data.conditionRefs.length})
		</div>
		{#if data.conditionRefs.length > 0}
			<Table data={data.conditionRefs} {columns} compact responsive>
				<svelte:fragment slot="cell" let:row let:column>
					{#if column.key === 'cfName'}
						<InlineLink
							href="/custom-formats/{data.currentDatabase.id}/{row.cfId}/conditions"
							text={row.cfName}
							external
						/>
					{:else if column.key === 'conditionName'}
						{row.conditionName}
					{:else if column.key === 'flags'}
						<div class="flex items-center justify-center gap-1">
							{#if row.negate}
								<Badge variant="warning" size="sm">Negate</Badge>
							{/if}
							{#if row.required}
								<Badge variant="info" size="sm">Required</Badge>
							{/if}
						</div>
					{/if}
				</svelte:fragment>
			</Table>
		{:else}
			<p class="text-sm text-neutral-500 dark:text-neutral-400">Not used in any custom formats.</p>
		{/if}
	</div>
</div>

<DirtyModal />
