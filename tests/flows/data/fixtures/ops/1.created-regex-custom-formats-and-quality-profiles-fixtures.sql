-- @operation: export
-- @entity: batch
-- @name: created regex, custom formats and quality profiles fixtures
-- @exportedAt: 2026-10-22T09:46:20.720Z
-- @opIds: 2987, 2988, 2989, 2990, 2991, 2992, 2993, 2994, 2995, 2996, 2997, 2998, 2999, 3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010, 3011, 3012, 3013, 3014, 3016, 3017, 3018, 3019, 3020, 3021, 3022, 3023, 3024, 3025, 3026, 3027, 3028, 3029, 3030, 3031

-- --- BEGIN op 2987 ( create regular_expression "Title Regex" )
insert into "regular_expressions" ("name", "pattern", "description", "regex101_id") values ('Title Regex', '\bFixtureTitle\b', 'Matches the word **FixtureTitle** in a release title.', NULL);

insert into "tags" ("name") values ('alpha') on conflict ("name") do nothing;

INSERT INTO regular_expression_tags (regular_expression_name, tag_name) VALUES ('Title Regex', 'alpha');
-- --- END op 2987

-- --- BEGIN op 2988 ( create regular_expression "Group Regex" )
insert into "regular_expressions" ("name", "pattern", "description", "regex101_id") values ('Group Regex', '\bFXGRP\b', 'Matches the release group FXGRP.', NULL);

insert into "tags" ("name") values ('beta') on conflict ("name") do nothing;

INSERT INTO regular_expression_tags (regular_expression_name, tag_name) VALUES ('Group Regex', 'beta');
-- --- END op 2988

-- --- BEGIN op 2989 ( create regular_expression "Unused Regex" )
insert into "regular_expressions" ("name", "pattern", "description", "regex101_id") values ('Unused Regex', '\bUnusedPattern\b', NULL, NULL);
-- --- END op 2989

-- --- BEGIN op 2990 ( create custom_format "Title Match" )
insert into "custom_formats" ("name", "description") values ('Title Match', '');
-- --- END op 2990

-- --- BEGIN op 2991 ( update custom_format "Title Match" )
update "custom_formats" set "description" = 'Scores releases whose title contains FixtureTitle.' where "name" = 'Title Match' and "description" = '';
-- --- END op 2991

-- --- BEGIN op 2992 ( update custom_format "Title Match" )
update "custom_formats" set "include_in_rename" = 1 where "name" = 'Title Match' and "include_in_rename" = 0;
-- --- END op 2992

-- --- BEGIN op 2993 ( update custom_format "Title Match" )
insert into "tags" ("name") values ('alpha') on conflict ("name") do nothing;

insert into "custom_format_tags" ("custom_format_name", "tag_name") values ('Title Match', 'alpha');
-- --- END op 2993

-- --- BEGIN op 2994 ( create custom_format "Every Condition" )
insert into "custom_formats" ("name", "description") values ('Every Condition', '');
-- --- END op 2994

-- --- BEGIN op 2995 ( update custom_format "Every Condition" )
update "custom_formats" set "description" = 'Has one condition of every type.' where "name" = 'Every Condition' and "description" = '';
-- --- END op 2995

-- --- BEGIN op 2996 ( update custom_format "Every Condition" )
insert into "tags" ("name") values ('beta') on conflict ("name") do nothing;

insert into "custom_format_tags" ("custom_format_name", "tag_name") values ('Every Condition', 'beta');
-- --- END op 2996

-- --- BEGIN op 2997 ( create custom_format "Has Tests" )
insert into "custom_formats" ("name", "description") values ('Has Tests', '');
-- --- END op 2997

-- --- BEGIN op 2998 ( create custom_format "Unscored" )
insert into "custom_formats" ("name", "description") values ('Unscored', '');
-- --- END op 2998

-- --- BEGIN op 2999 ( update custom_format "Title Match" )
INSERT INTO custom_format_conditions (custom_format_name, name, type, arr_type, negate, required)
VALUES ('Title Match', 'Title Regex', 'release_title', 'all', 0, 0);

