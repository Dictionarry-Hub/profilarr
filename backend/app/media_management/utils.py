import os
import yaml
import logging
from typing import Dict, Any
from datetime import datetime
from ..config.config import config

logger = logging.getLogger(__name__)

# Media management directory
MEDIA_MANAGEMENT_DIR = config.MEDIA_MANAGEMENT_DIR

# Media management categories
MEDIA_MANAGEMENT_CATEGORIES = ["misc", "naming", "quality_definitions"]

# Default values for each category
DEFAULT_VALUES = {
    "misc": {
        "radarr": {
            "propersRepacks": "doNotPrefer",
            "enableMediaInfo": True
        },
        "sonarr": {
            "propersRepacks": "doNotPrefer",
            "enableMediaInfo": True
        }
    },
    "naming": {
        "radarr": {
            "rename": True,
            "movieFormat": "{Movie CleanTitle} {(Release Year)} {tmdb-{TmdbId}} {edition-{Edition Tags}} {[Custom Formats]}{[Quality Full]}{[MediaInfo 3D]}{[MediaInfo VideoDynamicRangeType]}{[Mediainfo AudioCodec}{ Mediainfo AudioChannels]}{[Mediainfo VideoCodec]}{-Release Group}",
            "movieFolderFormat": "{Movie CleanTitle} ({Release Year}) {tmdb-{TmdbId}}",
            "replaceIllegalCharacters": False,
            "colonReplacementFormat": "smart"
        },
        "sonarr": {
            "rename": True,
            "standardEpisodeFormat": "{Series TitleYear} - S{season:00}E{episode:00} - {Episode CleanTitle} {[Custom Formats]}{[Quality Full]}{[MediaInfo VideoDynamicRangeType]}{[Mediainfo AudioCodec}{ Mediainfo AudioChannels]}{[MediaInfo VideoCodec]}{-Release Group}",
            "dailyEpisodeFormat": "{Series TitleYear} - {Air-Date} - {Episode CleanTitle} {[Custom Formats]}{[Quality Full]}{[MediaInfo VideoDynamicRangeType]}{[Mediainfo AudioCodec}{ Mediainfo AudioChannels]}{[MediaInfo VideoCodec]}{-Release Group}",
            "animeEpisodeFormat": "{Series TitleYear} - S{season:00}E{episode:00} - {absolute:000} - {Episode CleanTitle} {[Custom Formats]}{[Quality Full]}{[MediaInfo VideoDynamicRangeType]}[{MediaInfo VideoBitDepth}bit]{[MediaInfo VideoCodec]}[{Mediainfo AudioCodec} { Mediainfo AudioChannels}]{MediaInfo AudioLanguages}{-Release Group}",
            "seriesFolderFormat": "{Series TitleYear} {tvdb-{TvdbId}}",
            "seasonFolderFormat": "Season {season:00}",
            "replaceIllegalCharacters": False,
            "colonReplacementFormat": 4,
            "customColonReplacementFormat": "",
            "multiEpisodeStyle": 5
        }
    },
    "quality_definitions": {
        "qualityDefinitions": {
            "radarr": {
                "Unknown": {"min": 0, "preferred": 1999, "max": 2000},
                "WORKPRINT": {"min": 0, "preferred": 1999, "max": 2000},
                "CAM": {"min": 0, "preferred": 1999, "max": 2000},
                "TELESYNC": {"min": 0, "preferred": 1999, "max": 2000},
                "TELECINE": {"min": 0, "preferred": 1999, "max": 2000},
                "REGIONAL": {"min": 0, "preferred": 1999, "max": 2000},
                "DVDSCR": {"min": 0, "preferred": 1999, "max": 2000},
                "SDTV": {"min": 0, "preferred": 1999, "max": 2000},
                "DVD": {"min": 0, "preferred": 1999, "max": 2000},
                "DVD-R": {"min": 0, "preferred": 1999, "max": 2000},
                "WEBDL-480p": {"min": 0, "preferred": 1999, "max": 2000},
                "WEBRip-480p": {"min": 0, "preferred": 1999, "max": 2000},
                "Bluray-480p": {"min": 0, "preferred": 1999, "max": 2000},
                "Bluray-576p": {"min": 0, "preferred": 1999, "max": 2000},
                "HDTV-720p": {"min": 0, "preferred": 1999, "max": 2000},
                "WEBDL-720p": {"min": 0, "preferred": 1999, "max": 2000},
                "WEBRip-720p": {"min": 0, "preferred": 1999, "max": 2000},
                "Bluray-720p": {"min": 0, "preferred": 1999, "max": 2000},
                "HDTV-1080p": {"min": 0, "preferred": 1999, "max": 2000},
                "WEBDL-1080p": {"min": 0, "preferred": 1999, "max": 2000},
                "WEBRip-1080p": {"min": 0, "preferred": 1999, "max": 2000},
                "Bluray-1080p": {"min": 0, "preferred": 1999, "max": 2000},
                "Remux-1080p": {"min": 0, "preferred": 1999, "max": 2000},
                "HDTV-2160p": {"min": 0, "preferred": 1999, "max": 2000},
                "WEBDL-2160p": {"min": 0, "preferred": 1999, "max": 2000},
                "WEBRip-2160p": {"min": 0, "preferred": 1999, "max": 2000},
                "Bluray-2160p": {"min": 0, "preferred": 1999, "max": 2000},
                "Remux-2160p": {"min": 0, "preferred": 1999, "max": 2000},
                "BR-DISK": {"min": 0, "preferred": 1999, "max": 2000},
                "Raw-HD": {"min": 0, "preferred": 1999, "max": 2000}
            },
            "sonarr": {
                "Unknown": {"min": 0, "preferred": 1999, "max": 2000},
                "SDTV": {"min": 0, "preferred": 1999, "max": 2000},
                "WEBRip-480p": {"min": 0, "preferred": 1999, "max": 2000},
                "WEBDL-480p": {"min": 0, "preferred": 1999, "max": 2000},
                "DVD": {"min": 0, "preferred": 1999, "max": 2000},
                "Bluray-480p": {"min": 0, "preferred": 1999, "max": 2000},
                "Bluray-576p": {"min": 0, "preferred": 1999, "max": 2000},
                "HDTV-720p": {"min": 0, "preferred": 1999, "max": 2000},
                "HDTV-1080p": {"min": 0, "preferred": 1999, "max": 2000},
                "Raw-HD": {"min": 0, "preferred": 1999, "max": 2000},
                "WEBRip-720p": {"min": 0, "preferred": 1999, "max": 2000},
                "WEBDL-720p": {"min": 0, "preferred": 1999, "max": 2000},
                "Bluray-720p": {"min": 0, "preferred": 1999, "max": 2000},
                "WEBRip-1080p": {"min": 0, "preferred": 1999, "max": 2000},
                "WEBDL-1080p": {"min": 0, "preferred": 1999, "max": 2000},
                "Bluray-1080p": {"min": 0, "preferred": 1999, "max": 2000},
                "Bluray-1080p Remux": {"min": 0, "preferred": 1999, "max": 2000},
                "HDTV-2160p": {"min": 0, "preferred": 1999, "max": 2000},
                "WEBRip-2160p": {"min": 0, "preferred": 1999, "max": 2000},
                "WEBDL-2160p": {"min": 0, "preferred": 1999, "max": 2000},
                "Bluray-2160p": {"min": 0, "preferred": 1999, "max": 2000},
                "Bluray-2160p Remux": {"min": 0, "preferred": 1999, "max": 2000}
            }
        }
    }
}




