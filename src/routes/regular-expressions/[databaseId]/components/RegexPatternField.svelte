<script lang="ts">
	import { onMount } from 'svelte';
	import { AlertCircle, Check, X, Loader2 } from 'lucide-svelte';
	import { alertStore } from '$alerts/store';
	import { sanitizeRegex101Id } from '$lib/client/utils/regex101';
	import Label from '$ui/label/Label.svelte';
	import FormInput from '$ui/form/FormInput.svelte';

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
			const res = await fetch('/regular-expressions/validate', {
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
</script>

<div class="space-y-4">
	<!-- Regex Pattern -->
	<div data-onboarding="regex-pattern" class="space-y-2">
		<div class="flex items-center justify-between gap-2">
			<label for="pattern" class="block text-sm font-medium text-text">
				Regular Expression<span class="text-danger-icon">*</span>
			</label>
			{#if validationState === 'checking'}
				<Label variant="secondary" size="sm" radius="md">
					<Loader2 size={10} class="animate-spin text-text-muted " />
					Checking...
				</Label>
			{:else if validationState === 'valid'}
				<Label variant="secondary" size="sm" radius="md">
					<Check size={10} class="text-success-icon " />
					Valid
				</Label>
			{:else if validationState === 'invalid'}
				<Label variant="secondary" size="sm" radius="md">
					<X size={10} class="text-danger-icon " />
					Invalid
				</Label>
			{:else if validationState === 'unavailable'}
				<Label variant="secondary" size="sm" radius="md">
					<AlertCircle size={10} class="text-text-subtle " />
					Parser unavailable
				</Label>
			{/if}
		</div>
		<FormInput
			label="Regular Expression"
			hideLabel
			description="Uses .NET regex flavor (case-insensitive by default)"
			name="pattern"
			value={pattern}
			placeholder="e.g., \b(SPARKS)\b"
			required
			textarea
			rows={3}
			mono
			on:input={(e) => handlePatternChange(e.detail)}
		/>
		{#if validationState === 'invalid' && validationError}
			<p class="font-mono text-xs text-danger-icon">{validationError}</p>
		{/if}
	</div>

	<!-- Regex101 ID -->
	<div data-onboarding="regex101-id">
		<FormInput
			label="Regex101 ID"
			description="Link to regex101.com for testing (include version, e.g., ABC123/1)"
			name="regex101Id"
			value={regex101Id}
			placeholder="e.g., GMV8jd/1"
			mono
			on:input={(e) => handleRegex101IdChange(e.detail)}
		/>
	</div>
</div>
