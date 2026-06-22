<script lang="ts">
	import { Plus, Trash2 } from 'lucide-svelte';
	import FormInput from './FormInput.svelte';
	import NumberInput from './NumberInput.svelte';

	export let value: Record<string, string> = {};
	export let label: string = '';
	export let description: string = '';
	export let keyLabel: string = 'Key';
	export let valueLabel: string = 'Value';
	export let keyPlaceholder: string = 'Enter key';
	export let valuePlaceholder: string = 'Enter value';
	export let onchange: ((value: Record<string, string>) => void) | undefined = undefined;
	export let lockedFirst: { key: string; value?: string; minMajor?: number } | undefined =
		undefined;
	export let onLockedDeleteAttempt: (() => void) | undefined = undefined;
	export let onLockedEditAttempt: (() => void) | undefined = undefined;
	export let onLockedVersionMinBlocked: (() => void) | undefined = undefined;
	export let valueType: 'text' | 'version' = 'text';
	export let versionMinMajor: number = 0;
	export let addDisabled: boolean = false;
	export let onAddBlocked: (() => void) | undefined = undefined;

	function parseVersion(v: string): [number, number, number] {
		const parts = v.split('.').map((p) => parseInt(p, 10) || 0);
		return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
	}

	function updateVersionPart(current: string, part: 0 | 1 | 2, val: number): string {
		const parts = parseVersion(current);
		parts[part] = val;
		return parts.join('.');
	}

	// Convert object to array for easier manipulation
	function initEntries() {
		const arr = Object.entries(value).map(([k, v]) => ({ key: k, value: v }));
		// Ensure locked first entry exists at index 0
		if (lockedFirst) {
			const existingIndex = arr.findIndex((e) => e.key === lockedFirst.key);
			if (existingIndex === -1) {
				arr.unshift({ key: lockedFirst.key, value: lockedFirst.value ?? '' });
			} else if (existingIndex !== 0) {
				const [item] = arr.splice(existingIndex, 1);
				arr.unshift(item);
			}
		}
		return arr;
	}
	let entries: Array<{ key: string; value: string }> = initEntries();

	function syncToValue() {
		const newValue: Record<string, string> = {};
		for (const entry of entries) {
			if (entry.key.trim()) {
				newValue[entry.key.trim()] = entry.value;
			}
		}
		value = newValue;
		onchange?.(value);
	}

	function addEntry() {
		if (addDisabled) {
			onAddBlocked?.();
			return;
		}
		entries = [...entries, { key: '', value: valueType === 'version' ? '1.0.0' : '' }];
	}

	function removeEntry(index: number) {
		if (lockedFirst && index === 0) return;
		entries = entries.filter((_, i) => i !== index);
		syncToValue();
	}

	function updateKey(index: number, newKey: string) {
		if (lockedFirst && index === 0) return;
		entries[index].key = newKey;
		entries = entries;
		syncToValue();
	}

	function updateValue(index: number, newValue: string) {
		entries[index].value = newValue;
		entries = entries;
		syncToValue();
	}

	// Sync when value changes externally (but preserve entries with empty keys being edited)
	$: {
		const externalEntries = Object.entries(value);
		const currentFilledKeys = entries
			.filter((e) => e.key.trim())
			.map((e) => e.key)
			.sort()
			.join(',');
		const externalKeys = externalEntries
			.map(([k]) => k)
			.sort()
			.join(',');

		if (currentFilledKeys !== externalKeys) {
			const emptyKeyEntries = entries.filter((e) => !e.key.trim());
			entries = [...externalEntries.map(([k, v]) => ({ key: k, value: v })), ...emptyKeyEntries];
			// Re-run initEntries logic to ensure locked first is at index 0
			if (lockedFirst) {
				const existingIndex = entries.findIndex((e) => e.key === lockedFirst.key);
				if (existingIndex > 0) {
					const [item] = entries.splice(existingIndex, 1);
					entries.unshift(item);
				}
			}
		}
	}
</script>

