/**
 * Typed readers for the Media Management pages: naming, media settings and
 * quality definitions. Each returns what the page's server load sent, typed
 * with the app's own types. Fields keep the app's names, which follow the PCD
 * schema (`colon_replacement_format`, `min_size`).
 *
 * Radarr and Sonarr configs differ, so naming and media settings have one
 * reader per Arr. Sonarr's colon replacement and multi-episode style arrive
 * as words, though the database stores numbers (see SONARR_WORDS).
 */

import type { Page } from '@playwright/test';
import type {
	MediaSettingsListItem,
	NamingListItem,
	QualityDefinitionListItem,
	QualityDefinitionsConfig,
	RadarrMediaSettingsRow,
	RadarrNamingRow,
	SonarrMediaSettingsRow,
	SonarrNamingRow
} from '#shared/pcd/display.ts';
import { pageData } from '#flows/helpers/core/pageData.ts';

export interface QualityDefinitionsPage {
	config: QualityDefinitionsConfig;
	/** Qualities this Arr has, so the config can size them */
	availableQualities: string[];
}

export const namingPages = {
	/** Every naming config, Radarr and Sonarr, `/media-management/{databaseId}/naming` */
	async list(page: Page, path?: string): Promise<NamingListItem[]> {
		const data = await pageData<{ namingConfigs: NamingListItem[] }>(page, path);
		return data.namingConfigs;
	},

	/** A Radarr naming config, `/media-management/{databaseId}/naming/radarr/{name}` */
	async radarr(page: Page, path?: string): Promise<RadarrNamingRow> {
		const data = await pageData<{ namingConfig: RadarrNamingRow }>(page, path);
		return data.namingConfig;
	},

	/** A Sonarr naming config, `/media-management/{databaseId}/naming/sonarr/{name}` */
	async sonarr(page: Page, path?: string): Promise<SonarrNamingRow> {
		const data = await pageData<{ namingConfig: SonarrNamingRow }>(page, path);
		return data.namingConfig;
	}
};

export const mediaSettingsPages = {
	/** Every media settings config, `/media-management/{databaseId}/media-settings` */
	async list(page: Page, path?: string): Promise<MediaSettingsListItem[]> {
		const data = await pageData<{ mediaSettingsConfigs: MediaSettingsListItem[] }>(page, path);
		return data.mediaSettingsConfigs;
	},

	/** A Radarr config, `/media-management/{databaseId}/media-settings/radarr/{name}` */
	async radarr(page: Page, path?: string): Promise<RadarrMediaSettingsRow> {
		const data = await pageData<{ mediaSettingsConfig: RadarrMediaSettingsRow }>(page, path);
		return data.mediaSettingsConfig;
	},

	/** A Sonarr config, `/media-management/{databaseId}/media-settings/sonarr/{name}` */
	async sonarr(page: Page, path?: string): Promise<SonarrMediaSettingsRow> {
		const data = await pageData<{ mediaSettingsConfig: SonarrMediaSettingsRow }>(page, path);
		return data.mediaSettingsConfig;
	}
};

export const qualityDefinitionsPages = {
	/** Every quality definitions config, `/media-management/{databaseId}/quality-definitions` */
	async list(page: Page, path?: string): Promise<QualityDefinitionListItem[]> {
		const data = await pageData<{ qualityDefinitionsConfigs: QualityDefinitionListItem[] }>(
			page,
			path
		);
		return data.qualityDefinitionsConfigs;
	},

	/** One config, Radarr or Sonarr, `/media-management/{databaseId}/quality-definitions/{arr}/{name}` */
	async entity(page: Page, path?: string): Promise<QualityDefinitionsPage> {
		const data = await pageData<{
			qualityDefinitionsConfig: QualityDefinitionsConfig;
			availableQualities: string[];
		}>(page, path);
		return { config: data.qualityDefinitionsConfig, availableQualities: data.availableQualities };
	}
};