INSERT INTO condition_patterns (custom_format_name, condition_name, regular_expression_name) VALUES ('Title Match', 'Title Regex', 'Title Regex');
-- --- END op 2999

-- --- BEGIN op 3000 ( update custom_format "Every Condition" )
INSERT INTO custom_format_conditions (custom_format_name, name, type, arr_type, negate, required)
VALUES ('Every Condition', 'Title', 'release_title', 'all', 0, 1);

INSERT INTO condition_patterns (custom_format_name, condition_name, regular_expression_name) VALUES ('Every Condition', 'Title', 'Title Regex');
-- --- END op 3000

-- --- BEGIN op 3001 ( update custom_format "Every Condition" )
INSERT INTO custom_format_conditions (custom_format_name, name, type, arr_type, negate, required)
VALUES ('Every Condition', 'Group', 'release_group', 'all', 0, 0);

INSERT INTO condition_patterns (custom_format_name, condition_name, regular_expression_name) VALUES ('Every Condition', 'Group', 'Group Regex');
-- --- END op 3001

-- --- BEGIN op 3002 ( update custom_format "Every Condition" )
INSERT INTO custom_format_conditions (custom_format_name, name, type, arr_type, negate, required)
VALUES ('Every Condition', 'Edition', 'edition', 'radarr', 0, 0);

INSERT INTO condition_patterns (custom_format_name, condition_name, regular_expression_name) VALUES ('Every Condition', 'Edition', 'Title Regex');
-- --- END op 3002

-- --- BEGIN op 3003 ( update custom_format "Every Condition" )
INSERT INTO custom_format_conditions (custom_format_name, name, type, arr_type, negate, required)
VALUES ('Every Condition', 'Language', 'language', 'all', 1, 0);

INSERT INTO condition_languages (custom_format_name, condition_name, language_name, except_language) VALUES ('Every Condition', 'Language', 'French', 0);
-- --- END op 3003

-- --- BEGIN op 3004 ( update custom_format "Every Condition" )
INSERT INTO custom_format_conditions (custom_format_name, name, type, arr_type, negate, required)
VALUES ('Every Condition', 'Source', 'source', 'all', 0, 0);

INSERT INTO condition_sources (custom_format_name, condition_name, source) VALUES ('Every Condition', 'Source', 'bluray');
-- --- END op 3004

-- --- BEGIN op 3005 ( update custom_format "Every Condition" )
INSERT INTO custom_format_conditions (custom_format_name, name, type, arr_type, negate, required)
VALUES ('Every Condition', 'Resolution', 'resolution', 'all', 0, 0);

INSERT INTO condition_resolutions (custom_format_name, condition_name, resolution) VALUES ('Every Condition', 'Resolution', '2160p');
-- --- END op 3005

-- --- BEGIN op 3006 ( update custom_format "Every Condition" )
INSERT INTO custom_format_conditions (custom_format_name, name, type, arr_type, negate, required)
VALUES ('Every Condition', 'Modifier', 'quality_modifier', 'radarr', 0, 0);

INSERT INTO condition_quality_modifiers (custom_format_name, condition_name, quality_modifier) VALUES ('Every Condition', 'Modifier', 'remux');
-- --- END op 3006

-- --- BEGIN op 3007 ( update custom_format "Every Condition" )
INSERT INTO custom_format_conditions (custom_format_name, name, type, arr_type, negate, required)
VALUES ('Every Condition', 'Release Type', 'release_type', 'sonarr', 0, 0);

INSERT INTO condition_release_types (custom_format_name, condition_name, release_type) VALUES ('Every Condition', 'Release Type', 'season_pack');
-- --- END op 3007

-- --- BEGIN op 3008 ( update custom_format "Every Condition" )
INSERT INTO custom_format_conditions (custom_format_name, name, type, arr_type, negate, required)
VALUES ('Every Condition', 'Indexer Flag', 'indexer_flag', 'all', 0, 0);

INSERT INTO condition_indexer_flags (custom_format_name, condition_name, flag) VALUES ('Every Condition', 'Indexer Flag', 'freeleech');
-- --- END op 3008