<div class="space-y-3">
	{#if label}
		<span class="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
			{label}
		</span>
	{/if}

	{#if description}
		<p class="text-xs text-neutral-500 dark:text-neutral-400">
			{description}
		</p>
	{/if}

	<div class="space-y-2">
		{#if entries.length > 0}
			<!-- Header (desktop only) -->
			<div
				class="hidden text-xs font-medium text-neutral-500 md:grid md:grid-cols-[1fr_auto_auto] md:gap-2 dark:text-neutral-400"
			>
				<span>{keyLabel}</span>
				<span>{valueLabel}</span>
				<span class="w-8"></span>
			</div>
		{/if}

		<!-- Entries -->
		{#each entries as entry, index (index)}
			{@const isLocked = lockedFirst && index === 0}
			{@const [vMajor, vMinor, vPatch] = parseVersion(entry.value)}
			<!-- Mobile: stacked layout -->
			<div
				class="space-y-2 rounded-lg border border-neutral-200 p-3 md:hidden dark:border-neutral-700"
			>
				<div class="flex items-center justify-between">
					<span class="text-xs font-medium text-neutral-500 dark:text-neutral-400">{keyLabel}</span>
					<button
						type="button"
						onclick={() => (isLocked ? onLockedDeleteAttempt?.() : removeEntry(index))}
						class="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
						aria-label="Remove entry"
					>
						<Trash2 size={16} />
					</button>
				</div>
				<FormInput
					label={keyLabel}
					hideLabel
					value={entry.key}
					placeholder={keyPlaceholder}
					readonly={!!isLocked}
					on:focus={() => {
						if (isLocked) {
							onLockedEditAttempt?.();
						}
					}}
					on:input={(e) => updateKey(index, e.detail)}
				/>
				<span class="text-xs font-medium text-neutral-500 dark:text-neutral-400">{valueLabel}</span>
				{#if valueType === 'version'}
					<div class="flex items-center gap-1">
						<div class="w-16">
							<NumberInput
								name="version-major-{index}-mobile"
								value={vMajor}
								min={isLocked && lockedFirst?.minMajor !== undefined
									? lockedFirst.minMajor
									: versionMinMajor}
								font="mono"
								onchange={(v) => updateValue(index, updateVersionPart(entry.value, 0, v))}
								onMinBlocked={isLocked ? onLockedVersionMinBlocked : undefined}
							/>
						</div>
						<span class="text-lg font-medium text-neutral-400 dark:text-neutral-500">.</span>
						<div class="w-16">
							<NumberInput
								name="version-minor-{index}-mobile"
								value={vMinor}
								min={0}
								font="mono"
								onchange={(v) => updateValue(index, updateVersionPart(entry.value, 1, v))}
							/>
						</div>
						<span class="text-lg font-medium text-neutral-400 dark:text-neutral-500">.</span>
						<div class="w-16">
							<NumberInput
								name="version-patch-{index}-mobile"
								value={vPatch}
								min={0}
								font="mono"
								onchange={(v) => updateValue(index, updateVersionPart(entry.value, 2, v))}
							/>
						</div>
					</div>
				{:else}
					<FormInput
						label={valueLabel}
						hideLabel
						value={entry.value}
						placeholder={valuePlaceholder}
						on:input={(e) => updateValue(index, e.detail)}
					/>
				{/if}
			</div>

			<!-- Desktop: grid layout -->
			<div class="hidden md:grid md:grid-cols-[1fr_auto_auto] md:gap-2">
				<FormInput
					label={keyLabel}
					hideLabel
					value={entry.key}
					placeholder={keyPlaceholder}
					readonly={!!isLocked}
					on:focus={() => {
						if (isLocked) {
							onLockedEditAttempt?.();
						}
					}}
					on:input={(e) => updateKey(index, e.detail)}
				/>
				{#if valueType === 'version'}
					<div class="flex items-center gap-1">
						<div class="w-16">
							<NumberInput
								name="version-major-{index}"
								value={vMajor}
								min={isLocked && lockedFirst?.minMajor !== undefined
									? lockedFirst.minMajor
									: versionMinMajor}
								font="mono"
								onchange={(v) => updateValue(index, updateVersionPart(entry.value, 0, v))}
								onMinBlocked={isLocked ? onLockedVersionMinBlocked : undefined}
							/>
						</div>
						<span class="text-lg font-medium text-neutral-400 dark:text-neutral-500">.</span>
						<div class="w-16">
							<NumberInput
								name="version-minor-{index}"
								value={vMinor}
								min={0}
								font="mono"
								onchange={(v) => updateValue(index, updateVersionPart(entry.value, 1, v))}
							/>
						</div>
						<span class="text-lg font-medium text-neutral-400 dark:text-neutral-500">.</span>
						<div class="w-16">
							<NumberInput
								name="version-patch-{index}"
								value={vPatch}
								min={0}
								font="mono"
								onchange={(v) => updateValue(index, updateVersionPart(entry.value, 2, v))}
							/>
						</div>
					</div>
				{:else}
					<FormInput
						label={valueLabel}
						hideLabel
						value={entry.value}
						placeholder={valuePlaceholder}
						on:input={(e) => updateValue(index, e.detail)}
					/>
				{/if}
				<button
					type="button"
					onclick={() => (isLocked ? onLockedDeleteAttempt?.() : removeEntry(index))}
					class="flex h-[38px] w-8 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
					aria-label="Remove entry"
				>
					<Trash2 size={16} />
				</button>
			</div>
		{/each}

		<!-- Add button -->
		<button
			type="button"
			onclick={addEntry}
			class="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
		>
			<Plus size={16} />
			Add entry
		</button>
	</div>
</div>
