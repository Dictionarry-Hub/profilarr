/**
 * Section registry for sync processing
 * Reduces code duplication by providing a generic interface for all sync section types
 */

import type { SectionType, SectionHandler, ScheduledConfig } from './types.ts';

export type { SectionType, SectionHandler, ScheduledConfig };

// Type-safe registry
const sectionRegistry = new Map<SectionType, SectionHandler>();

/**
 * Register a section handler
 */
export function registerSection(handler: SectionHandler): void {
	sectionRegistry.set(handler.type, handler);
}

/**
 * Get a section handler by type
 */
export function getSection(type: SectionType): SectionHandler {
	const handler = sectionRegistry.get(type);
	if (!handler) {
		throw new Error(`Unknown section type: ${type}`);
	}
	return handler;
}

/**
 * Get all registered section handlers
 */
export function getAllSections(): SectionHandler[] {
	return Array.from(sectionRegistry.values());
}

/**
 * Get all section types
 */
export function getAllSectionTypes(): SectionType[] {
	return Array.from(sectionRegistry.keys());
}

/**
 * Check if a section type is registered
 */
export function hasSection(type: SectionType): boolean {
	return sectionRegistry.has(type);
}