def _preserve_order(data: Dict[str, Any], category: str) -> Dict[str, Any]:
    """Preserve the desired key order based on category"""
    if category == "misc":
        # Order: radarr, sonarr
        ordered = {}
        for arr_type in ["radarr", "sonarr"]:
            if arr_type in data:
                arr_data = data[arr_type]
                # Order within each: propersRepacks, enableMediaInfo  
                ordered_arr = {}
                for key in ["propersRepacks", "enableMediaInfo"]:
                    if key in arr_data:
                        ordered_arr[key] = arr_data[key]
                # Add any remaining keys
                for key, value in arr_data.items():
                    if key not in ordered_arr:
                        ordered_arr[key] = value
                ordered[arr_type] = ordered_arr
        # Add any remaining top-level keys
        for key, value in data.items():
            if key not in ordered:
                ordered[key] = value
        return ordered
                
    elif category == "naming":
        # Order: radarr, sonarr
        ordered = {}
        for arr_type in ["radarr", "sonarr"]:
            if arr_type in data:
                arr_data = data[arr_type]
                ordered_arr = {}
                
                if arr_type == "radarr":
                    # Radarr order: rename, movieFormat, movieFolderFormat, replaceIllegalCharacters, colonReplacementFormat
                    for key in ["rename", "movieFormat", "movieFolderFormat", "replaceIllegalCharacters", "colonReplacementFormat"]:
                        if key in arr_data:
                            ordered_arr[key] = arr_data[key]
                elif arr_type == "sonarr":
                    # Sonarr order: rename, standardEpisodeFormat, dailyEpisodeFormat, animeEpisodeFormat, seriesFolderFormat, seasonFolderFormat, replaceIllegalCharacters, colonReplacementFormat, customColonReplacementFormat, multiEpisodeStyle
                    for key in ["rename", "standardEpisodeFormat", "dailyEpisodeFormat", "animeEpisodeFormat", "seriesFolderFormat", "seasonFolderFormat", "replaceIllegalCharacters", "colonReplacementFormat", "customColonReplacementFormat", "multiEpisodeStyle"]:
                        if key in arr_data:
                            ordered_arr[key] = arr_data[key]
                
                # Add any remaining keys
                for key, value in arr_data.items():
                    if key not in ordered_arr:
                        ordered_arr[key] = value
                ordered[arr_type] = ordered_arr
        # Add any remaining top-level keys
        for key, value in data.items():
            if key not in ordered:
                ordered[key] = value
        return ordered
        
    elif category == "quality_definitions":
        # For quality_definitions, preserve the structure: qualityDefinitions -> radarr/sonarr -> qualities
        return data
    
    return data


