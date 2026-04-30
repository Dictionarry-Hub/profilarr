<script lang="ts">
	import { Plus, X, FolderPlus } from 'lucide-svelte';
	import { createEventDispatcher } from 'svelte';
	import {
		getFilterFields,
		getFilterField,
		createEmptyGroup,
		createEmptyRule,
		isRule,
		isGroup,
		type DynamicFilterOptions,
		type FilterGroup,
		type FilterRule,
		type UpgradeAppType
	} from '$shared/upgrades/filters';
	import Card from '$ui/card/Card.svelte';
	import FormInput from '$ui/form/FormInput.svelte';
	import NumberInput from '$ui/form/NumberInput.svelte';
	import DateInput from '$ui/form/DateInput.svelte';
	import Button from '$ui/button/Button.svelte';
	import DropdownSelect from '$ui/dropdown/DropdownSelect.svelte';
	import DropdownCombobox from '$ui/dropdown/DropdownCombobox.svelte';

	export let group: FilterGroup;
	export let appType: UpgradeAppType = 'radarr';
	export let dynamicFilterOptions: DynamicFilterOptions = {};
	export let dynamicFilterOptionsLoading: boolean = false;
	export let dynamicFilterOptionsVersion: number = 0;
	export let onRemove: (() => void) | null = null;
	export let depth: number = 0;

	$: fields = getFilterFields(appType);
	const dynamicStringOperators = [
		{ value: 'eq', label: 'is' },
		{ value: 'neq', label: 'is not' }
	];
	let normalizedRulesSignature = '';

	const dispatch = createEventDispatcher<{ change: void }>();

	function notifyChange() {
		group = group;
		dispatch('change');
	}

	function addRule() {
		group.children = [...group.children, createEmptyRule(appType)];
		notifyChange();
	}

	function addNestedGroup() {
		const newGroup = createEmptyGroup();
		newGroup.children.push(createEmptyRule(appType));
		group.children = [...group.children, newGroup];
		notifyChange();
	}

	function removeChild(index: number) {
		group.children = group.children.filter((_, i) => i !== index);
		notifyChange();
	}

	function onFieldChange(rule: FilterRule, fieldId: string) {
		const field = getFilterField(fieldId, appType);
		if (field) {
			rule.field = fieldId;
			rule.operator = fieldId in dynamicFilterOptions ? 'eq' : field.operators[0].id;
			rule.value = field.values?.[0]?.value ?? null;
			notifyChange();
		}
	}

	function getDynamicOptions(
		fieldId: string,
		value: unknown,
		optionsByField: DynamicFilterOptions
	) {
		const options = optionsByField[fieldId] ?? [];
		const currentValue = typeof value === 'string' ? value.trim() : '';

		if (!currentValue || options.some((option) => option.value === currentValue)) {
			return options;
		}

		return [{ value: currentValue, label: currentValue }, ...options];
	}

	function normalizeDynamicOperators(targetGroup: FilterGroup): boolean {
		let changed = false;
		for (const child of targetGroup.children) {
			if (isRule(child)) {
				if (
					child.field in dynamicFilterOptions &&
					child.operator !== 'eq' &&
					child.operator !== 'neq'
				) {
					child.operator = 'eq';
					changed = true;
				}
				continue;
			}

			if (normalizeDynamicOperators(child)) {
				changed = true;
			}
		}
		return changed;
	}

	$: {
		const nextSignature = JSON.stringify({
			dynamicFields: Object.keys(dynamicFilterOptions).sort(),
			group
		});
		if (nextSignature !== normalizedRulesSignature) {
			if (normalizeDynamicOperators(group)) {
				notifyChange();
			}
			normalizedRulesSignature = JSON.stringify({
				dynamicFields: Object.keys(dynamicFilterOptions).sort(),
				group
			});
		}
	}

	function handleNestedChange() {
		notifyChange();
	}

	const keyWidthClass = 'w-fit md:w-48';
	const operatorWidthClass = 'w-fit md:w-40';
	const valueWidthClass = 'w-fit md:w-72';
	const keyMinWidth = '0';
	const valueMinWidth = '0';
</script>

