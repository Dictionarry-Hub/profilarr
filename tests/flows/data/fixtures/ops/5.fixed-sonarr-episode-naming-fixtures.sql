-- @operation: export
-- @entity: batch
-- @name: fixed sonarr episode naming fixtures
-- @exportedAt: 2026-10-22T09:57:20.643Z
-- @opIds: 3043, 3044, 3045

-- --- BEGIN op 3043 ( update sonarr_naming "Fixture Sonarr" )
update "sonarr_naming" set "standard_episode_format" = '{Series TitleYear} - S{season:00}E{episode:00} - {Episode CleanTitle} [{Quality Full}]' where "name" = 'Fixture Sonarr' and "standard_episode_format" = '{Series TitleYear} - S{season:00}E{episode:00} - {Episode CleanTitle} [{Quality Full}]{Series CleanTitle}';
-- --- END op 3043

-- --- BEGIN op 3044 ( update sonarr_naming "Fixture Sonarr" )
update "sonarr_naming" set "daily_episode_format" = '{Series TitleYear} - {Air-Date} - {Episode CleanTitle}' where "name" = 'Fixture Sonarr' and "daily_episode_format" = '{Series TitleYear} - {Air-Date} - {Episode CleanTitle}{Series CleanTitle}';
-- --- END op 3044

-- --- BEGIN op 3045 ( update sonarr_naming "Fixture Sonarr" )
update "sonarr_naming" set "anime_episode_format" = '{Series TitleYear} - {absolute:000} - {Episode CleanTitle}' where "name" = 'Fixture Sonarr' and "anime_episode_format" = '{Series TitleYear} - {absolute:000} - {Episode CleanTitle}{Series TitleYear}';
-- --- END op 3045
