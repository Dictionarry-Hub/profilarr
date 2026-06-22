<script lang="ts">
	import { ChevronLeft, ChevronRight } from 'lucide-svelte';
	import Button from '$ui/button/Button.svelte';

	export let currentPage: number;
	export let totalPages: number;
	export let onPageChange: (page: number) => void;
</script>

<div class="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
	<Button
		variant="ghost"
		size="sm"
		icon={ChevronLeft}
		disabled={currentPage <= 1}
		ariaLabel="Previous page"
		on:click={() => onPageChange(currentPage - 1)}
	/>
	<span>Page {currentPage} of {totalPages}</span>
	<Button
		variant="ghost"
		size="sm"
		icon={ChevronRight}
		disabled={currentPage >= totalPages}
		ariaLabel="Next page"
		on:click={() => onPageChange(currentPage + 1)}
	/>
</div>