-- --- BEGIN op 3009 ( update custom_format "Every Condition" )
INSERT INTO custom_format_conditions (custom_format_name, name, type, arr_type, negate, required)
VALUES ('Every Condition', 'Size', 'size', 'all', 0, 0);

INSERT INTO condition_sizes (custom_format_name, condition_name, min_bytes, max_bytes) VALUES ('Every Condition', 'Size', 1073741824, 53687091200);
-- --- END op 3009

-- --- BEGIN op 3010 ( update custom_format "Every Condition" )
INSERT INTO custom_format_conditions (custom_format_name, name, type, arr_type, negate, required)
VALUES ('Every Condition', 'Year', 'year', 'all', 0, 0);

INSERT INTO condition_years (custom_format_name, condition_name, min_year, max_year) VALUES ('Every Condition', 'Year', 2000, 2030);
-- --- END op 3010

-- --- BEGIN op 3011 ( update custom_format "Has Tests" )
INSERT INTO custom_format_conditions (custom_format_name, name, type, arr_type, negate, required)
VALUES ('Has Tests', 'Title', 'release_title', 'all', 0, 0);

INSERT INTO condition_patterns (custom_format_name, condition_name, regular_expression_name) VALUES ('Has Tests', 'Title', 'Title Regex');
-- --- END op 3011

-- --- BEGIN op 3012 ( create custom_format "Has Tests" )
INSERT INTO custom_format_tests (custom_format_name, title, type, should_match, description) VALUES ('Has Tests', 'Movie.FixtureTitle.2024.1080p.BluRay.x264-FXGRP', 'movie', 1, 'Title contains FixtureTitle.');
-- --- END op 3012

-- --- BEGIN op 3013 ( create custom_format "Has Tests" )
INSERT INTO custom_format_tests (custom_format_name, title, type, should_match, description) VALUES ('Has Tests', 'Movie.Other.2024.1080p.BluRay.x264-FXGRP', 'movie', 0, NULL);
-- --- END op 3013

-- --- BEGIN op 3014 ( update custom_format "Unscored" )
INSERT INTO custom_format_conditions (custom_format_name, name, type, arr_type, negate, required)
VALUES ('Unscored', 'Resolution', 'resolution', 'all', 0, 0);

INSERT INTO condition_resolutions (custom_format_name, condition_name, resolution) VALUES ('Unscored', 'Resolution', '1080p');
-- --- END op 3014

-- --- BEGIN op 3016 ( create quality_profile "Radarr Profile" )
insert into "quality_profiles" ("name", "description", "upgrades_allowed", "minimum_custom_format_score", "upgrade_until_score", "upgrade_score_increment") values ('Radarr Profile', 'Radarr scores, a quality group and non-default upgrade settings.', 1, 0, 0, 1);

insert into "tags" ("name") values ('alpha') on conflict ("name") do nothing;

INSERT INTO quality_profile_tags (quality_profile_name, tag_name) VALUES ('Radarr Profile', 'alpha');

INSERT INTO quality_groups (quality_profile_name, name) VALUES ('Radarr Profile', 'WEB 1080p');

INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Radarr Profile', 'WEB 1080p', 'WEBDL-1080p', 0);

INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Radarr Profile', 'WEB 1080p', 'WEBRip-1080p', 1);

INSERT INTO quality_groups (quality_profile_name, name) VALUES ('Radarr Profile', 'Pre-releases');

INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Radarr Profile', 'Pre-releases', 'REGIONAL', 0);

INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Radarr Profile', 'Pre-releases', 'DVDSCR', 1);

INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Radarr Profile', 'Pre-releases', 'TELECINE', 2);

INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Radarr Profile', 'Pre-releases', 'TELESYNC', 3);

INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Radarr Profile', 'Pre-releases', 'CAM', 4);

INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Radarr Profile', 'Pre-releases', 'WORKPRINT', 5);

INSERT INTO quality_groups (quality_profile_name, name) VALUES ('Radarr Profile', 'Unwanted');

INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Radarr Profile', 'Unwanted', 'Unknown', 0);

INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Radarr Profile', 'Unwanted', 'Raw-HD', 1);

INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Radarr Profile', 'Unwanted', 'BR-DISK', 2);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Radarr Profile', 'Remux-2160p', NULL, 1, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Radarr Profile', 'Bluray-2160p', NULL, 2, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Radarr Profile', 'WEBDL-2160p', NULL, 3, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Radarr Profile', 'WEBRip-2160p', NULL, 4, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Radarr Profile', 'HDTV-2160p', NULL, 5, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Radarr Profile', 'Remux-1080p', NULL, 6, 1, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Radarr Profile', 'Bluray-1080p', NULL, 7, 1, 1);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Radarr Profile', NULL, 'WEB 1080p', 8, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Radarr Profile', 'HDTV-1080p', NULL, 9, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Radarr Profile', 'Bluray-720p', NULL, 10, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Radarr Profile', 'WEBDL-720p', NULL, 11, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Radarr Profile', 'WEBRip-720p', NULL, 12, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Radarr Profile', 'HDTV-720p', NULL, 13, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Radarr Profile', 'Bluray-576p', NULL, 14, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Radarr Profile', 'Bluray-480p', NULL, 15, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Radarr Profile', 'WEBDL-480p', NULL, 16, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Radarr Profile', 'WEBRip-480p', NULL, 17, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Radarr Profile', 'HDTV-480p', NULL, 18, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Radarr Profile', 'DVD-R', NULL, 19, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Radarr Profile', 'DVD', NULL, 20, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Radarr Profile', 'SDTV', NULL, 21, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Radarr Profile', NULL, 'Pre-releases', 22, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Radarr Profile', NULL, 'Unwanted', 23, 0, 0);

INSERT INTO quality_profile_languages (quality_profile_name, language_name, type) VALUES ('Radarr Profile', 'English', 'simple');
-- --- END op 3016

-- --- BEGIN op 3017 ( update quality_profile "Radarr Profile" )
update "quality_profiles" set "minimum_custom_format_score" = 10 where "name" = 'Radarr Profile' and "minimum_custom_format_score" = 0;
-- --- END op 3017

-- --- BEGIN op 3018 ( update quality_profile "Radarr Profile" )
update "quality_profiles" set "upgrade_until_score" = 1000 where "name" = 'Radarr Profile' and "upgrade_until_score" = 0;
-- --- END op 3018

-- --- BEGIN op 3019 ( update quality_profile "Radarr Profile" )
update "quality_profiles" set "upgrade_score_increment" = 5 where "name" = 'Radarr Profile' and "upgrade_score_increment" = 1;
-- --- END op 3019

-- --- BEGIN op 3020 ( update quality_profile "Radarr Profile" )
INSERT INTO quality_profile_custom_formats (quality_profile_name, custom_format_name, arr_type, score)
SELECT 'Radarr Profile', 'Every Condition', 'radarr', 500
WHERE NOT EXISTS (
  SELECT 1 FROM quality_profile_custom_formats
  WHERE quality_profile_name = 'Radarr Profile'
    AND custom_format_name = 'Every Condition'
    AND arr_type = 'radarr'
);
-- --- END op 3020

-- --- BEGIN op 3021 ( update quality_profile "Radarr Profile" )
INSERT INTO quality_profile_custom_formats (quality_profile_name, custom_format_name, arr_type, score)
SELECT 'Radarr Profile', 'Has Tests', 'radarr', -50
WHERE NOT EXISTS (
  SELECT 1 FROM quality_profile_custom_formats
  WHERE quality_profile_name = 'Radarr Profile'
    AND custom_format_name = 'Has Tests'
    AND arr_type = 'radarr'
);
-- --- END op 3021

-- --- BEGIN op 3022 ( update quality_profile "Radarr Profile" )
INSERT INTO quality_profile_custom_formats (quality_profile_name, custom_format_name, arr_type, score)
SELECT 'Radarr Profile', 'Title Match', 'radarr', 100
WHERE NOT EXISTS (
  SELECT 1 FROM quality_profile_custom_formats
  WHERE quality_profile_name = 'Radarr Profile'
    AND custom_format_name = 'Title Match'
    AND arr_type = 'radarr'
);
-- --- END op 3022

