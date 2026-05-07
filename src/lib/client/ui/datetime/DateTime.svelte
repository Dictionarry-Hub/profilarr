<script lang="ts">
	import { dateFormat } from '$lib/client/stores/dateFormat.ts';
	import { serverTimezone } from '$lib/client/stores/timezone.ts';
	import { formatDateTime, formatDate } from '$shared/utils/dates.ts';

	export let value: string | null | undefined = undefined;
	export let date: boolean = false;
	export let options: Intl.DateTimeFormatOptions | undefined = undefined;
</script>

{#if date}
	{formatDate(value, $serverTimezone, $dateFormat, options)}
{:else}
	{formatDateTime(value, $serverTimezone, $dateFormat, options)}
{/if}
