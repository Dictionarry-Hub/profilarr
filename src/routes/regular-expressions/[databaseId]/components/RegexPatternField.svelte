<script lang="ts">
	import { onMount } from 'svelte';
	import { ExternalLink, AlertCircle, Check, X, Loader2 } from 'lucide-svelte';
	import { alertStore } from '$alerts/store';
	import { sanitizeRegex101Id } from '$lib/client/utils/regex101';
	import Label from '$ui/label/Label.svelte';

	// Props
	export let pattern: string = '';
	export let regex101Id: string = '';
	export let onPatternChange: ((value: string) => void) | undefined = undefined;
	export let onRegex101IdChange: ((value: string) => void) | undefined = undefined;
	export let onValidationStateChange:
		| ((state: 'idle' | 'checking' | 'valid' | 'invalid' | 'unavailable') => void)
		| undefined = undefined;

	function handlePatternChange(value: string) {
		pattern = value;
		onPatternChange?.(value);
		scheduleValidation(value);
	}

	function handleRegex101IdChange(value: string) {
		const { value: sanitizedValue, sanitized } = sanitizeRegex101Id(value);
		if (sanitized) {
			alertStore.add('info', `Regex101 link detected. Saved ID as "${sanitizedValue}".`);
		}
		regex101Id = sanitizedValue;
		onRegex101IdChange?.(sanitizedValue);
	}

	// Regex validation state
	let validationState: 'idle' | 'checking' | 'valid' | 'invalid' | 'unavailable' = 'idle';
	$: onValidationStateChange?.(validationState);
	let validationError = '';
	let validationTimer: ReturnType<typeof setTimeout>;

	onMount(() => {
		if (pattern.trim()) {
			validationState = 'checking';
			runValidation(pattern);
		}
	});

	function scheduleValidation(value: string) {
		clearTimeout(validationTimer);
		if (!value.trim()) {
			validationState = 'idle';
			return;
		}
		validationState = 'checking';
		validationTimer = setTimeout(() => runValidation(value), 500);
	}

	async function runValidation(value: string) {
		try {
			const res = await fetch('/api/v1/regex/validate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pattern: value })
			});
			const data = await res.json();
			if (data.available === false) {
				validationState = 'unavailable';
			} else if (data.valid) {
				validationState = 'valid';
			} else {
				validationState = 'invalid';
				validationError = data.error ?? 'Invalid pattern';
			}
		} catch {
			validationState = 'idle';
		}
	}

	// Build regex101 URL
	$: regex101Url = regex101Id ? `https://regex101.com/r/${regex101Id}` : '';
</script>

<div class="space-y-4">
	<!-- Regex Pattern -->
	<div class="space-y-2">
		<label for="pattern" class="block text-sm font-medium text-neutral-900 dark:text-neutral-100">
			Regular Expression<span class="text-red-500">*</span>
		</label>
		<div class="flex items-center justify-between gap-2">
			<p class="text-xs text-neutral-600 dark:text-neutral-400">
				Uses .NET regex flavor (case-insensitive by default)
			</p>
			{#if validationState === 'checking'}
				<Label variant="secondary" size="sm" rounded="md">
					<Loader2 size={10} class="animate-spin text-neutral-500 dark:text-neutral-400" />
					Checking...
				</Label>
			{:else if validationState === 'valid'}
				<Label variant="secondary" size="sm" rounded="md">
					<Check size={10} class="text-green-500 dark:text-green-400" />
					Valid
				</Label>
			{:else if validationState === 'invalid'}
				<Label variant="secondary" size="sm" rounded="md">
					<X size={10} class="text-red-500 dark:text-red-400" />
					Invalid
				</Label>
			{:else if validationState === 'unavailable'}
				<Label variant="secondary" size="sm" rounded="md">
					<AlertCircle size={10} class="text-neutral-400 dark:text-neutral-500" />
					Parser unavailable
				</Label>
			{/if}
		</div>
		<textarea
			id="pattern"
			name="pattern"
			value={pattern}
			placeholder="e.g., \b(SPARKS)\b"
			required
			rows={3}
			on:input={(e) => handlePatternChange((e.currentTarget as HTMLTextAreaElement).value)}
			class="block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 font-mono text-sm text-neutral-900 placeholder-neutral-400 transition-colors focus:border-neutral-400 focus:outline-none dark:border-neutral-700/60 dark:bg-neutral-800/50 dark:text-neutral-50 dark:placeholder-neutral-500 dark:focus:border-neutral-600"
		></textarea>
		{#if validationState === 'invalid' && validationError}
			<p class="font-mono text-xs text-red-600 dark:text-red-400">{validationError}</p>
		{/if}
	</div>

	<!-- Regex101 ID -->
	<div>
		<label
			for="regex101Id"
			class="block text-sm font-medium text-neutral-900 dark:text-neutral-100"
		>
			Regex101 ID
		</label>
		<p class="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
			Link to regex101.com for testing (include version, e.g., ABC123/1)
		</p>
		<div
			class="mt-2 flex h-10 items-center overflow-hidden rounded-xl border border-neutral-300 bg-white dark:border-neutral-700/60 dark:bg-neutral-800/50"
		>
			<input
				type="text"
				id="regex101Id"
				name="regex101Id"
				value={regex101Id}
				placeholder="e.g., GMV8jd/1"
				on:input={(e) => handleRegex101IdChange(e.currentTarget.value)}
				class="h-full flex-1 bg-transparent px-3 font-mono text-sm text-neutral-900 placeholder-neutral-500 outline-none dark:text-neutral-100 dark:placeholder-neutral-400"
			/>
			{#if regex101Url}
				<a
					href={regex101Url}
					target="_blank"
					rel="noopener noreferrer"
					class="flex h-full items-center justify-center border-l border-neutral-300 px-3 transition-colors hover:bg-neutral-50 dark:border-neutral-700/60 dark:hover:bg-neutral-800"
					title="Test on regex101.com"
				>
					<ExternalLink size={18} class="text-blue-600 dark:text-blue-400" />
				</a>
			{/if}
		</div>
	</div>
</div>
