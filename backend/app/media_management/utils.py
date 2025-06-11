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
    
    # If file doesn't exist, return empty dict
    if not os.path.exists(file_path):
        logger.info(f"Media management file not found: {file_path}")
        return {}
    
    try:
        data = _load_yaml_file(file_path)
        return data
    except Exception as e:
        logger.error(f"Error reading {category}: {e}")
        # Return empty dict on error
        return {}


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
            data = get_media_management_data(category)
            # Only include if data exists
            if data:
                original_data[category] = data
        except Exception as e:
            logger.error(f"Error getting {category} data: {e}")
    
    # Transform to have radarr/sonarr at top level
    result = {
        "radarr": {},
        "sonarr": {}
    }
    
    for category, data in original_data.items():
        if category == "misc":
            # misc has radarr/sonarr subdivisions
            if "radarr" in data and data["radarr"]:
                result["radarr"]["misc"] = data["radarr"]
            if "sonarr" in data and data["sonarr"]:
                result["sonarr"]["misc"] = data["sonarr"]
        elif category == "naming":
            # naming has radarr/sonarr subdivisions
            if "radarr" in data and data["radarr"]:
                result["radarr"]["naming"] = data["radarr"]
            if "sonarr" in data and data["sonarr"]:
                result["sonarr"]["naming"] = data["sonarr"]
        elif category == "quality_definitions":
            # quality_definitions has qualityDefinitions.radarr/sonarr
            quality_defs = data.get("qualityDefinitions", {})
            if "radarr" in quality_defs and quality_defs["radarr"]:
                result["radarr"]["quality_definitions"] = quality_defs["radarr"]
            if "sonarr" in quality_defs and quality_defs["sonarr"]:
                result["sonarr"]["quality_definitions"] = quality_defs["sonarr"]

    # Remove empty arr types
    if not result["radarr"]:
        del result["radarr"]
    if not result["sonarr"]:
        del result["sonarr"]
    
    return result