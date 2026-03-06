import { BaseHttpClient } from '../http/client.ts';
import type {
	ArrSystemStatus,
	ArrHealthItem,
	ArrDelayProfile,
	ArrTag,
	ArrMediaManagementConfig,
	ArrNamingConfig,
	ArrQualityDefinition,
	ArrCustomFormat,
	ArrQualityProfilePayload,
	ArrQualityProfile,
	ArrCommand,
	ArrLogResponse,
	ArrLogFile,
	ArrLogParams,
	CustomFormatRef,
	QualityProfileFormatItem,
	ScoreBreakdownItem
} from './types.ts';
import { logger } from '$logger/logger.ts';

/**
 * Base client for all *arr applications
 * Extends BaseHttpClient with arr-specific features
 */
export interface ArrClientOptions {
	timeout?: number;
	retries?: number;
}

export class BaseArrClient extends BaseHttpClient {
	private apiKey: string;
	protected apiVersion: string = 'v3'; // Default to v3, can be overridden by subclasses

	constructor(url: string, apiKey: string, options?: ArrClientOptions) {
		super(url, {
			headers: {
				'X-Api-Key': apiKey
			},
			timeout: options?.timeout,
			retries: options?.retries
		});
		this.apiKey = apiKey;
	}

	/**
	 * Compute score breakdown for custom formats against a profile's format items
	 */
	protected computeScoreBreakdown(
		customFormats: CustomFormatRef[],
		profileFormatItems: QualityProfileFormatItem[]
	): ScoreBreakdownItem[] {
		return customFormats.map((cf) => {
			const profileItem = profileFormatItems.find((fi) => fi.format === cf.id);
			return {
				name: cf.name,
				score: profileItem?.score ?? 0
			};
		});
	}

	/**
	 * Test connection to the arr instance
	 * Calls /api/{version}/system/status endpoint
	 * Note: This method has built-in retry logic (3 attempts by default)
	 * @returns true if connection successful, false otherwise
	 */
	async testConnection(): Promise<boolean> {
		try {
			const status = await this.get<ArrSystemStatus>(`/api/${this.apiVersion}/system/status`);

			await logger.info(`Connection successful to ${this.baseUrl}`, {
				source: 'BaseArrClient',
				meta: {
					appName: status.appName,
					version: status.version,
					osName: status.osName
				}
			});

			return true;
		} catch (error) {
			// Only log after all retries are exhausted
			await logger.error(`Connection failed to ${this.baseUrl} after retries`, {
				source: 'BaseArrClient',
				meta: error
			});

			return false;
		}
	}

	/**
	 * Get health check items from the arr instance
	 */
	getHealth(): Promise<ArrHealthItem[]> {
		return this.get<ArrHealthItem[]>(`/api/${this.apiVersion}/health`);
	}

	// =========================================================================
	// Delay Profiles
	// =========================================================================

	/**
	 * Get all delay profiles
	 */
	getDelayProfiles(): Promise<ArrDelayProfile[]> {
		return this.get<ArrDelayProfile[]>(`/api/${this.apiVersion}/delayprofile`);
	}

	/**
	 * Get a delay profile by ID
	 */
	getDelayProfile(id: number): Promise<ArrDelayProfile> {
		return this.get<ArrDelayProfile>(`/api/${this.apiVersion}/delayprofile/${id}`);
	}

	/**
	 * Create a new delay profile
	 */
	createDelayProfile(profile: Omit<ArrDelayProfile, 'id' | 'order'>): Promise<ArrDelayProfile> {
		return this.post<ArrDelayProfile>(`/api/${this.apiVersion}/delayprofile`, profile);
	}

	/**
	 * Update an existing delay profile
	 */
	updateDelayProfile(id: number, profile: ArrDelayProfile): Promise<ArrDelayProfile> {
		return this.put<ArrDelayProfile>(`/api/${this.apiVersion}/delayprofile/${id}`, profile);
	}

	/**
	 * Delete a delay profile
	 */
	deleteDelayProfile(id: number): Promise<void> {
		return this.delete(`/api/${this.apiVersion}/delayprofile/${id}`);
	}

	// =========================================================================
	// Tags
	// =========================================================================

	/**
	 * Get all tags
	 */
	getTags(): Promise<ArrTag[]> {
		return this.get<ArrTag[]>(`/api/${this.apiVersion}/tag`);
	}

	/**
	 * Create a new tag
	 */
	createTag(label: string): Promise<ArrTag> {
		return this.post<ArrTag>(`/api/${this.apiVersion}/tag`, { label });
	}

	// =========================================================================
	// Media Management Config
	// =========================================================================