-- --- BEGIN op 3023 ( update quality_profile "Radarr Profile" )
UPDATE quality_profile_qualities
SET position = 0
WHERE quality_profile_name = 'Radarr Profile'
  AND quality_name = 'Remux-2160p'
  AND quality_group_name IS NULL
  AND position = 1
  AND enabled = 0
  AND upgrade_until = 0;

UPDATE quality_profile_qualities
SET position = 1
WHERE quality_profile_name = 'Radarr Profile'
  AND quality_name = 'Bluray-2160p'
  AND quality_group_name IS NULL
  AND position = 2
  AND enabled = 0
  AND upgrade_until = 0;

UPDATE quality_profile_qualities
SET position = 2
WHERE quality_profile_name = 'Radarr Profile'
  AND quality_name = 'WEBDL-2160p'
  AND quality_group_name IS NULL
  AND position = 3
  AND enabled = 0
  AND upgrade_until = 0;

UPDATE quality_profile_qualities
SET position = 3
WHERE quality_profile_name = 'Radarr Profile'
  AND quality_name = 'WEBRip-2160p'
  AND quality_group_name IS NULL
  AND position = 4
  AND enabled = 0
  AND upgrade_until = 0;

UPDATE quality_profile_qualities
SET position = 4
WHERE quality_profile_name = 'Radarr Profile'
  AND quality_name = 'HDTV-2160p'
  AND quality_group_name IS NULL
  AND position = 5
  AND enabled = 0
  AND upgrade_until = 0;

UPDATE quality_profile_qualities
SET position = 7, enabled = 1
WHERE quality_profile_name = 'Radarr Profile'
  AND quality_group_name = 'WEB 1080p'
  AND quality_name IS NULL
  AND position = 8
  AND enabled = 0
  AND upgrade_until = 0;

UPDATE quality_profile_qualities
SET position = 8
WHERE quality_profile_name = 'Radarr Profile'
  AND quality_name = 'HDTV-1080p'
  AND quality_group_name IS NULL
  AND position = 9
  AND enabled = 0
  AND upgrade_until = 0;

UPDATE quality_profile_qualities
SET position = 9
WHERE quality_profile_name = 'Radarr Profile'
  AND quality_name = 'Bluray-720p'
  AND quality_group_name IS NULL
  AND position = 10
  AND enabled = 0
  AND upgrade_until = 0;

UPDATE quality_profile_qualities
SET position = 10
WHERE quality_profile_name = 'Radarr Profile'
  AND quality_name = 'WEBDL-720p'
  AND quality_group_name IS NULL
  AND position = 11
  AND enabled = 0
  AND upgrade_until = 0;

UPDATE quality_profile_qualities
SET position = 11
WHERE quality_profile_name = 'Radarr Profile'
  AND quality_name = 'WEBRip-720p'
  AND quality_group_name IS NULL
  AND position = 12
  AND enabled = 0
  AND upgrade_until = 0;

UPDATE quality_profile_qualities
SET position = 12
WHERE quality_profile_name = 'Radarr Profile'
  AND quality_name = 'HDTV-720p'
  AND quality_group_name IS NULL
  AND position = 13
  AND enabled = 0
  AND upgrade_until = 0;

UPDATE quality_profile_qualities
SET position = 13
WHERE quality_profile_name = 'Radarr Profile'
  AND quality_name = 'Bluray-576p'
  AND quality_group_name IS NULL
  AND position = 14
  AND enabled = 0
  AND upgrade_until = 0;

UPDATE quality_profile_qualities
SET position = 14
WHERE quality_profile_name = 'Radarr Profile'
  AND quality_name = 'Bluray-480p'
  AND quality_group_name IS NULL
  AND position = 15
  AND enabled = 0
  AND upgrade_until = 0;

UPDATE quality_profile_qualities
SET position = 15
WHERE quality_profile_name = 'Radarr Profile'
  AND quality_name = 'WEBDL-480p'
  AND quality_group_name IS NULL
  AND position = 16
  AND enabled = 0
  AND upgrade_until = 0;

