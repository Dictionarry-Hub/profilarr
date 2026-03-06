/**
 * OIDC (OpenID Connect) utilities
 * Handles discovery, token exchange, and ID token verification
 */

import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface DiscoveryDocument {
	issuer: string;
	authorization_endpoint: string;
	token_endpoint: string;
	userinfo_endpoint?: string;
	jwks_uri: string;
}

export interface TokenResponse {
	access_token: string;
	id_token: string;
	token_type: string;
	expires_in?: number;
	refresh_token?: string;
}

export interface IdTokenClaims {
	sub: string;
	email?: string;
	name?: string;
	preferred_username?: string;
	nonce?: string;
	iss: string;
	aud: string | string[];
	exp: number;
	iat: number;
}

// Cache discovery document (doesn't change often)
let cachedDiscovery: {
	url: string;
	doc: DiscoveryDocument;
	expires: number;
} | null = null;

/**
 * Fetch and cache OIDC discovery document
 */
export async function getDiscoveryDocument(url: string): Promise<DiscoveryDocument> {
	if (cachedDiscovery && cachedDiscovery.url === url && Date.now() < cachedDiscovery.expires) {
		return cachedDiscovery.doc;
	}

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch OIDC discovery: ${response.status}`);
	}

	const doc = (await response.json()) as DiscoveryDocument;

	if (!doc.authorization_endpoint || !doc.token_endpoint) {
		throw new Error('Invalid OIDC discovery document');
	}

	// Cache for 1 hour
	cachedDiscovery = {
		url,
		doc,
		expires: Date.now() + 60 * 60 * 1000
	};

	return doc;
}

/**
 * Generate a random state token for CSRF protection
 */
export function generateState(): string {
	return crypto.randomUUID();
}

/**
 * Build the authorization URL
 */
export function buildAuthorizationUrl(
	authorizationEndpoint: string,
	opts: {
		clientId: string;
		redirectUri: string;
		state: string;
		nonce: string;
		scope?: string;
	}
): string {
	const params = new URLSearchParams({
		client_id: opts.clientId,
		redirect_uri: opts.redirectUri,
		response_type: 'code',
		scope: opts.scope || 'openid email profile',
		state: opts.state,
		nonce: opts.nonce
	});

	return `${authorizationEndpoint}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCode(
	tokenEndpoint: string,
	code: string,
	opts: {
		clientId: string;
		clientSecret: string;
		redirectUri: string;
	}
): Promise<TokenResponse> {
	const response = await fetch(tokenEndpoint, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams({
			grant_type: 'authorization_code',
			code,
			client_id: opts.clientId,
			client_secret: opts.clientSecret,
			redirect_uri: opts.redirectUri
		})
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Token exchange failed: ${response.status} - ${error}`);
	}

	const data = await response.json();

	if (data.error) {
		throw new Error(`Token exchange error: ${data.error}`);
	}

	return data as TokenResponse;
}

/**
 * Verify ID token signature, issuer, audience, and expiry via JWKS
 * Returns the verified claims
 */
export async function verifyAndDecodeIdToken(
	idToken: string,
	jwksUri: string,
	opts: {
		clientId: string;
		issuer: string;
	}
): Promise<IdTokenClaims> {
	const jwks = createRemoteJWKSet(new URL(jwksUri));
	const { payload } = await jwtVerify(idToken, jwks, {
		issuer: opts.issuer,
		audience: opts.clientId
	});
	return payload as unknown as IdTokenClaims;
}

/**
 * Clear the cached discovery document
 */
export function clearDiscoveryCache(): void {
	cachedDiscovery = null;
}
