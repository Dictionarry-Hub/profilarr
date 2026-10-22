-- @operation: export
-- @entity: batch
-- @name: add delay profile fixtures
-- @exportedAt: 2026-10-22T09:51:16.964Z
-- @opIds: 3036, 3037, 3038

-- --- BEGIN op 3036 ( create delay_profile "Prefer Usenet" )
insert into "delay_profiles" ("name", "preferred_protocol", "usenet_delay", "torrent_delay", "bypass_if_highest_quality", "bypass_if_above_custom_format_score", "minimum_custom_format_score") values ('Prefer Usenet', 'prefer_usenet', 60, 120, 1, 0, NULL);
-- --- END op 3036

-- --- BEGIN op 3037 ( create delay_profile "Torrent Only" )
insert into "delay_profiles" ("name", "preferred_protocol", "usenet_delay", "torrent_delay", "bypass_if_highest_quality", "bypass_if_above_custom_format_score", "minimum_custom_format_score") values ('Torrent Only', 'only_torrent', NULL, 1440, 0, 0, NULL);
-- --- END op 3037

-- --- BEGIN op 3038 ( create delay_profile "Bypass Score" )
insert into "delay_profiles" ("name", "preferred_protocol", "usenet_delay", "torrent_delay", "bypass_if_highest_quality", "bypass_if_above_custom_format_score", "minimum_custom_format_score") values ('Bypass Score', 'prefer_torrent', 30, 30, 0, 1, 500);
-- --- END op 3038
