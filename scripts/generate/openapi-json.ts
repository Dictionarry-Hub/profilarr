import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { load as parse } from 'js-yaml';

const OPENAPI_ROOT_URL = new URL('../docs/api/v1/openapi.yaml', import.meta.url);
// Optional output path argument; defaults to the committed artifact.
const OUTPUT_URL = process.argv[2]
	? pathToFileURL(resolve(process.argv[2]))
	: new URL('../src/lib/api/v1.openapi.json', import.meta.url);

const parsedDocumentCache = new Map<string, unknown>();

async function main(): Promise<void> {
	const rootDocument = await loadDocument(OPENAPI_ROOT_URL);
	const bundledSpec = await resolveNode(rootDocument, OPENAPI_ROOT_URL, new Set<string>());

	await writeFile(OUTPUT_URL, `${JSON.stringify(bundledSpec, null, 2)}\n`);
}

async function loadDocument(fileUrl: URL): Promise<unknown> {
	const cacheKey = fileUrl.href;
	const cachedDocument = parsedDocumentCache.get(cacheKey);
	if (cachedDocument !== undefined) {
		return cachedDocument;
	}

	const fileContent = await readFile(fileUrl, 'utf8');
	const parsedDocument = parse(fileContent);
	parsedDocumentCache.set(cacheKey, parsedDocument);
	return parsedDocument;
}

async function resolveNode(
	node: unknown,
	currentFileUrl: URL,
	resolutionStack: Set<string>
): Promise<unknown> {
	if (Array.isArray(node)) {
		return Promise.all(node.map((item) => resolveNode(item, currentFileUrl, resolutionStack)));
	}

	if (!isRecord(node)) {
		return node;
	}

	if (typeof node.$ref === 'string') {
		return resolveReference(node, currentFileUrl, resolutionStack);
	}

	const resolvedEntries = await Promise.all(
		Object.entries(node).map(
			async ([key, value]) =>
				[key, await resolveNode(value, currentFileUrl, resolutionStack)] as const
		)
	);

	return Object.fromEntries(resolvedEntries);
}

async function resolveReference(
	node: Record<string, unknown>,
	currentFileUrl: URL,
	resolutionStack: Set<string>
): Promise<unknown> {
	const ref = node.$ref;
	if (typeof ref !== 'string') {
		return node;
	}

	const { targetFileUrl, pointer } = splitReference(ref, currentFileUrl);
	const resolutionKey = `${targetFileUrl.href}#${pointer}`;

	if (resolutionStack.has(resolutionKey)) {
		throw new Error(`Circular OpenAPI reference detected: ${resolutionKey}`);
	}

	const nextResolutionStack = new Set(resolutionStack);
	nextResolutionStack.add(resolutionKey);

	const targetDocument = await loadDocument(targetFileUrl);
	const targetValue = getJsonPointerValue(targetDocument, pointer);

	if (targetValue === undefined) {
		throw new Error(`Unable to resolve OpenAPI reference: ${ref}`);
	}

	const resolvedTarget = await resolveNode(targetValue, targetFileUrl, nextResolutionStack);
	const siblingEntries = Object.entries(node).filter(([key]) => key !== '$ref');

	if (siblingEntries.length === 0) {
		return resolvedTarget;
	}

	if (!isRecord(resolvedTarget)) {
		throw new Error(`Cannot merge sibling properties into non-object OpenAPI reference: ${ref}`);
	}

	return resolveNode(
		{
			...resolvedTarget,
			...Object.fromEntries(siblingEntries)
		},
		targetFileUrl,
		nextResolutionStack
	);
}

function splitReference(ref: string, currentFileUrl: URL): { targetFileUrl: URL; pointer: string } {
	const hashIndex = ref.indexOf('#');
	const filePath = hashIndex >= 0 ? ref.slice(0, hashIndex) : ref;
	const pointer = hashIndex >= 0 ? ref.slice(hashIndex + 1) : '';

	return {
		targetFileUrl: filePath ? new URL(filePath, currentFileUrl) : currentFileUrl,
		pointer
	};
}

function getJsonPointerValue(document: unknown, pointer: string): unknown {
	if (!pointer) {
		return document;
	}

	const normalizedPointer = pointer.startsWith('/') ? pointer : `/${pointer}`;
	const segments = normalizedPointer
		.split('/')
		.slice(1)
		.map((segment) => decodeJsonPointerSegment(segment));

	return resolvePointerSegments(document, segments);
}

function resolvePointerSegments(value: unknown, segments: string[]): unknown {
	if (segments.length === 0) {
		return value;
	}

	const [segment, ...rest] = segments;

	if (Array.isArray(value)) {
		const index = Number(segment);
		if (!Number.isInteger(index) || index < 0 || index >= value.length) {
			return undefined;
		}
		return resolvePointerSegments(value[index], rest);
	}

	if (!isRecord(value) || !Object.hasOwn(value, segment)) {
		return undefined;
	}

	return resolvePointerSegments(value[segment], rest);
}

function decodeJsonPointerSegment(segment: string): string {
	return decodeURIComponent(segment).replaceAll('~1', '/').replaceAll('~0', '~');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

await main();