	/**
	 * Get media management config
	 */
	getMediaManagementConfig(): Promise<ArrMediaManagementConfig> {
		return this.get<ArrMediaManagementConfig>(`/api/${this.apiVersion}/config/mediamanagement`);
	}

	/**
	 * Update media management config
	 * Note: Must PUT to /{id} endpoint
	 */
	updateMediaManagementConfig(config: ArrMediaManagementConfig): Promise<ArrMediaManagementConfig> {
		return this.put<ArrMediaManagementConfig>(
			`/api/${this.apiVersion}/config/mediamanagement/${config.id}`,
			config
		);
	}

	// =========================================================================
	// Naming Config
	// =========================================================================

	/**
	 * Get naming config
	 */
	getNamingConfig(): Promise<ArrNamingConfig> {
		return this.get<ArrNamingConfig>(`/api/${this.apiVersion}/config/naming`);
	}

	/**
	 * Update naming config
	 * Note: Must PUT to /{id} endpoint
	 */
	updateNamingConfig(config: ArrNamingConfig): Promise<ArrNamingConfig> {
		return this.put<ArrNamingConfig>(`/api/${this.apiVersion}/config/naming/${config.id}`, config);
	}

	// =========================================================================
	// Quality Definitions
	// =========================================================================

	/**
	 * Get all quality definitions
	 */
	getQualityDefinitions(): Promise<ArrQualityDefinition[]> {
		return this.get<ArrQualityDefinition[]>(`/api/${this.apiVersion}/qualitydefinition`);
	}

	/**
	 * Update all quality definitions
	 * Note: PUT to /update endpoint with full array
	 */
	updateQualityDefinitions(definitions: ArrQualityDefinition[]): Promise<ArrQualityDefinition[]> {
		return this.put<ArrQualityDefinition[]>(
			`/api/${this.apiVersion}/qualitydefinition/update`,
			definitions
		);
	}

	// =========================================================================
	// Custom Formats
	// =========================================================================

	/**
	 * Get all custom formats
	 */
	getCustomFormats(): Promise<ArrCustomFormat[]> {
		return this.get<ArrCustomFormat[]>(`/api/${this.apiVersion}/customformat`);
	}

	/**
	 * Get a custom format by ID
	 */
	getCustomFormat(id: number): Promise<ArrCustomFormat> {
		return this.get<ArrCustomFormat>(`/api/${this.apiVersion}/customformat/${id}`);
	}

	/**
	 * Create a new custom format
	 */
	createCustomFormat(format: Omit<ArrCustomFormat, 'id'>): Promise<ArrCustomFormat> {
		return this.post<ArrCustomFormat>(`/api/${this.apiVersion}/customformat`, format);
	}

	/**
	 * Update an existing custom format
	 */
	updateCustomFormat(id: number, format: ArrCustomFormat): Promise<ArrCustomFormat> {
		return this.put<ArrCustomFormat>(`/api/${this.apiVersion}/customformat/${id}`, format);
	}

	/**
	 * Delete a custom format
	 */
	deleteCustomFormat(id: number): Promise<void> {
		return this.delete(`/api/${this.apiVersion}/customformat/${id}`);
	}

	// =========================================================================
	// Quality Profiles
	// =========================================================================

	/**
	 * Get all quality profiles
	 */
	getQualityProfiles(): Promise<ArrQualityProfile[]> {
		return this.get<ArrQualityProfile[]>(`/api/${this.apiVersion}/qualityprofile`);
	}

	/**
	 * Get a quality profile by ID
	 */
	getQualityProfile(id: number): Promise<ArrQualityProfile> {
		return this.get<ArrQualityProfile>(`/api/${this.apiVersion}/qualityprofile/${id}`);
	}

	/**
	 * Create a new quality profile
	 */
	createQualityProfile(profile: ArrQualityProfilePayload): Promise<ArrQualityProfile> {
		return this.post<ArrQualityProfile>(`/api/${this.apiVersion}/qualityprofile`, profile);
	}

	/**
	 * Update an existing quality profile
	 */
	updateQualityProfile(id: number, profile: ArrQualityProfilePayload): Promise<ArrQualityProfile> {
		return this.put<ArrQualityProfile>(`/api/${this.apiVersion}/qualityprofile/${id}`, profile);
	}

	/**
	 * Delete a quality profile
	 */
	deleteQualityProfile(id: number): Promise<void> {
		return this.delete(`/api/${this.apiVersion}/qualityprofile/${id}`);
	}

	// =========================================================================
	// Command Methods
	// =========================================================================