<Card padding="none" flush={depth === 0} className="!border-0">
	<!-- Group Header -->
	<div class="mb-3 flex items-center justify-between">
		<div class="flex items-center gap-2">
			<span class="text-xs font-medium text-neutral-700 dark:text-neutral-300">Match</span>
			<DropdownSelect
				value={group.match}
				options={[
					{ value: 'all', label: 'All (AND)' },
					{ value: 'any', label: 'Any (OR)' }
				]}
				minWidth="7rem"
				responsiveButton
				compactDropdownThreshold={7}
				fixed
				on:change={(e) => {
					group.match = e.detail as 'all' | 'any';
					notifyChange();
				}}
			/>
			<span class="text-xs text-neutral-500 dark:text-neutral-400">of the following rules</span>
		</div>
		{#if onRemove}
			<Button icon={X} variant="ghost" size="xs" on:click={onRemove} />
		{/if}
	</div>

	<!-- Children (Rules and Nested Groups) -->
	{#if group.children.length === 0}
		<div class="text-sm text-neutral-500 dark:text-neutral-400">
			No rules configured. Add a rule to start filtering.
		</div>
	{:else}
		<div class="overflow-x-auto pb-3">
			<div class="space-y-2 min-w-max">
			{#each group.children as child, childIndex}
				{#if isRule(child)}
					{@const field = getFilterField(child.field, appType)}
					{@const isDynamicField = child.field in dynamicFilterOptions}
					<div
						class="rule-row flex items-center gap-1.5 md:gap-2"
					>
						<!-- Field -->
						<div class="shrink-0">
							<DropdownCombobox
								value={child.field}
								options={fields.map((f) => ({
									value: f.id,
									label: f.label,
									shortLabel: f.shortLabel
								}))}
								placeholder="Select field"
								minWidth={keyMinWidth}
								width={keyWidthClass}
								fullWidth
								limit={6}
								responsiveButton
								compactDropdownThreshold={7}
								fixed
								on:change={(e) => onFieldChange(child, e.detail)}
							/>
						</div>

						<!-- Operator -->
						{#if field}
							<div class="shrink-0">
								<DropdownSelect
									value={child.operator}
									options={isDynamicField
										? dynamicStringOperators
										: field.operators.map((op) => ({
												value: op.id,
												label: op.label,
												shortLabel: op.shortLabel
											}))}
									minWidth="7rem"
									width={operatorWidthClass}
									fullWidth
									responsiveButton
									compactDropdownThreshold={7}
									fixed
									on:change={(e) => {
										child.operator = e.detail;
										notifyChange();
									}}
								/>
							</div>

							<!-- Value -->
							<div class="shrink-0">
									{#if field?.valueType === 'boolean' || field?.valueType === 'select'}
										{#if field.values}
											<DropdownSelect
												value={String(child.value)}
												options={field.values.map((v) => ({
													value: String(v.value),
													label: v.label
												}))}
												minWidth={valueMinWidth}
												width={valueWidthClass}
												fullWidth
												responsiveButton
												compactDropdownThreshold={7}
												fixed
												on:change={(e) => {
													const originalValue = field.values?.find(
														(v) => String(v.value) === e.detail
													)?.value;
													child.value = originalValue ?? e.detail;
													notifyChange();
												}}
											/>
										{/if}
									{:else if field?.valueType === 'text'}
										{#if isDynamicField}
											{#key `${field.id}:${childIndex}:${dynamicFilterOptionsVersion}`}
												<DropdownCombobox
													value={String(child.value ?? '')}
													options={getDynamicOptions(field.id, child.value, dynamicFilterOptions)}
													placeholder={dynamicFilterOptionsLoading
														? 'Loading values...'
														: 'Select value'}
													minWidth={valueMinWidth}
													width={valueWidthClass}
													fullWidth
													limit={6}
													responsiveButton
													compactDropdownThreshold={7}
													fixed
													on:change={(e) => {
														child.value = e.detail;
														notifyChange();
													}}
												/>
											{/key}
										{:else}
											<div class={valueWidthClass}>
												<FormInput
													label="Value"
													hideLabel
													name="filter-value-{childIndex}"
													value={child.value as string}
													responsive
													autoWidth
													on:input={(e) => {
														child.value = e.detail;
														notifyChange();
													}}
												/>
											</div>
										{/if}
									{:else if field?.valueType === 'number'}
										<div class={valueWidthClass}>
											<NumberInput
												name="value-{childIndex}"
												on:change={(e) => {
													if (e.detail !== undefined) child.value = e.detail;
													notifyChange();
												}}
												value={child.value as number}
												font="mono"
												responsive
												autoWidth
											/>
										</div>
									{:else if field?.valueType === 'date'}
										{#if child.operator === 'in_last' || child.operator === 'not_in_last'}
											<div class="{valueWidthClass} flex items-center gap-2">
												<div class="min-w-0 flex-1">
													<NumberInput
														name="value-{childIndex}"
														value={child.value as number}
														on:change={(e) => {
															if (e.detail !== undefined) child.value = e.detail;
															notifyChange();
														}}
														min={1}
														font="mono"
														responsive
														autoWidth
													/>
												</div>
												<span class="text-xs text-neutral-500 dark:text-neutral-400">days</span>
											</div>
										{:else}
											<div class={valueWidthClass}>
												<DateInput
													label="Date"
													hideLabel
													name="value-{childIndex}"
												value={child.value as string}
												fullWidth
												responsive
												shortLabels
												fixed
													on:change={(e) => {
														child.value = e.detail;
														notifyChange();
													}}
												/>
											</div>
										{/if}
									{/if}
								</div>
						{/if}

						<!-- Remove Rule -->
						<div class="shrink-0">
							<Button icon={X} variant="ghost" size="xs" on:click={() => removeChild(childIndex)} />
						</div>
					</div>
				{:else if isGroup(child)}
					<!-- Nested Group (recursive) -->
					<div class="ml-4">
						<svelte:self
							group={child}
							{appType}
							{dynamicFilterOptions}
							{dynamicFilterOptionsLoading}
							{dynamicFilterOptionsVersion}
							depth={depth + 1}
							onRemove={() => removeChild(childIndex)}
							on:change={handleNestedChange}
						/>
					</div>
				{/if}
			{/each}
			</div>
		</div>
	{/if}

	<!-- Add Buttons -->
	<div class="mt-3 flex items-center gap-2">
		<Button text="Add Rule" icon={Plus} responsive on:click={addRule} />
		<Button text="Add Group" icon={FolderPlus} responsive on:click={addNestedGroup} />
	</div>
</Card>
