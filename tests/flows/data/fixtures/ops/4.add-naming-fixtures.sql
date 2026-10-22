-- @operation: export
-- @entity: batch
-- @name: add naming fixtures
-- @exportedAt: 2026-10-22T09:56:08.339Z
-- @opIds: 3040, 3041

-- --- BEGIN op 3040 ( create radarr_naming "Fixture Radarr" )
insert into "radarr_naming" ("name", "rename", "movie_format", "movie_folder_format", "replace_illegal_characters", "colon_replacement_format") values ('Fixture Radarr', 1, '{Movie CleanTitle} ({Release Year}) [{Quality Full}]', '{Movie CleanTitle} ({Release Year}) {tmdb-{TmdbId}}', 1, 'spaceDashSpace');
-- --- END op 3040

-- --- BEGIN op 3041 ( create sonarr_naming "Fixture Sonarr" )
insert into "sonarr_naming" ("name", "rename", "standard_episode_format", "daily_episode_format", "anime_episode_format", "series_folder_format", "season_folder_format", "replace_illegal_characters", "colon_replacement_format", "custom_colon_replacement_format", "multi_episode_style") values ('Fixture Sonarr', 1, '{Series TitleYear} - S{season:00}E{episode:00} - {Episode CleanTitle} [{Quality Full}]{Series CleanTitle}', '{Series TitleYear} - {Air-Date} - {Episode CleanTitle}{Series CleanTitle}', '{Series TitleYear} - {absolute:000} - {Episode CleanTitle}{Series TitleYear}', '{Series TitleYear}', 'Season {season:00}', 1, 4, NULL, 5);
-- --- END op 3041