def _get_file_path(category: str) -> str:
    """Get the file path for a media management category"""
    return os.path.join(MEDIA_MANAGEMENT_DIR, f"{category}.yml")


def _load_yaml_file(file_path: str) -> Dict[str, Any]:
    """Load YAML file and return contents"""
    if not os.path.exists(file_path):
        logger.error(f"File not found: {file_path}")
        raise FileNotFoundError(f"File not found: {file_path}")
    
    try:
        with open(file_path, 'r') as f:
            return yaml.safe_load(f) or {}
    except Exception as e:
        logger.error(f"Error loading {file_path}: {e}")
        raise


def _save_yaml_file(file_path: str, data: Dict[str, Any], category: str = None) -> None:
    """Save data to YAML file"""
    try:
        # Preserve key order if category is specified
        if category:
            data = _preserve_order(data, category)
            
        with open(file_path, 'w') as f:
            yaml.safe_dump(
                data, 
                f, 
                sort_keys=False,
                default_flow_style=False,
                width=1000,  # Prevent line wrapping
                allow_unicode=True
            )
    except Exception as e:
        logger.error(f"Error saving {file_path}: {e}")
        raise


def get_media_management_data(category: str) -> Dict[str, Any]:
    """Get media management data for a specific category"""
    if category not in MEDIA_MANAGEMENT_CATEGORIES:
        raise ValueError(f"Invalid category: {category}")
    
    file_path = _get_file_path(category)
    
    # If file doesn't exist, return default values
    if not os.path.exists(file_path):
        logger.error(f"Media management file not found: {file_path} - returning defaults for category '{category}'")
        return DEFAULT_VALUES.get(category, {})
    
    try:
        data = _load_yaml_file(file_path)
        return data
    except Exception as e:
        logger.error(f"Error reading {category}: {e}")
        # Return defaults on error
        return DEFAULT_VALUES.get(category, {})


def save_media_management_data(category: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Save media management data for a specific category"""
    if category not in MEDIA_MANAGEMENT_CATEGORIES:
        raise ValueError(f"Invalid category: {category}")
    
    file_path = _get_file_path(category)
    
    try:
        _save_yaml_file(file_path, data, category)
        logger.info(f"Saved {category} data")
        return get_media_management_data(category)
    except Exception as e:
        logger.error(f"Error saving {category}: {e}")
        raise


def update_media_management_data(category: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Update media management data for a specific category"""
    if category not in MEDIA_MANAGEMENT_CATEGORIES:
        raise ValueError(f"Invalid category: {category}")
    
    # For media management, update is the same as save
    # since these files can't be deleted
    return save_media_management_data(category, data)


def get_all_media_management_data() -> Dict[str, Any]:
    """Get all media management data for all categories, transformed to have arr type at top level"""
    # First get all data in original structure
    original_data = {}
    
    for category in MEDIA_MANAGEMENT_CATEGORIES:
        try:
            original_data[category] = get_media_management_data(category)
        except Exception as e:
            logger.error(f"Error getting {category} data: {e}")
            # Include defaults on error
            original_data[category] = DEFAULT_VALUES.get(category, {})
    
    # Transform to have radarr/sonarr at top level
    result = {
        "radarr": {},
        "sonarr": {}
    }
    
    for category, data in original_data.items():
        if category == "misc":
            # misc has radarr/sonarr subdivisions
            result["radarr"]["misc"] = data.get("radarr", {})
            result["sonarr"]["misc"] = data.get("sonarr", {})
        elif category == "naming":
            # naming has radarr/sonarr subdivisions
            result["radarr"]["naming"] = data.get("radarr", {})
            result["sonarr"]["naming"] = data.get("sonarr", {})
        elif category == "quality_definitions":
            # quality_definitions has qualityDefinitions.radarr/sonarr
            quality_defs = data.get("qualityDefinitions", {})
            result["radarr"]["quality_definitions"] = quality_defs.get("radarr", {})
            result["sonarr"]["quality_definitions"] = quality_defs.get("sonarr", {})
    
    return result