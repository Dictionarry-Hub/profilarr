/**
 * Application configuration singleton
 */

import { parseAuthConfig, type AuthMode, type OidcSettings } from './auth.ts';
import { colors } from '$logger/colors.ts';

export type { AuthMode };

export const PROFILARR_API_KEY_MIN_LENGTH = 32;

/**
 * Stop startup on invalid settings. Config loads before the logger can run
 * (the logger imports config and reads its settings from the database), so
 * print a line in the logger's console format instead of throwing, which
 * would show as an uncaught error with a stack trace.
 */
function failStartup(message: string): never {
	const timestamp = `${colors.grey}${new Date().toISOString()}${colors.reset}`;
	const level = `${colors.red}ERROR${colors.reset}`;
	const source = `${colors.grey}[Config]${colors.reset}`;
	console.error([timestamp, level, message, source].join(' | '));
	Deno.exit(1);
}

class Config {
	private basePath: string;
	public readonly timezone: string;
	public readonly parserUrl: string;
	public readonly port: number;
	public readonly host: string;
	public readonly origin: string;
	public readonly authMode: AuthMode;
	public readonly deprecatedOidcMode: boolean;
	public readonly oidcEnabled: boolean;
	public readonly profilarrApiKey: string | null;
	public readonly oidc: OidcSettings;
	public readonly bulletinUrl: string;

	constructor() {
		// Default base path logic:
		// 1. Check environment variable
		// 2. Fall back to directory containing the executable
		const envPath = Deno.env.get('APP_BASE_PATH');
		if (envPath) {
			this.basePath = envPath;
		} else {
			// Use the directory where the executable is located
			const execPath = Deno.execPath();
			const lastSlash = Math.max(execPath.lastIndexOf('/'), execPath.lastIndexOf('\\'));
			this.basePath = lastSlash > 0 ? execPath.substring(0, lastSlash) : '.';
		}

		// Timezone configuration:
		// 1. Check TZ environment variable
		// 2. Fall back to system timezone
		this.timezone = Deno.env.get('TZ') || Intl.DateTimeFormat().resolvedOptions().timeZone;

		// Parser service configuration
		const parserHost = Deno.env.get('PARSER_HOST') || 'localhost';
		const parserPort = Deno.env.get('PARSER_PORT') || '5000';
		this.parserUrl = `http://${parserHost}:${parserPort}`;

		// Server bind configuration
		this.port = parseInt(Deno.env.get('PORT') || '6868', 10);
		this.host = Deno.env.get('HOST') || '0.0.0.0';

		// External origin (scheme + host) for OIDC redirects and cookie security.
		// Falls back to the local server URL when unset. Trailing slashes are
		// stripped so downstream concatenation (`${origin}/path`) doesn't double up.
		this.origin = (Deno.env.get('ORIGIN') || this.serverUrl).replace(/\/+$/, '');

		// Auth mode ('on' default, 'off') and SSO, enabled by the OIDC_* settings
		let auth: ReturnType<typeof parseAuthConfig>;
		try {
			auth = parseAuthConfig({
				AUTH: Deno.env.get('AUTH'),
				OIDC_DISCOVERY_URL: Deno.env.get('OIDC_DISCOVERY_URL'),
				OIDC_CLIENT_ID: Deno.env.get('OIDC_CLIENT_ID'),
				OIDC_CLIENT_SECRET: Deno.env.get('OIDC_CLIENT_SECRET')
			});
		} catch (err) {
			failStartup(err instanceof Error ? err.message : String(err));
		}
		this.authMode = auth.authMode;
		this.deprecatedOidcMode = auth.deprecatedOidcMode;
		this.oidcEnabled = auth.oidcEnabled;
		this.oidc = auth.oidc;

		// Optional declarative internal API key for GitOps/container deployments.
		const profilarrApiKey = Deno.env.get('PROFILARR_API_KEY') || null;
		if (profilarrApiKey !== null && profilarrApiKey.length < PROFILARR_API_KEY_MIN_LENGTH) {
			failStartup(
				`PROFILARR_API_KEY must be at least ${PROFILARR_API_KEY_MIN_LENGTH} characters long`
			);
		}
		this.profilarrApiKey = profilarrApiKey;

		// Bulletin (announcement feed + release manifest) base URL. The default
		// points at the live Dictionarry-Hub/bulletin repo served over GitHub's
		// raw content CDN. Override for testing against a fork, branch, or local
		// file server.
		this.bulletinUrl = (
			Deno.env.get('PROFILARR_BULLETIN_URL') ||
			'https://raw.githubusercontent.com/Dictionarry-Hub/bulletin/main'
		).replace(/\/+$/, '');
	}

	/**
	 * Get the server URL for display
	 */
	get serverUrl(): string {
		const displayHost = this.host === '0.0.0.0' ? 'localhost' : this.host;
		return `http://${displayHost}:${this.port}`;
	}

	/**
	 * Initialize the configuration (create directories)
	 * Must be called before using the config
	 */
	async init(): Promise<void> {
		await Deno.mkdir(this.paths.logs, { recursive: true });
		await Deno.mkdir(this.paths.data, { recursive: true });
		await Deno.mkdir(this.paths.backups, { recursive: true });
		await Deno.mkdir(this.paths.databases, { recursive: true });
	}

	/**
	 * Set the base path for the application
	 */
	setBasePath(path: string): void {
		this.basePath = path;
	}

	/**
	 * Application paths (relative to base)
	 */
	readonly paths = {
		get base(): string {
			return config.basePath;
		},
		get logs(): string {
			return `${config.basePath}/logs`;
		},
		get logFile(): string {
			return `${config.basePath}/logs/app.log`;
		},
		get data(): string {
			return `${config.basePath}/data`;
		},
		get database(): string {
			return `${config.basePath}/data/profilarr.db`;
		},
		get databases(): string {
			return `${config.basePath}/data/databases`;
		},
		get backups(): string {
			return `${config.basePath}/backups`;
		}
	};
}

export const config = new Config();