UPDATE quality_profile_qualities
SET position = 16
WHERE quality_profile_name = 'Radarr Profile'
  AND quality_name = 'WEBRip-480p'
  AND quality_group_name IS NULL
  AND position = 17
  AND enabled = 0
  AND upgrade_until = 0;

UPDATE quality_profile_qualities
SET position = 17
WHERE quality_profile_name = 'Radarr Profile'
  AND quality_name = 'HDTV-480p'
  AND quality_group_name IS NULL
  AND position = 18
  AND enabled = 0
  AND upgrade_until = 0;

UPDATE quality_profile_qualities
SET position = 18
WHERE quality_profile_name = 'Radarr Profile'
  AND quality_name = 'DVD-R'
  AND quality_group_name IS NULL
  AND position = 19
  AND enabled = 0
  AND upgrade_until = 0;

UPDATE quality_profile_qualities
SET position = 19
WHERE quality_profile_name = 'Radarr Profile'
  AND quality_name = 'DVD'
  AND quality_group_name IS NULL
  AND position = 20
  AND enabled = 0
  AND upgrade_until = 0;

UPDATE quality_profile_qualities
SET position = 20
WHERE quality_profile_name = 'Radarr Profile'
  AND quality_name = 'SDTV'
  AND quality_group_name IS NULL
  AND position = 21
  AND enabled = 0
  AND upgrade_until = 0;

UPDATE quality_profile_qualities
SET position = 21
WHERE quality_profile_name = 'Radarr Profile'
  AND quality_group_name = 'Pre-releases'
  AND quality_name IS NULL
  AND position = 22
  AND enabled = 0
  AND upgrade_until = 0;

UPDATE quality_profile_qualities
SET position = 22
WHERE quality_profile_name = 'Radarr Profile'
  AND quality_group_name = 'Unwanted'
  AND quality_name IS NULL
  AND position = 23
  AND enabled = 0
  AND upgrade_until = 0;

UPDATE quality_profile_qualities
SET position = 5
WHERE quality_profile_name = 'Radarr Profile'
  AND quality_name = 'Bluray-1080p'
  AND quality_group_name IS NULL
  AND position = 7
  AND enabled = 1
  AND upgrade_until = 1;
-- --- END op 3023

-- --- BEGIN op 3024 ( create quality_profile "Sonarr Profile" )
insert into "quality_profiles" ("name", "description", "upgrades_allowed", "minimum_custom_format_score", "upgrade_until_score", "upgrade_score_increment") values ('Sonarr Profile', NULL, 1, 0, 0, 1);

insert into "tags" ("name") values ('beta') on conflict ("name") do nothing;

INSERT INTO quality_profile_tags (quality_profile_name, tag_name) VALUES ('Sonarr Profile', 'beta');

INSERT INTO quality_groups (quality_profile_name, name) VALUES ('Sonarr Profile', 'WEB 1080p');

INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Sonarr Profile', 'WEB 1080p', 'WEBDL-1080p', 0);

INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Sonarr Profile', 'WEB 1080p', 'WEBRip-1080p', 1);

INSERT INTO quality_groups (quality_profile_name, name) VALUES ('Sonarr Profile', 'Pre-releases');

INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Sonarr Profile', 'Pre-releases', 'REGIONAL', 0);

INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Sonarr Profile', 'Pre-releases', 'DVDSCR', 1);

INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Sonarr Profile', 'Pre-releases', 'TELECINE', 2);

INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Sonarr Profile', 'Pre-releases', 'TELESYNC', 3);

INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Sonarr Profile', 'Pre-releases', 'CAM', 4);

INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Sonarr Profile', 'Pre-releases', 'WORKPRINT', 5);

INSERT INTO quality_groups (quality_profile_name, name) VALUES ('Sonarr Profile', 'Unwanted');

INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Sonarr Profile', 'Unwanted', 'Unknown', 0);

INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Sonarr Profile', 'Unwanted', 'Raw-HD', 1);

INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Sonarr Profile', 'Unwanted', 'BR-DISK', 2);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Sonarr Profile', 'Remux-2160p', NULL, 1, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Sonarr Profile', 'Bluray-2160p', NULL, 2, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Sonarr Profile', 'WEBDL-2160p', NULL, 3, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Sonarr Profile', 'WEBRip-2160p', NULL, 4, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Sonarr Profile', 'HDTV-2160p', NULL, 5, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Sonarr Profile', 'Remux-1080p', NULL, 6, 1, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Sonarr Profile', 'Bluray-1080p', NULL, 7, 1, 1);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Sonarr Profile', NULL, 'WEB 1080p', 8, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Sonarr Profile', 'HDTV-1080p', NULL, 9, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Sonarr Profile', 'Bluray-720p', NULL, 10, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Sonarr Profile', 'WEBDL-720p', NULL, 11, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Sonarr Profile', 'WEBRip-720p', NULL, 12, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Sonarr Profile', 'HDTV-720p', NULL, 13, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Sonarr Profile', 'Bluray-576p', NULL, 14, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Sonarr Profile', 'Bluray-480p', NULL, 15, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Sonarr Profile', 'WEBDL-480p', NULL, 16, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Sonarr Profile', 'WEBRip-480p', NULL, 17, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Sonarr Profile', 'HDTV-480p', NULL, 18, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Sonarr Profile', 'DVD-R', NULL, 19, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Sonarr Profile', 'DVD', NULL, 20, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Sonarr Profile', 'SDTV', NULL, 21, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Sonarr Profile', NULL, 'Pre-releases', 22, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Sonarr Profile', NULL, 'Unwanted', 23, 0, 0);
-- --- END op 3024

-- --- BEGIN op 3025 ( update quality_profile "Sonarr Profile" )
update "quality_profiles" set "upgrades_allowed" = 0 where "name" = 'Sonarr Profile' and "upgrades_allowed" = 1;
-- --- END op 3025

-- --- BEGIN op 3026 ( update quality_profile "Sonarr Profile" )
INSERT INTO quality_profile_custom_formats (quality_profile_name, custom_format_name, arr_type, score)
SELECT 'Sonarr Profile', 'Every Condition', 'sonarr', 300
WHERE NOT EXISTS (
  SELECT 1 FROM quality_profile_custom_formats
  WHERE quality_profile_name = 'Sonarr Profile'
    AND custom_format_name = 'Every Condition'
    AND arr_type = 'sonarr'
);
-- --- END op 3026

-- --- BEGIN op 3027 ( update quality_profile "Sonarr Profile" )
INSERT INTO quality_profile_custom_formats (quality_profile_name, custom_format_name, arr_type, score)
SELECT 'Sonarr Profile', 'Title Match', 'sonarr', 200
WHERE NOT EXISTS (
  SELECT 1 FROM quality_profile_custom_formats
  WHERE quality_profile_name = 'Sonarr Profile'
    AND custom_format_name = 'Title Match'
    AND arr_type = 'sonarr'
);
-- --- END op 3027

-- --- BEGIN op 3028 ( update quality_profile "Sonarr Profile" )
UPDATE quality_profile_qualities
SET enabled = 0, upgrade_until = 0
WHERE quality_profile_name = 'Sonarr Profile'
  AND quality_name = 'Bluray-1080p'
  AND quality_group_name IS NULL
  AND position = 7
  AND enabled = 1
  AND upgrade_until = 1;

UPDATE quality_profile_qualities
SET enabled = 0
WHERE quality_profile_name = 'Sonarr Profile'
  AND quality_name = 'Remux-1080p'
  AND quality_group_name IS NULL
  AND position = 6
  AND enabled = 1
  AND upgrade_until = 0;

UPDATE quality_profile_qualities
SET enabled = 1
WHERE quality_profile_name = 'Sonarr Profile'
  AND quality_name = 'HDTV-1080p'
  AND quality_group_name IS NULL
  AND position = 9
  AND enabled = 0
  AND upgrade_until = 0;

UPDATE quality_profile_qualities
SET enabled = 1, upgrade_until = 1
WHERE quality_profile_name = 'Sonarr Profile'
  AND quality_group_name = 'WEB 1080p'
  AND quality_name IS NULL
  AND position = 8
  AND enabled = 0
  AND upgrade_until = 0;
-- --- END op 3028

