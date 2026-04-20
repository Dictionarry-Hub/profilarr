export function getDisplayUrl(instance: { url: string; external_url?: string | null }): string {
	const override = instance.external_url?.trim();
	const chosen = override && override.length > 0 ? override : instance.url;
	return chosen.replace(/\/$/, '');
}
