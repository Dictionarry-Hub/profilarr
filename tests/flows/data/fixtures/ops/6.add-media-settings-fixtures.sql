-- @operation: export
-- @entity: batch
-- @name: add media settings fixtures
-- @exportedAt: 2026-10-22T09:59:40.951Z
-- @opIds: 3047, 3048

-- --- BEGIN op 3047 ( create radarr_media_settings "Fixture Radarr" )
insert into "radarr_media_settings" ("name", "propers_repacks", "enable_media_info") values ('Fixture Radarr', 'preferAndUpgrade', 1);
-- --- END op 3047

-- --- BEGIN op 3048 ( create sonarr_media_settings "Fixture Sonarr" )
insert into "sonarr_media_settings" ("name", "propers_repacks", "enable_media_info") values ('Fixture Sonarr', 'doNotUpgradeAutomatically', 0);
-- --- END op 3048
