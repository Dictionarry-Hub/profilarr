import logging
from typing import Dict, Any, Tuple
from ..importer.arr_handler import ArrHandler, ArrApiError

logger = logging.getLogger(__name__)

def sync_naming_config(base_url: str, api_key: str, arr_type: str, naming_data: Dict[str, Any]) -> Tuple[bool, str]:
    """
    Sync naming configuration to arr instance.
    First GET current config, update with our data, then PUT back.
    
    Args:
        base_url: The arr instance base URL
        api_key: The arr instance API key
        arr_type: Either 'radarr' or 'sonarr'
        naming_data: The naming configuration from our YML file
        
    Returns:
        Tuple of (success, message)
    """
    arr = None
    try:
        # Initialize ArrHandler
        arr = ArrHandler(base_url, api_key)
        logger.info(f"Syncing naming config to {arr_type}")
        
        # GET current naming config using ArrHandler
        current_config = arr.get("/api/v3/config/naming")
        
        # Update current_config with fields from naming_data
        if arr_type == 'radarr':
            # Map our YML fields to Radarr API fields
            if 'rename' in naming_data:
                current_config['renameMovies'] = naming_data['rename']
            if 'replaceIllegalCharacters' in naming_data:
                current_config['replaceIllegalCharacters'] = naming_data['replaceIllegalCharacters']
            if 'colonReplacementFormat' in naming_data:
                current_config['colonReplacementFormat'] = naming_data['colonReplacementFormat']
            if 'movieFormat' in naming_data:
                current_config['standardMovieFormat'] = naming_data['movieFormat']
            if 'movieFolderFormat' in naming_data:
                current_config['movieFolderFormat'] = naming_data['movieFolderFormat']
        else:  # sonarr
            # Map our YML fields to Sonarr API fields
            if 'rename' in naming_data:
                current_config['renameEpisodes'] = naming_data['rename']
            if 'replaceIllegalCharacters' in naming_data:
                current_config['replaceIllegalCharacters'] = naming_data['replaceIllegalCharacters']
            if 'colonReplacementFormat' in naming_data:
                current_config['colonReplacementFormat'] = naming_data['colonReplacementFormat']
            if 'customColonReplacementFormat' in naming_data:
                current_config['customColonReplacementFormat'] = naming_data['customColonReplacementFormat']
            if 'multiEpisodeStyle' in naming_data:
                current_config['multiEpisodeStyle'] = naming_data['multiEpisodeStyle']
            if 'standardEpisodeFormat' in naming_data:
                current_config['standardEpisodeFormat'] = naming_data['standardEpisodeFormat']
            if 'dailyEpisodeFormat' in naming_data:
                current_config['dailyEpisodeFormat'] = naming_data['dailyEpisodeFormat']
            if 'animeEpisodeFormat' in naming_data:
                current_config['animeEpisodeFormat'] = naming_data['animeEpisodeFormat']
            if 'seriesFolderFormat' in naming_data:
                current_config['seriesFolderFormat'] = naming_data['seriesFolderFormat']
            if 'seasonFolderFormat' in naming_data:
                current_config['seasonFolderFormat'] = naming_data['seasonFolderFormat']
            if 'specialsFolderFormat' in naming_data:
                current_config['specialsFolderFormat'] = naming_data['specialsFolderFormat']
        
        # PUT the updated config back using ArrHandler
        arr.put("/api/v3/config/naming", current_config)
        logger.info(f"Successfully synced naming config to {arr_type}")
        return True, "Naming config sync successful"
        
    except ArrApiError as e:
        error_msg = f"Failed to sync naming config: {str(e)}"
        logger.error(error_msg)
        return False, error_msg
    except Exception as e:
        error_msg = f"Failed to sync naming config: {str(e)}"
        logger.error(error_msg)
        return False, error_msg
    finally:
        if arr:
            arr.close()


def sync_media_management_config(base_url: str, api_key: str, arr_type: str, misc_data: Dict[str, Any]) -> Tuple[bool, str]:
    """
    Sync media management (misc) configuration to arr instance.
    First GET current config, update with our data, then PUT back.
    
    Args:
        base_url: The arr instance base URL
        api_key: The arr instance API key
        arr_type: Either 'radarr' or 'sonarr'
        misc_data: The misc configuration from our YML file
        
    Returns:
        Tuple of (success, message)
    """
    arr = None
    try:
        # Initialize ArrHandler
        arr = ArrHandler(base_url, api_key)
        logger.info(f"Syncing media management config to {arr_type}")
        
        # GET current media management config using ArrHandler
        current_config = arr.get("/api/v3/config/mediamanagement")
        
        # Update current_config with fields from misc_data
        if 'propersRepacks' in misc_data:
            current_config['downloadPropersAndRepacks'] = misc_data['propersRepacks']
        if 'enableMediaInfo' in misc_data:
            current_config['enableMediaInfo'] = misc_data['enableMediaInfo']
        
        # PUT the updated config back using ArrHandler
        arr.put("/api/v3/config/mediamanagement", current_config)
        logger.info(f"Successfully synced media management config to {arr_type}")
        return True, "Media management config sync successful"
        
    except ArrApiError as e:
        error_msg = f"Failed to sync media management config: {str(e)}"
        logger.error(error_msg)
        return False, error_msg
    except Exception as e:
        error_msg = f"Failed to sync media management config: {str(e)}"
        logger.error(error_msg)
        return False, error_msg
    finally:
        if arr:
            arr.close()


def sync_quality_definitions(base_url: str, api_key: str, arr_type: str, quality_data: Dict[str, Any]) -> Tuple[bool, str]:
    """
    Sync quality definitions to arr instance.
    Quality definitions contain all required data, so we can directly PUT.
    
    Args:
        base_url: The arr instance base URL
        api_key: The arr instance API key
        arr_type: Either 'radarr' or 'sonarr'
        quality_data: The quality definitions from our YML file
        
    Returns:
        Tuple of (success, message)
    """
    arr = None
    try:
        # Initialize ArrHandler
        arr = ArrHandler(base_url, api_key)
        logger.info(f"Syncing quality definitions to {arr_type}")
        
        # GET current quality definitions using ArrHandler
        current_definitions = arr.get("/api/v3/qualitydefinition")
        
        # Create a mapping of quality names to current definitions for easier lookup
        quality_map = {def_['quality']['name']: def_ for def_ in current_definitions}
        
        # Update each quality definition with our values
        for quality_name, settings in quality_data.items():
            if quality_name in quality_map:
                definition = quality_map[quality_name]
                # Update size limits from our YML data
                if 'min' in settings:
                    definition['minSize'] = settings['min']
                if 'preferred' in settings:
                    definition['preferredSize'] = settings['preferred']
                if 'max' in settings:
                    definition['maxSize'] = settings['max']
        
        # PUT the updated definitions back using ArrHandler
        arr.put("/api/v3/qualitydefinition/update", current_definitions)
        logger.info(f"Successfully synced quality definitions to {arr_type}")
        return True, "Quality definitions sync successful"
        
    except ArrApiError as e:
        error_msg = f"Failed to sync quality definitions: {str(e)}"
        logger.error(error_msg)
        return False, error_msg
    except Exception as e:
        error_msg = f"Failed to sync quality definitions: {str(e)}"
        logger.error(error_msg)
        return False, error_msg
    finally:
        if arr:
            arr.close()