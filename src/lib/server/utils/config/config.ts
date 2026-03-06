/**
 * Application configuration singleton
 */

export type AuthMode = 'on' | 'off' | 'oidc';

class Config {
	private basePath: string;
	public readonly timezone: string;
	public readonly parserUrl: string;
	public readonly port: number;
	public readonly host: string;
	public readonly origin: string;
	public readonly authMode: AuthMode;
	public readonly oidc: {
		discoveryUrl: string | null;
		clientId: string | null;
		clientSecret: string | null;
	};

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
		// Falls back to the local server URL when unset.
		this.origin = Deno.env.get('ORIGIN') || this.serverUrl;

		// Auth mode: 'on' (default), 'off', 'oidc'
		// Note: AUTH=local is no longer an env var — use the local bypass toggle in Settings > Security
		const auth = (Deno.env.get('AUTH') || 'on').toLowerCase();
		this.authMode = ['on', 'off', 'oidc'].includes(auth) ? (auth as AuthMode) : 'on';

		// OIDC configuration (only used when AUTH=oidc)
		this.oidc = {
			discoveryUrl: Deno.env.get('OIDC_DISCOVERY_URL') || null,
			clientId: Deno.env.get('OIDC_CLIENT_ID') || null,
			clientSecret: Deno.env.get('OIDC_CLIENT_SECRET') || null
		};
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
