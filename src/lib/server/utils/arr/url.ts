export function normalizeArrInstanceUrl(value: string): string {
	const raw = value.trim();
	if (!raw) return '';

	try {
		const url = new URL(raw);
		const protocol = url.protocol.toLowerCase();
		const hostname = url.hostname.toLowerCase();
		const port =
			(protocol === 'http:' && url.port === '80') ||
			(protocol === 'https:' && url.port === '443')
				? ''
				: url.port;
		const host = port ? `${hostname}:${port}` : hostname;
		const pathname = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, '');

		return `${protocol}//${host}${pathname}`;
	} catch {
		return raw.replace(/[?#].*$/, '').replace(/\/+$/, '');
	}
}
