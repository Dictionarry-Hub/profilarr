export function parseDownloadedReportCount(message: string | null | undefined): number | null {
	if (!message) return null;

	const match = message.match(/\b(\d+)\s+reports?\s+downloaded\b/i);
	if (!match) return null;

	return Number.parseInt(match[1], 10);
}
