<script lang="ts">
	import type { DraftEntitySection, OperationType } from './types.ts';
	import SectionRenderer from './SectionRenderer.svelte';

	export let sections: DraftEntitySection[] = [];
	export let operation: OperationType = 'update';
</script>

<SectionRenderer {sections} {operation} />
