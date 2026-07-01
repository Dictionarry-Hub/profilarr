<script lang="ts">
	export let field: string;
	export let was: unknown;
	export let you: unknown;
	export let upstreamNow: unknown;

	function titleCase(value: string): string {
		return value
			.split(/[\s_]+/)
			.filter(Boolean)
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');
	}

	function formatValue(value: unknown): string {
		if (value === null || value === undefined) return '—';
		if (typeof value === 'boolean') return value ? 'Yes' : 'No';
		if (typeof value === 'string') {
			if (value === '') return '(empty)';
			return value;
		}
		if (typeof value === 'number') return String(value);
		try {
			return JSON.stringify(value);
		} catch {
			return String(value);
		}
	}
</script>

<div class="space-y-1.5">
	<h4 class="text-sm font-semibold text-text">
		{titleCase(field)}
	</h4>
	<dl class="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-xs">
		<div class="flex items-baseline gap-1.5">
			<dt class="text-text-muted">Original:</dt>
			<dd class="font-mono text-text">{formatValue(was)}</dd>
		</div>
		<div class="flex items-baseline gap-1.5">
			<dt class="text-text-muted">You Set:</dt>
			<dd class="font-mono text-text">{formatValue(you)}</dd>
		</div>
		<div class="flex items-baseline gap-1.5">
			<dt class="text-text-muted">Upstream Set:</dt>
			<dd class="font-mono text-text">{formatValue(upstreamNow)}</dd>
		</div>
	</dl>
</div>
