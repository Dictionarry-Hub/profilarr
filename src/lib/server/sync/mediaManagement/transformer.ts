import type { ArrMediaManagementConfig, ArrPropersAndRepacks } from '$arr/types.ts';
import type { RadarrMediaSettingsRow, SonarrMediaSettingsRow } from '$shared/pcd/display.ts';

export interface ArrMediaSettingsManagedFields {
	downloadPropersAndRepacks: ArrPropersAndRepacks;
	enableMediaInfo: boolean;
}

type PcdMediaSettings = Pick<
	RadarrMediaSettingsRow | SonarrMediaSettingsRow,
	'propers_repacks' | 'enable_media_info'
>;

export function transformMediaSettings(
	mediaSettings: PcdMediaSettings
): ArrMediaSettingsManagedFields {
	return {
		downloadPropersAndRepacks: mapPropersRepacks(mediaSettings.propers_repacks),
		enableMediaInfo: mediaSettings.enable_media_info
	};
}

export function mergeMediaSettingsConfig(
	existing: ArrMediaManagementConfig,
	mediaSettings: PcdMediaSettings
): ArrMediaManagementConfig {
	return {
		...existing,
		...transformMediaSettings(mediaSettings)
	};
}

function mapPropersRepacks(pcdValue: string): ArrPropersAndRepacks {
	const mapping: Record<string, ArrPropersAndRepacks> = {
		doNotPrefer: 'doNotPrefer',
		preferAndUpgrade: 'preferAndUpgrade',
		doNotUpgradeAutomatically: 'doNotUpgrade'
	};
	return mapping[pcdValue] ?? 'doNotPrefer';
}
