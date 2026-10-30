/**
 * Types for origins.js, which app code imports from TypeScript compiled
 * without allowJs (the test type checks). Keep in step with the JSDoc there.
 */
export interface AllowedOrigin {
	origin: string;
	protocol: 'http' | 'https';
	hostname: string;
	port: string;
	explicitPort: boolean;
	host: string;
}

export function parseOrigins(raw: string | undefined): AllowedOrigin[];

export function resolveOrigin(
	headers: Record<string, string | string[] | undefined>,
	encrypted: boolean,
	origins: AllowedOrigin[]
): string | undefined;

export function firstSightings(limit: number): (value: string) => boolean;
