function canonicalize(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(canonicalize);
	}

	if (value && typeof value === 'object') {
		const record = value as Record<string, unknown>;
		const result: Record<string, unknown> = {};
		for (const key of Object.keys(record).sort()) {
			result[key] = canonicalize(record[key]);
		}
		return result;
	}

	return value;
}

export function stringifyCanonical(value: unknown): string {
	return JSON.stringify(canonicalize(value));
}

export async function hashDriftDiff(diff: unknown): Promise<string> {
	const data = new TextEncoder().encode(stringifyCanonical(diff));
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	return Array.from(new Uint8Array(hashBuffer))
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}