	/**
	 * Get all commands (active and recent)
	 */
	getCommands(): Promise<ArrCommand[]> {
		return this.get<ArrCommand[]>(`/api/${this.apiVersion}/command`);
	}

	/**
	 * Get command status by ID
	 * Used to poll async operations like rename, refresh, etc.
	 */
	getCommand(commandId: number): Promise<ArrCommand> {
		return this.get<ArrCommand>(`/api/${this.apiVersion}/command/${commandId}`);
	}

	/**
	 * Wait for a command to complete.
	 * Polls as long as the command is alive (queued/started). Logs a warning
	 * every 10 minutes of no status change. Hard ceiling at 60 minutes.
	 */
	async waitForCommand(commandId: number): Promise<ArrCommand> {
		const MAX_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes
		const STALE_WARN_MS = 10 * 60 * 1000; // warn every 10 minutes of no change
		const initialInterval = 500;
		const maxInterval = 5000;
		let currentInterval = initialInterval;
		let pollCount = 0;
		const startTime = Date.now();
		let lastStatus = '';
		let lastStatusChangeTime = startTime;

		while (true) {
			pollCount++;
			let command: ArrCommand;

			try {
				command = await this.getCommand(commandId);
			} catch {
				throw new Error(`Command ${commandId} disappeared (not found after ${pollCount} polls)`);
			}

			const elapsed = Date.now() - startTime;

			// Track status changes for stale detection
			if (command.status !== lastStatus) {
				lastStatus = command.status;
				lastStatusChangeTime = Date.now();
			}

			await logger.debug(
				`Polling command ${commandId}: status=${command.status} (poll #${pollCount}, ${elapsed}ms elapsed)`,
				{
					source: 'BaseArrClient',
					meta: { commandId, status: command.status, pollCount, elapsedMs: elapsed }
				}
			);

			if (command.status === 'completed') {
				await logger.debug(
					`Command ${commandId} completed after ${pollCount} polls (${elapsed}ms)`,
					{
						source: 'BaseArrClient',
						meta: { commandId, pollCount, elapsedMs: elapsed, message: command.message }
					}
				);
				return command;
			}

			if (command.status === 'failed') {
				throw new Error(`Command ${commandId} failed: ${command.message || 'Unknown error'}`);
			}

			// Warn if status hasn't changed in a while
			const staleDuration = Date.now() - lastStatusChangeTime;
			if (staleDuration >= STALE_WARN_MS && staleDuration % STALE_WARN_MS < currentInterval) {
				await logger.warn(
					`Command ${commandId} has been "${command.status}" for ${Math.floor(staleDuration / 60000)} minutes`,
					{
						source: 'BaseArrClient',
						meta: {
							commandId,
							status: command.status,
							staleMinutes: Math.floor(staleDuration / 60000)
						}
					}
				);
			}

			// Hard ceiling
			if (elapsed >= MAX_TIMEOUT_MS) {
				throw new Error(`Command ${commandId} timed out after 60 minutes (${pollCount} polls)`);
			}

			await new Promise((resolve) => setTimeout(resolve, currentInterval));
			currentInterval = Math.min(currentInterval * 2, maxInterval);
		}
	}

	// =========================================================================
	// Log Methods
	// =========================================================================

	/**
	 * Get paginated logs from the arr instance
	 * @param params - Query parameters for filtering and pagination
	 */
	getLogs(params: ArrLogParams = {}): Promise<ArrLogResponse> {
		const queryParams = new URLSearchParams();

		if (params.page !== undefined) queryParams.set('page', String(params.page));
		if (params.pageSize !== undefined) queryParams.set('pageSize', String(params.pageSize));
		if (params.sortKey) queryParams.set('sortKey', params.sortKey);
		if (params.sortDirection) queryParams.set('sortDirection', params.sortDirection);
		if (params.level) queryParams.set('level', params.level);

		const queryString = queryParams.toString();
		const url = `/api/${this.apiVersion}/log${queryString ? `?${queryString}` : ''}`;

		return this.get<ArrLogResponse>(url);
	}

	/**
	 * Get list of available log files
	 */
	getLogFiles(): Promise<ArrLogFile[]> {
		return this.get<ArrLogFile[]>(`/api/${this.apiVersion}/log/file`);
	}

	/**
	 * Get raw content of a specific log file
	 * @param filename - The log filename (e.g., "radarr.txt", "sonarr.debug.0.txt")
	 * @returns Raw log file content as text
	 */
	getLogFileContent(filename: string): Promise<string> {
		return this.get<string>(`/api/${this.apiVersion}/log/file/${filename}`, {
			responseType: 'text'
		});
	}
}
