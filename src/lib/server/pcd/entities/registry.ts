export type AutoAlignEntity = {
	table: string;
	keyColumn: string;
	fields: string[];
};

const NAMING_FIELDS = [
	'name',
	'rename',
	'movie_format',
	'movie_folder_format',
	'replace_illegal_characters',
	'colon_replacement_format'
];
const SONARR_NAMING_FIELDS = [
	...NAMING_FIELDS,
	'standard_episode_format',
	'daily_episode_format',
	'anime_episode_format',
	'series_folder_format',
	'season_folder_format',
	'custom_colon_replacement_format',
	'multi_episode_style'
];
const MEDIA_SETTINGS_FIELDS = ['name', 'propers_repacks', 'enable_media_info'];

export const AUTO_ALIGN_ENTITIES = new Map<string, AutoAlignEntity>([
	[
		'quality_profile',
		{
			table: 'quality_profiles',
			keyColumn: 'name',
			fields: [
				'name',
				'description',
				'upgrades_allowed',
				'minimum_custom_format_score',
				'upgrade_until_score',
				'upgrade_score_increment'
			]
		}
	],
	[
		'custom_format',
		{
			table: 'custom_formats',
			keyColumn: 'name',
			fields: ['name', 'description', 'include_in_rename']
		}
	],
	[
		'regular_expression',
		{
			table: 'regular_expressions',
			keyColumn: 'name',
			fields: ['name', 'pattern', 'regex101_id', 'description']
		}
	],
	[
		'delay_profile',
		{
			table: 'delay_profiles',
			keyColumn: 'name',
			fields: [
				'name',
				'preferred_protocol',
				'usenet_delay',
				'torrent_delay',
				'bypass_if_highest_quality',
				'bypass_if_above_custom_format_score',
				'minimum_custom_format_score'
			]
		}
	],
	['radarr_naming', { table: 'radarr_naming', keyColumn: 'name', fields: NAMING_FIELDS }],
	['sonarr_naming', { table: 'sonarr_naming', keyColumn: 'name', fields: SONARR_NAMING_FIELDS }],
	[
		'radarr_media_settings',
		{ table: 'radarr_media_settings', keyColumn: 'name', fields: MEDIA_SETTINGS_FIELDS }
	],
	[
		'sonarr_media_settings',
		{ table: 'sonarr_media_settings', keyColumn: 'name', fields: MEDIA_SETTINGS_FIELDS }
	]
]);
