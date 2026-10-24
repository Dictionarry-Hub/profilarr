/**
 * Read the data the server sends a page, so a scenario can check what the app
 * stored instead of what an input happens to show.
 *
 * SvelteKit serves each page's load data at `<page path>/__data.json`, which
 * the client fetches when navigating. The payload lists layout and page nodes,
 * each encoded with devalue: a flat array where values refer to each other by
 * index. `pageData` fetches it with the browser's session, decodes every node,
 * and merges them, page data over layout data.
 *
 * It also opens the page in a throwaway tab first, so the trace shows the page
 * under the read. The test's own tab stays where it is, so a read never
 * leaves a form or trips an unsaved-changes guard.
 */

import { expect, test, type Page } from '@playwright/test';

export type Json = Record<string, unknown>;

interface DataResponse {
	type: 'data' | 'redirect' | 'error';
	nodes?: (
		{ type: 'data'; data: unknown[] } | { type: 'skip' } | { type: 'error'; error: unknown } | null
	)[];
	location?: string;
	error?: unknown;
}

// devalue's encodings for values JSON can't hold
const UNDEFINED = -1;
const HOLE = -2;
const NAN = -3;
const POSITIVE_INFINITY = -4;
const NEGATIVE_INFINITY = -5;
const NEGATIVE_ZERO = -6;

/** Decode one devalue-flattened node */
export function unflatten(values: unknown[]): unknown {
	const hydrated = new Map<number, unknown>();

	function hydrate(index: number): unknown {
		if (index === UNDEFINED) return undefined;
		if (index === NAN) return NaN;
		if (index === POSITIVE_INFINITY) return Infinity;
		if (index === NEGATIVE_INFINITY) return -Infinity;
		if (index === NEGATIVE_ZERO) return -0;
		if (hydrated.has(index)) return hydrated.get(index);

		const value = values[index];
		if (!value || typeof value !== 'object') {
			hydrated.set(index, value);
			return value;
		}

		if (Array.isArray(value)) {
			// A string first element marks a special type, like ["Date", "2026-..."]
			if (typeof value[0] === 'string') {
				const [tag, ...rest] = value as [string, ...unknown[]];
				let out: unknown;
				switch (tag) {
					case 'Date':
						out = new Date(rest[0] as string);
						break;
					case 'Set': {
						const set = new Set();
						hydrated.set(index, set);
						for (const item of rest) set.add(hydrate(item as number));
						return set;
					}
					case 'Map': {
						const map = new Map();
						hydrated.set(index, map);
						for (let i = 0; i < rest.length; i += 2) {
							map.set(hydrate(rest[i] as number), hydrate(rest[i + 1] as number));
						}
						return map;
					}
					case 'RegExp':
						out = new RegExp(rest[0] as string, rest[1] as string | undefined);
						break;
					case 'BigInt':
						out = BigInt(rest[0] as string);
						break;
					case 'Object':
						out = Object(rest[0]);
						break;
					case 'URL':
						out = new URL(rest[0] as string);
						break;
					case 'null': {
						const object = Object.create(null) as Json;
						hydrated.set(index, object);
						for (let i = 0; i < rest.length; i += 2) {
							object[rest[i] as string] = hydrate(rest[i + 1] as number);
						}
						return object;
					}
					default:
						throw new Error(`pageData can't decode devalue type "${tag}"`);
				}
				hydrated.set(index, out);
				return out;
			}

			const array: unknown[] = new Array(value.length);
			hydrated.set(index, array);
			value.forEach((item, i) => {
				if (item !== HOLE) array[i] = hydrate(item as number);
			});
			return array;
		}

		const object: Json = {};
		hydrated.set(index, object);
		for (const [key, item] of Object.entries(value)) object[key] = hydrate(item as number);
		return object;
	}

	return hydrate(0);
}

/** Open `url` in a new tab of the same browser session, then close it */
async function showInTrace(page: Page, url: string): Promise<void> {
	const tab = await page.context().newPage();
	try {
		await tab.goto(url);
	} finally {
		await tab.close();
	}
}

/**
 * The current page's server data, decoded and merged across its layouts.
 * Pass a path to read another page's data without navigating.
 */
export async function pageData<T = Json>(page: Page, path?: string): Promise<T> {
	return await test.step(
		`Read page data for ${path ?? new URL(page.url()).pathname}`,
		async () => {
			const url = new URL(path ?? page.url(), page.url());
			const dataPath = `${url.pathname.replace(/\/$/, '')}/__data.json${url.search}`;
			// Keep the origin: a path alone would resolve against baseURL, the test's
			// own app, even when the page or `path` points at another one
			await showInTrace(page, `${url.origin}${url.pathname}${url.search}`);
			const response = await page.request.get(`${url.origin}${dataPath}`);
			expect(response.ok(), `${dataPath} should answer`).toBe(true);

			const body = (await response.json()) as DataResponse;
			if (body.type !== 'data') {
				throw new Error(
					`${dataPath} answered ${body.type}: ${JSON.stringify(body.location ?? body.error)}`
				);
			}
			const merged: Json = {};
			for (const node of body.nodes ?? []) {
				if (node?.type === 'data') Object.assign(merged, unflatten(node.data));
				if (node?.type === 'error')
					throw new Error(`${dataPath} node error: ${JSON.stringify(node.error)}`);
			}
			return merged as T;
		},
		{ box: true }
	);
}

const camel = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

/** Page data with camelCase keys, so it lines up with the fixtures snapshot */
export function camelKeys(row: Json): Json {
	return Object.fromEntries(Object.entries(row).map(([key, value]) => [camel(key), value]));
}

/** Only the keys of `expected`, read from `actual`, to compare just those */
export function pick(actual: Json, expected: object): Json {
	return Object.fromEntries(Object.keys(expected).map((key) => [key, actual[key]]));
}