-- --- BEGIN op 3029 ( create quality_profile "Shared Scores" )
insert into "quality_profiles" ("name", "description", "upgrades_allowed", "minimum_custom_format_score", "upgrade_until_score", "upgrade_score_increment") values ('Shared Scores', NULL, 1, 0, 0, 1);

INSERT INTO quality_groups (quality_profile_name, name) VALUES ('Shared Scores', 'WEB 1080p');

INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Shared Scores', 'WEB 1080p', 'WEBDL-1080p', 0);

INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Shared Scores', 'WEB 1080p', 'WEBRip-1080p', 1);

INSERT INTO quality_groups (quality_profile_name, name) VALUES ('Shared Scores', 'Pre-releases');

INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Shared Scores', 'Pre-releases', 'REGIONAL', 0);

INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Shared Scores', 'Pre-releases', 'DVDSCR', 1);

INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Shared Scores', 'Pre-releases', 'TELECINE', 2);

INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Shared Scores', 'Pre-releases', 'TELESYNC', 3);

INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Shared Scores', 'Pre-releases', 'CAM', 4);

INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Shared Scores', 'Pre-releases', 'WORKPRINT', 5);

INSERT INTO quality_groups (quality_profile_name, name) VALUES ('Shared Scores', 'Unwanted');

INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Shared Scores', 'Unwanted', 'Unknown', 0);

INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Shared Scores', 'Unwanted', 'Raw-HD', 1);

INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('Shared Scores', 'Unwanted', 'BR-DISK', 2);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Shared Scores', 'Remux-2160p', NULL, 1, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Shared Scores', 'Bluray-2160p', NULL, 2, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Shared Scores', 'WEBDL-2160p', NULL, 3, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Shared Scores', 'WEBRip-2160p', NULL, 4, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Shared Scores', 'HDTV-2160p', NULL, 5, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Shared Scores', 'Remux-1080p', NULL, 6, 1, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Shared Scores', 'Bluray-1080p', NULL, 7, 1, 1);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Shared Scores', NULL, 'WEB 1080p', 8, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Shared Scores', 'HDTV-1080p', NULL, 9, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Shared Scores', 'Bluray-720p', NULL, 10, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Shared Scores', 'WEBDL-720p', NULL, 11, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Shared Scores', 'WEBRip-720p', NULL, 12, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Shared Scores', 'HDTV-720p', NULL, 13, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Shared Scores', 'Bluray-576p', NULL, 14, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Shared Scores', 'Bluray-480p', NULL, 15, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Shared Scores', 'WEBDL-480p', NULL, 16, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Shared Scores', 'WEBRip-480p', NULL, 17, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Shared Scores', 'HDTV-480p', NULL, 18, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Shared Scores', 'DVD-R', NULL, 19, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Shared Scores', 'DVD', NULL, 20, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Shared Scores', 'SDTV', NULL, 21, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Shared Scores', NULL, 'Pre-releases', 22, 0, 0);

INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('Shared Scores', NULL, 'Unwanted', 23, 0, 0);
-- --- END op 3029

-- --- BEGIN op 3030 ( update quality_profile "Shared Scores" )
INSERT INTO quality_profile_custom_formats (quality_profile_name, custom_format_name, arr_type, score)
SELECT 'Shared Scores', 'Title Match', 'radarr', 50
WHERE NOT EXISTS (
  SELECT 1 FROM quality_profile_custom_formats
  WHERE quality_profile_name = 'Shared Scores'
    AND custom_format_name = 'Title Match'
    AND arr_type = 'radarr'
);
-- --- END op 3030

-- --- BEGIN op 3031 ( update quality_profile "Shared Scores" )
INSERT INTO quality_profile_custom_formats (quality_profile_name, custom_format_name, arr_type, score)
SELECT 'Shared Scores', 'Title Match', 'sonarr', 50
WHERE NOT EXISTS (
  SELECT 1 FROM quality_profile_custom_formats
  WHERE quality_profile_name = 'Shared Scores'
    AND custom_format_name = 'Title Match'
    AND arr_type = 'sonarr'
);
-- --- END op 3031
