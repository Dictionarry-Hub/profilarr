/**
 * Create a custom format operation
 */

import type { PCDCache } from '#pcd/index.ts';
import { writeOperation, type OperationLayer } from '#pcd/index.ts';
import { logger } from '#logger/logger.ts';
import { uuid } from '#shared/utils/uuid.ts';

interface CreateCustomFormatInput {
	name: string;
	description: string | null;
	includeInRename: boolean;
	tags: string[];
}

interface CreateCustomFormatOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	input: CreateCustomFormatInput;
}

/**
 * Create a custom format by writing an operation to the specified layer
 */
export async function create(options: CreateCustomFormatOptions) {
	const { databaseId, cache, layer, input } = options;
	const db = cache.kb;

	const existing = await db
		.selectFrom('custom_formats')
		.where((eb) => eb(eb.fn('lower', [eb.ref('name')]), '=', input.name.toLowerCase()))
		.select('name')
		.executeTakeFirst();

	if (existing) {
		await logger.warn(`Duplicate custom format name "${input.name}"`, {
			source: 'CustomFormat',
			meta: { databaseId, name: input.name }
		});
		throw new Error(`A custom format with name "${input.name}" already exists`);
	}

	// Normalize description: empty/whitespace → '' (matches v1 translator behavior)
	const normalizedDescription = input.description?.trim() ?? '';

	const includeChanged = input.includeInRename;
	const descriptionChanged = normalizedDescription !== '';
	const uniqueTags = Array.from(new Set(input.tags.map((tag) => tag.trim()).filter(Boolean)));
	const opCount =
		(descriptionChanged ? 1 : 0) + (includeChanged ? 1 : 0) + (uniqueTags.length > 0 ? 1 : 0);
	const groupId = opCount > 0 ? uuid() : undefined;

	// 1. Insert the custom format with name and empty description
	// Always include description as '' to match v1 translator behavior (not NULL)
	const formatQueries = [];
	const insertFormat = db
		.insertInto('custom_formats')
		.values({ name: input.name, description: '' })
		.compile();

	formatQueries.push(insertFormat);

	// 2. Insert tags (create if not exist, then link) as a separate op
	const tagQueries = [];
	for (const tagName of uniqueTags) {
		// Insert tag if not exists
		const insertTag = db
			.insertInto('tags')
			.values({ name: tagName })
			.onConflict((oc) => oc.column('name').doNothing())
			.compile();

		tagQueries.push(insertTag);

		// Link tag to custom format using name-based FKs
		const linkTag = db
			.insertInto('custom_format_tags')
			.values({ custom_format_name: input.name, tag_name: tagName })
			.compile();

		tagQueries.push(linkTag);
	}

	// Write the general create operation
	const createResult = await writeOperation({
		databaseId,
		layer,
		description: `create-custom-format-${input.name}`,
		queries: formatQueries,
		desiredState: {
			name: input.name
		},
		metadata: {
			operation: 'create',
			entity: 'custom_format',
			name: input.name,
			...(groupId && { groupId })
		}
	});

	if (!createResult.success) {
		return createResult;
	}

	let lastResult = createResult;

	if (descriptionChanged) {
		const descriptionQuery = db
			.updateTable('custom_formats')
			.set({ description: normalizedDescription })
			.where('name', '=', input.name)
			.where('description', '=', '')
			.compile();

		const descriptionResult = await writeOperation({
			databaseId,
			layer,
			description: `update-custom-format-description-${input.name}`,
			queries: [descriptionQuery],
			desiredState: {
				description: { from: '', to: normalizedDescription }
			},
			metadata: {
				operation: 'update',
				entity: 'custom_format',
				name: input.name,
				stableKey: { key: 'custom_format_name', value: input.name },
				...(groupId && { groupId }),
				changedFields: ['description'],
				summary: 'Update custom format description',
				title: `Update description for custom format "${input.name}"`
			}
		});

		if (!descriptionResult.success) {
			return descriptionResult;
		}
		lastResult = descriptionResult;
	}

	if (includeChanged) {
		const includeQuery = db
			.updateTable('custom_formats')
			.set({ include_in_rename: 1 })
			.where('name', '=', input.name)
			.where('include_in_rename', '=', 0)
			.compile();

		const includeResult = await writeOperation({
			databaseId,
			layer,
			description: `update-custom-format-include-rename-${input.name}`,
			queries: [includeQuery],
			desiredState: {
				include_in_rename: { from: false, to: true }
			},
			metadata: {
				operation: 'update',
				entity: 'custom_format',
				name: input.name,
				stableKey: { key: 'custom_format_name', value: input.name },
				...(groupId && { groupId }),
				changedFields: ['include_in_rename'],
				summary: 'Update custom format include in rename',
				title: `Update include in rename for custom format "${input.name}"`
			}
		});

		if (!includeResult.success) {
			return includeResult;
		}
		lastResult = includeResult;
	}

	if (tagQueries.length === 0) {
		return lastResult;
	}

	const tagsResult = await writeOperation({
		databaseId,
		layer,
		description: `update-custom-format-tags-${input.name}`,
		queries: tagQueries,
		desiredState: {
			tags: uniqueTags
		},
		metadata: {
			operation: 'update',
			entity: 'custom_format',
			name: input.name,
			stableKey: { key: 'custom_format_name', value: input.name },
			...(groupId && { groupId }),
			changedFields: ['tags'],
			summary: 'Update custom format tags',
			title: `Update tags for custom format "${input.name}"`
		}
	});

	if (!tagsResult.success) {
		return tagsResult;
	}

	return lastResult;
}
