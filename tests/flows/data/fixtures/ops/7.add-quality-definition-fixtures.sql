-- @operation: export
-- @entity: batch
-- @name: add quality definition fixtures
-- @exportedAt: 2026-10-22T10:02:42.448Z
-- @opIds: 3050, 3051

-- --- BEGIN op 3050 ( create radarr_quality_definitions "Fixture Radarr" )
insert into "radarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Radarr', 'Bluray-1080p', 20, 100, 60);

insert into "radarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Radarr', 'Bluray-2160p', 0, 0, 0);

insert into "radarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Radarr', 'Bluray-480p', 0, 0, 0);

insert into "radarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Radarr', 'Bluray-576p', 0, 0, 0);

insert into "radarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Radarr', 'Bluray-720p', 0, 0, 0);

insert into "radarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Radarr', 'BR-DISK', 0, 0, 0);

insert into "radarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Radarr', 'CAM', 0, 0, 0);

insert into "radarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Radarr', 'DVD', 0, 0, 0);

insert into "radarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Radarr', 'DVD-R', 0, 0, 0);

insert into "radarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Radarr', 'DVDSCR', 0, 0, 0);

insert into "radarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Radarr', 'HDTV-1080p', 0, 0, 0);

insert into "radarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Radarr', 'HDTV-2160p', 0, 0, 0);

insert into "radarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Radarr', 'HDTV-720p', 0, 0, 0);

insert into "radarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Radarr', 'Raw-HD', 0, 0, 0);

insert into "radarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Radarr', 'REGIONAL', 0, 0, 0);

insert into "radarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Radarr', 'Remux-1080p', 0, 0, 0);

insert into "radarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Radarr', 'Remux-2160p', 100, 0, 1500);

insert into "radarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Radarr', 'SDTV', 0, 0, 0);

insert into "radarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Radarr', 'TELECINE', 0, 0, 0);

insert into "radarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Radarr', 'TELESYNC', 0, 0, 0);

insert into "radarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Radarr', 'Unknown', 0, 0, 0);

insert into "radarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Radarr', 'WEBDL-1080p', 11, 80, 40);

insert into "radarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Radarr', 'WEBDL-2160p', 0, 0, 0);

insert into "radarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Radarr', 'WEBDL-480p', 0, 0, 0);

insert into "radarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Radarr', 'WEBDL-720p', 0, 0, 0);

insert into "radarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Radarr', 'WEBRip-1080p', 0, 0, 0);

insert into "radarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Radarr', 'WEBRip-2160p', 0, 0, 0);

insert into "radarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Radarr', 'WEBRip-480p', 0, 0, 0);

insert into "radarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Radarr', 'WEBRip-720p', 0, 0, 0);

insert into "radarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Radarr', 'WORKPRINT', 0, 0, 0);
-- --- END op 3050

-- --- BEGIN op 3051 ( create sonarr_quality_definitions "Fixture Sonarr" )
insert into "sonarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Sonarr', 'Bluray-1080p', 0, 0, 0);

insert into "sonarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Sonarr', 'Bluray-2160p', 50, 0, 500);

insert into "sonarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Sonarr', 'Bluray-480p', 0, 0, 0);

insert into "sonarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Sonarr', 'Bluray-576p', 0, 0, 0);

insert into "sonarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Sonarr', 'Bluray-720p', 0, 0, 0);

insert into "sonarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Sonarr', 'DVD', 0, 0, 0);

insert into "sonarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Sonarr', 'HDTV-1080p', 0, 0, 0);

insert into "sonarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Sonarr', 'HDTV-2160p', 0, 0, 0);

insert into "sonarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Sonarr', 'HDTV-720p', 3, 30, 15);

insert into "sonarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Sonarr', 'Raw-HD', 0, 0, 0);

insert into "sonarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Sonarr', 'Remux-1080p', 0, 0, 0);

insert into "sonarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Sonarr', 'Remux-2160p', 0, 0, 0);

insert into "sonarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Sonarr', 'SDTV', 0, 0, 0);

insert into "sonarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Sonarr', 'Unknown', 0, 0, 0);

insert into "sonarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Sonarr', 'WEBDL-1080p', 5, 60, 30);

insert into "sonarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Sonarr', 'WEBDL-2160p', 0, 0, 0);

insert into "sonarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Sonarr', 'WEBDL-480p', 0, 0, 0);

insert into "sonarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Sonarr', 'WEBDL-720p', 0, 0, 0);

insert into "sonarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Sonarr', 'WEBRip-1080p', 0, 0, 0);

insert into "sonarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Sonarr', 'WEBRip-2160p', 0, 0, 0);

insert into "sonarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Sonarr', 'WEBRip-480p', 0, 0, 0);

insert into "sonarr_quality_definitions" ("name", "quality_name", "min_size", "max_size", "preferred_size") values ('Fixture Sonarr', 'WEBRip-720p', 0, 0, 0);
-- --- END op 3051
