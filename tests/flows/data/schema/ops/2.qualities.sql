-- Qualities
INSERT INTO qualities (name) VALUES
('Unknown'),
('WORKPRINT'),
('CAM'),
('TELESYNC'),
('TELECINE'),
('DVDSCR'),
('REGIONAL'),
('SDTV'),
('DVD'),
('DVD-R'),
('HDTV-480p'),
('HDTV-720p'),
('HDTV-1080p'),
('HDTV-2160p'),
('WEBDL-480p'),
('WEBDL-720p'),
('WEBDL-1080p'),
('WEBDL-2160p'),
('WEBRip-480p'),
('WEBRip-720p'),
('WEBRip-1080p'),
('WEBRip-2160p'),
('Bluray-480p'),
('Bluray-576p'),
('Bluray-720p'),
('Bluray-1080p'),
('Bluray-2160p'),
('Remux-1080p'),
('Remux-2160p'),
('BR-DISK'),
('Raw-HD');

-- Radarr mappings (30 qualities)
INSERT INTO quality_api_mappings (quality_name, arr_type, api_name)
SELECT name, 'radarr', name FROM qualities WHERE name IN (
    'Unknown', 'WORKPRINT', 'CAM', 'TELESYNC', 'TELECINE', 'DVDSCR', 'REGIONAL',
    'SDTV', 'DVD', 'DVD-R', 'HDTV-720p', 'HDTV-1080p', 'HDTV-2160p',
    'WEBDL-480p', 'WEBDL-720p', 'WEBDL-1080p', 'WEBDL-2160p',
    'WEBRip-480p', 'WEBRip-720p', 'WEBRip-1080p', 'WEBRip-2160p',
    'Bluray-480p', 'Bluray-576p', 'Bluray-720p', 'Bluray-1080p', 'Bluray-2160p',
    'Remux-1080p', 'Remux-2160p', 'BR-DISK', 'Raw-HD'
);

-- Sonarr mappings (20 exact matches + 2 remuxes with different names)
INSERT INTO quality_api_mappings (quality_name, arr_type, api_name)
SELECT name, 'sonarr', name FROM qualities WHERE name IN (
    'Unknown', 'SDTV', 'DVD', 'HDTV-720p', 'HDTV-1080p', 'HDTV-2160p',
    'WEBDL-480p', 'WEBDL-720p', 'WEBDL-1080p', 'WEBDL-2160p',
    'WEBRip-480p', 'WEBRip-720p', 'WEBRip-1080p', 'WEBRip-2160p',
    'Bluray-480p', 'Bluray-576p', 'Bluray-720p', 'Bluray-1080p', 'Bluray-2160p',
    'Raw-HD'
);

-- Sonarr remux mappings (different names)
INSERT INTO quality_api_mappings (quality_name, arr_type, api_name)
SELECT name, 'sonarr', 'Bluray-1080p Remux' FROM qualities WHERE name = 'Remux-1080p';

INSERT INTO quality_api_mappings (quality_name, arr_type, api_name)
SELECT name, 'sonarr', 'Bluray-2160p Remux' FROM qualities WHERE name = 'Remux-2160p';
