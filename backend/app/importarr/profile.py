# app/importarr/profile.py

import requests
import logging
import json
import yaml
import asyncio
import aiohttp
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from ..data.utils import load_yaml_file, get_category_directory
from ..compile.profile_compiler import compile_quality_profile
from ..compile.mappings import TargetApp
from .format import import_formats_to_arr 
from .format_memory import import_format_from_memory, async_import_format_from_memory
from ..arr.manager import get_arr_config

logger = logging.getLogger('importarr')


def import_profiles_to_arr(profile_names: List[str], original_names: List[str],
                           base_url: str, api_key: str, arr_type: str,
                           arr_id: str, import_as_unique: bool) -> Dict:
    """
    Import quality profiles to arr instance.
    This function supports bulk importing of profiles with sequential or concurrent processing.
    """
    logger.info(
        f"Received {len(profile_names)} profiles to import for {arr_type}")

    # For larger imports, use the async version to improve performance
    if len(profile_names) > 1:
        # Run async function within the event loop
        return asyncio.run(
            async_import_profiles_to_arr(profile_names=profile_names,
                                         original_names=original_names,
                                         base_url=base_url,
                                         api_key=api_key,
                                         arr_type=arr_type,
                                         arr_id=arr_id,
                                         import_as_unique=import_as_unique))

    # For smaller imports, use the regular synchronous version
    results = {
        'success': True,
        'added': 0,
        'updated': 0,
        'failed': 0,
        'details': []
    }

    try:
        arr_config_response = get_arr_config(arr_id)
        if not arr_config_response['success']:
            return {
                'success': False,
                'error': 'Failed to get arr configuration'
            }
        arr_config = arr_config_response['data']

        logger.info("Looking for existing profiles...")
        existing_profiles = get_existing_profiles(base_url, api_key)
        if existing_profiles is None:
            return {
                'success': False,
                'error': 'Failed to get existing profiles'
            }

        # Create mapping for existing profiles
        existing_profile_map = {}
        for profile in existing_profiles:
            existing_profile_map[profile['name']] = profile['id']

        target_app = TargetApp.RADARR if arr_type.lower(
        ) == 'radarr' else TargetApp.SONARR

        for i, profile_name in enumerate(profile_names):
            try:
                # Use original name for file lookup
                original_name = original_names[i]
                profile_file = f"{get_category_directory('profile')}/{original_name}.yml"
                profile_data = load_yaml_file(profile_file)

                # Set the potentially modified profile name
                profile_data['name'] = profile_name

                # Modify custom format names if import_as_unique is true
                if import_as_unique and 'custom_formats' in profile_data:
                    for cf in profile_data['custom_formats']:
                        cf['name'] = f"{cf['name']} [Dictionarry]"

                # Profile loaded

                profile_language = profile_data.get('language', 'any')
                if profile_language != 'any':
                    # Detect if we're using simple or advanced mode
                    is_simple_mode = '_' not in profile_language
                    if is_simple_mode:
                        logger.info(
                            f"Profile '{profile_name}' has simple mode language: {profile_language}"
                        )
                        logger.info(
                            f"Simple mode will set language filter to: {profile_language}"
                        )
                    else:
                        logger.info(
                            f"Profile '{profile_name}' has advanced mode language: {profile_language}"
                        )

                compiled_profiles = compile_quality_profile(
                    profile_data=profile_data,
                    target_app=target_app,
                    base_url=base_url,
                    api_key=api_key,
                    format_importer=import_formats_to_arr,
                    import_as_unique=import_as_unique)

                if not compiled_profiles:
                    raise ValueError("Profile compilation returned no data")

                profile_data = compiled_profiles[0]

                logger.info(
                    "Looking for existing custom formats to sync format IDs..."
                )
                existing_formats = get_existing_formats(base_url, api_key)
                if existing_formats is None:
                    raise ValueError("Failed to get updated format list")

                format_id_map = {
                    fmt['name']: fmt['id']
                    for fmt in existing_formats
                }
                logger.debug(
                    f"Found {len(format_id_map)} existing custom formats")

                profile_data = sync_format_ids(profile_data, format_id_map)

                logger.debug("Format items after sync:")
                for item in profile_data.get('formatItems', []):
                    logger.debug(
                        f"  {item['name']} => Score: {item.get('score', 0)}, "
                        f"Format ID: {item.get('format', 'missing')}")

                # Profile compiled successfully

                result = process_profile(profile_data=profile_data,
                                         existing_names=existing_profile_map,
                                         base_url=base_url,
                                         api_key=api_key)

                results[result['action']] += 1
                results['details'].append(result['detail'])

                if not result['success']:
                    results['success'] = False

            except Exception as e:
                logger.error(
                    f"Error processing profile {profile_name}: {str(e)}, type: {type(e).__name__}"
                )
                logger.exception("Full traceback:")
                results['failed'] += 1
                results['details'].append({
                    'name': profile_name,
                    'action': 'failed',
                    'success': False,
                    'error': str(e)
                })
                results['success'] = False

        logger.info(
            f"Importing {len(profile_names)} profiles complete. "
            f"Added: {results['added']}, Updated: {results['updated']}, "
            f"Failed: {results['failed']}")
        return results

    except Exception as e:
        logger.error(f"Error in import_profiles_to_arr: {str(e)}")
        return {'success': False, 'error': str(e)}


async def async_import_profiles_to_arr(profile_names: List[str],
                                       original_names: List[str],
                                       base_url: str, api_key: str,
                                       arr_type: str, arr_id: str,
                                       import_as_unique: bool) -> Dict:
    """
    Asynchronous version of import_profiles_to_arr that processes profiles concurrently.
    This significantly improves performance for larger batches of profile imports.
    """
    logger.info(
        f"Received {len(profile_names)} profiles to import (async) for {arr_type}"
    )
    results = {
        'success': True,
        'added': 0,
        'updated': 0,
        'failed': 0,
        'details': []
    }

    try:
        arr_config_response = get_arr_config(arr_id)
        if not arr_config_response['success']:
            return {
                'success': False,
                'error': 'Failed to get arr configuration'
            }
        arr_config = arr_config_response['data']

        logger.info("Looking for existing profiles (async)...")
        existing_profiles = await async_get_existing_profiles(
            base_url, api_key)
        if existing_profiles is None:
            return {
                'success': False,
                'error': 'Failed to get existing profiles'
            }

        # Create mapping for existing profiles
        existing_profile_map = {}
        for profile in existing_profiles:
            existing_profile_map[profile['name']] = profile['id']

        target_app = TargetApp.RADARR if arr_type.lower(
        ) == 'radarr' else TargetApp.SONARR

        # Fetch all existing formats once upfront
        logger.info("Pre-fetching existing custom formats for all profiles...")
        existing_formats = await async_get_existing_formats(base_url, api_key)
        if existing_formats is None:
            return {
                'success': False,
                'error': 'Failed to get existing custom formats'
            }
        format_id_map = {fmt['name']: fmt['id'] for fmt in existing_formats}
        logger.info(f"Successfully pre-fetched {len(format_id_map)} existing custom formats")

        # Pre-scan all profiles to identify and cache language formats
        needed_language_formats = set()
        initial_profiles_data = []
        
        # First, load and analyze all profile files
        for i, profile_name in enumerate(profile_names):
            try:
                # Use original name for file lookup
                original_name = original_names[i]
                profile_file = f"{get_category_directory('profile')}/{original_name}.yml"
                profile_data = load_yaml_file(profile_file)
                
                # Store original profile data for later processing
                initial_profiles_data.append((i, profile_name, original_name, profile_data))
                
                # Extract language from profile data
                profile_language = profile_data.get('language', 'any')
                if profile_language != 'any' and '_' in profile_language:
                    # This is an advanced mode language that needs special format handling
                    needed_language_formats.add(profile_language)
                    # Language format identified
            except Exception as e:
                logger.error(f"Error pre-scanning profile {profile_name}: {str(e)}")
                results['failed'] += 1
                results['details'].append({
                    'name': profile_name,
                    'action': 'failed',
                    'success': False,
                    'error': f"Error pre-scanning profile: {str(e)}"
                })
                results['success'] = False
        
        # Pre-load all language formats if any exist
        language_format_cache = {}
        if needed_language_formats:
            logger.info(f"Pre-importing {len(needed_language_formats)} unique language formats for {len(profile_names)} profiles")
            language_format_cache = await preload_language_formats(
                language_formats=list(needed_language_formats),
                target_app=target_app,
                base_url=base_url,
                api_key=api_key,
                arr_type=arr_type,
                import_as_unique=import_as_unique
            )
            logger.info(f"Successfully pre-loaded language formats for {len(language_format_cache)} languages")

        # Process each profile with the cached language formats
        profile_tasks = []
        
        for i, profile_name, original_name, profile_data in initial_profiles_data:
            try:
                # Set the potentially modified profile name
                profile_data['name'] = profile_name

                # Modify custom format names if import_as_unique is true
                if import_as_unique and 'custom_formats' in profile_data:
                    for cf in profile_data['custom_formats']:
                        cf['name'] = f"{cf['name']} [Dictionarry]"

                # Profile loaded

                profile_language = profile_data.get('language', 'any')
                if profile_language != 'any':
                    # Detect if we're using simple or advanced mode
                    is_simple_mode = '_' not in profile_language
                    # Language mode detected
                
                # Setup the profile compilation with the cached language formats
                
                # By default, use normal import
                format_importer = import_formats_to_arr
                
                # For profiles with language formats, attach the cached formats
                if language_format_cache and profile_language != 'any' and '_' in profile_language:
                    language_format_configs = language_format_cache.get(profile_language, [])
                    
                    if language_format_configs:
                        # Using cached language formats
                        
                        # Define a special function that will be detected by the profile compiler
                        # The function name is checked in _process_language_formats
                        def cached_format_importer(*args, **kwargs):
                            # Using cached formats from importer
                            return {
                                'success': True,
                                'added': 0,
                                'updated': len(language_format_configs),
                                'failed': 0,
                                'details': []
                            }
                            
                        # Add the cached formats to the function so they can be accessed by the compiler
                        cached_format_importer.cached_formats = language_format_configs
                        format_importer = cached_format_importer
                    else:
                        logger.warning(f"No cached formats found for language {profile_language}")
                        
                # Add language formats from cache directly to the profile for the compiler
                # This way we don't need to modify the compiler code at all
                if profile_language != 'any' and '_' in profile_language and profile_language in language_format_cache:
                    # Add the cached language formats directly to the profile
                    if 'custom_formats' not in profile_data:
                        profile_data['custom_formats'] = []
                    
                    # Add the cached formats - these are already imported, we just need to reference them
                    profile_data['custom_formats'].extend(language_format_cache[profile_language])

                compiled_profiles = compile_quality_profile(
                    profile_data=profile_data,
                    target_app=target_app,
                    base_url=base_url,
                    api_key=api_key,
                    format_importer=format_importer,
                    import_as_unique=import_as_unique
                )

                if not compiled_profiles:
                    raise ValueError("Profile compilation returned no data")

                compiled_profile = compiled_profiles[0]
                
                # Sync format IDs upfront using the cached format_id_map
                synced_profile = sync_format_ids(compiled_profile, format_id_map)
                
                # Create a task for processing this profile (without fetching formats again)
                task = asyncio.create_task(
                    async_process_profile(
                        profile_data=synced_profile,
                        existing_names=existing_profile_map,
                        base_url=base_url,
                        api_key=api_key
                    )
                )
                profile_tasks.append((profile_name, task))
                
            except Exception as e:
                logger.error(
                    f"Error processing profile {profile_name}: {str(e)}, type: {type(e).__name__} (async)"
                )
                logger.exception("Full traceback:")
                results['failed'] += 1
                results['details'].append({
                    'name': profile_name,
                    'action': 'failed',
                    'success': False,
                    'error': str(e)
                })
                results['success'] = False
        
        # Process all profile upload results
        for profile_name, task in profile_tasks:
            try:
                result = await task
                
                if result['success']:
                    results[result['action']] += 1
                else:
                    results['failed'] += 1
                    results['success'] = False
                
                results['details'].append(result['detail'])
                
            except Exception as e:
                logger.error(
                    f"Error waiting for profile task {profile_name}: {str(e)} (async)"
                )
                results['failed'] += 1
                results['details'].append({
                    'name': profile_name,
                    'action': 'failed',
                    'success': False,
                    'error': str(e)
                })
                results['success'] = False

        logger.info(
            f"Async importing {len(profile_names)} profiles complete. "
            f"Added: {results['added']}, Updated: {results['updated']}, "
            f"Failed: {results['failed']}")
        return results

    except Exception as e:
        logger.error(f"Error in async_import_profiles_to_arr: {str(e)}")
        return {'success': False, 'error': str(e)}


def get_existing_profiles(base_url: str, api_key: str) -> Optional[List[Dict]]:
    try:
        response = requests.get(
            f"{base_url.rstrip('/')}/api/v3/qualityprofile",
            headers={'X-Api-Key': api_key})
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        logger.error(f"Error getting existing profiles: {str(e)}")
        return None


async def async_get_existing_profiles(base_url: str,
                                      api_key: str) -> Optional[List[Dict]]:
    """Async version of get_existing_profiles"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                    f"{base_url.rstrip('/')}/api/v3/qualityprofile",
                    headers={'X-Api-Key': api_key}) as response:
                if response.status == 200:
                    return await response.json()
        return None
    except Exception as e:
        logger.error(f"Error getting existing profiles (async): {str(e)}")
        return None


def get_existing_formats(base_url: str, api_key: str) -> Optional[List[Dict]]:
    try:
        response = requests.get(f"{base_url.rstrip('/')}/api/v3/customformat",
                                headers={'X-Api-Key': api_key})
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        logger.error(f"Error getting existing formats: {str(e)}")
        return None


async def async_get_existing_formats(base_url: str,
                                     api_key: str) -> Optional[List[Dict]]:
    """Async version of get_existing_formats"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                    f"{base_url.rstrip('/')}/api/v3/customformat",
                    headers={'X-Api-Key': api_key}) as response:
                if response.status == 200:
                    return await response.json()
        return None
    except Exception as e:
        logger.error(f"Error getting existing formats (async): {str(e)}")
        return None


async def preload_language_formats(language_formats: List[str],
                             target_app: TargetApp,
                             base_url: str,
                             api_key: str,
                             arr_type: str,
                             import_as_unique: bool) -> Dict[str, List[Dict]]:
    """
    Pre-load all language formats for the specified languages to avoid
    duplicate imports when multiple profiles use the same language settings.
    
    Args:
        language_formats: List of language identifiers (e.g. ["must_english", "prefer_french"])
        target_app: TargetApp enum value (RADARR or SONARR)
        base_url: API base URL
        api_key: API key for the arr instance
        arr_type: Type of arr (radarr or sonarr)
        import_as_unique: Whether to append [Dictionarry] to format names
        
    Returns:
        Dictionary mapping language IDs to their imported format configs
    """
    from ..compile.profile_compiler import ProfileConverter
    
    language_format_cache = {}
    
    # Create a single ProfileConverter instance for all languages
    converter = ProfileConverter(
        target_app=target_app,
        base_url=base_url,
        api_key=api_key,
        format_importer=None,  # We'll handle importing manually
        import_as_unique=import_as_unique
    )
    
    # For each unique language, process and cache its formats
    for language_id in language_formats:
        try:
            # Skip if we've already processed this language
            if language_id in language_format_cache:
                continue
                
            # Parse the language behavior and code
            if '_' in language_id:
                behavior, language_code = language_id.split('_', 1)
            else:
                # Skip simple language modes - they don't need special format imports
                continue
                
            logger.info(f"Pre-importing language formats for {language_id} (async batch)")
            
            # First generate format data for this language
            formats_data = converter._generate_language_formats(behavior, language_code)
            
            # Import these language formats just once
            format_results = await import_language_formats_once(
                formats_data=formats_data,
                base_url=base_url,
                api_key=api_key,
                arr_type=arr_type,
                import_as_unique=import_as_unique
            )
            
            # Store the format configs for this language
            language_format_cache[language_id] = format_results
            logger.info(f"Successfully cached {len(format_results)} formats for language {language_id}")
            
        except Exception as e:
            logger.error(f"Error pre-loading language formats for {language_id}: {str(e)}")
            language_format_cache[language_id] = []  # Empty list to indicate failure
            
    return language_format_cache


async def import_language_formats_once(formats_data: List[Dict],
                                      base_url: str,
                                      api_key: str,
                                      arr_type: str,
                                      import_as_unique: bool) -> List[Dict]:
    """
    Helper function to import language formats once and return the results.
    
    Args:
        formats_data: List of format data dictionaries to import
        base_url: API base URL
        api_key: API key for arr instance
        arr_type: Type of arr (radarr or sonarr)
        import_as_unique: Whether to append [Dictionarry] to format names
        
    Returns:
        List of format configs ready to be added to profiles
    """
    # Create tasks for concurrent format imports
    format_configs = []
    import_tasks = []
    
    for format_data in formats_data:
        # Setup task for importing this format
        task = asyncio.create_task(
            async_import_format_from_memory(
                format_data=format_data,
                base_url=base_url,
                api_key=api_key,
                arr_type=arr_type,
                import_as_unique=import_as_unique
            )
        )
        import_tasks.append((format_data['name'], task))
    
    # Process all format imports
    for format_name, task in import_tasks:
        try:
            result = await task
            if not result.get('success', False):
                logger.error(f"Format import failed for cached language format: {format_name}")
                continue
                
            # Determine final format name (after any [Dictionarry] suffix)
            display_name = format_name
            if import_as_unique:
                display_name = f"{format_name} [Dictionarry]"
                
            # Create format config exactly as needed by profile compiler
            format_configs.append({
                'name': display_name,
                'score': -9999
            })
            
        except Exception as e:
            logger.error(f"Error importing cached language format {format_name}: {str(e)}")
    
    return format_configs


def use_cached_language_formats(language_cache: Dict[str, List[Dict]], 
                               format_names: List[str],
                               base_url: str, 
                               api_key: str, 
                               arr_type: str,
                               original_names: List[str]) -> Dict:
    """
    Custom format importer that returns cached language formats instead
    of re-importing them. This is used by the profile compiler when we've
    already pre-loaded the language formats.
    
    This is a replacement for the regular import_formats_to_arr function.
    """
    # Extract the language ID from the original profile data
    # This is passed from the profile compiler's context when calling this function
    language_id = getattr(use_cached_language_formats, 'current_language_id', None)
    
    if language_id and language_id in language_cache:
        logger.info(f"Using cached language formats for {language_id}")
        return {
            'success': True,
            'added': 0,
            'updated': len(language_cache[language_id]),
            'failed': 0,
            'details': [
                {'name': fmt['name'], 'action': 'updated', 'success': True}
                for fmt in language_cache[language_id]
            ]
        }
    else:
        # Fall back to normal import if no cache entry exists
        # or if this isn't a language format import
        logger.info(f"No cached formats for language ID {language_id}, using normal import")
        return import_formats_to_arr(
            format_names=format_names,
            base_url=base_url,
            api_key=api_key,
            arr_type=arr_type,
            original_names=original_names
        )


def sync_format_ids(profile_data: Dict, format_id_map: Dict[str, int]) -> Dict:
    if 'formatItems' not in profile_data:
        profile_data['formatItems'] = []

    # Create a set to track format names we've already processed
    processed_formats = set()
    synced_items = []

    # First process existing items
    for item in profile_data.get('formatItems', []):
        if item['name'] not in processed_formats:
            if item['name'] in format_id_map:
                synced_items.append({
                    'format': format_id_map[item['name']],
                    'name': item['name'],
                    'score': item['score']
                })
                processed_formats.add(item['name'])
            else:
                logger.warning(
                    f"Custom format not found in arr: {item['name']}")

    # Only add formats that haven't been processed yet
    for format_name, format_id in format_id_map.items():
        if format_name not in processed_formats:
            synced_items.append({
                'format': format_id,
                'name': format_name,
                'score': 0  # Default score for new formats
            })
            processed_formats.add(format_name)

    profile_data['formatItems'] = synced_items
    return profile_data


# This function is now deprecated and replaced by direct use of sync_format_ids and async_process_profile
# We're keeping the signature for backward compatibility but not using it in the optimized code path
async def async_process_profile_with_formats(profile_name: str,
                                             profile_data: Dict,
                                             existing_profile_map: Dict[str,
                                                                        int],
                                             base_url: str,
                                             api_key: str) -> Dict:
    """
    Asynchronous function that handles getting formats and processing a profile in one go.
    This allows for concurrent profile processing.
    
    Note: This function is deprecated and should not be used in new code.
    It's better to fetch formats once upfront for all profiles.
    """
    try:
        # Get formats for profile synchronization
        logger.info(
            f"Looking for existing custom formats to sync format IDs (async)..."
        )
        existing_formats = await async_get_existing_formats(base_url, api_key)
        if existing_formats is None:
            raise ValueError("Failed to get updated format list")

        format_id_map = {fmt['name']: fmt['id'] for fmt in existing_formats}
        logger.debug(
            f"Found {len(format_id_map)} existing custom formats (async)")

        # Sync format IDs in the profile
        synced_profile = sync_format_ids(profile_data, format_id_map)

        # Process the profile (add or update)
        return await async_process_profile(profile_data=synced_profile,
                                           existing_names=existing_profile_map,
                                           base_url=base_url,
                                           api_key=api_key)
    except Exception as e:
        logger.error(
            f"Error in async_process_profile_with_formats for {profile_name}: {str(e)}"
        )
        return {
            'success': False,
            'action': 'failed',
            'detail': {
                'name': profile_name,
                'action': 'failed',
                'success': False,
                'error': str(e)
            }
        }


def process_profile(profile_data: Dict, existing_names: Dict[str, int],
                    base_url: str, api_key: str) -> Dict:
    profile_name = profile_data['name']

    if profile_name in existing_names:
        profile_data['id'] = existing_names[profile_name]
        success = update_profile(base_url, api_key, profile_data)
        return {
            'success': success,
            'action': 'updated' if success else 'failed',
            'detail': {
                'name': profile_name,
                'action': 'updated',
                'success': success
            }
        }
    else:
        success = add_profile(base_url, api_key, profile_data)
        return {
            'success': success,
            'action': 'added' if success else 'failed',
            'detail': {
                'name': profile_name,
                'action': 'added',
                'success': success
            }
        }


async def async_process_profile(profile_data: Dict, existing_names: Dict[str,
                                                                         int],
                                base_url: str, api_key: str) -> Dict:
    """Async version of process_profile"""
    profile_name = profile_data['name']

    if profile_name in existing_names:
        profile_data['id'] = existing_names[profile_name]
        success = await async_update_profile(base_url, api_key, profile_data)
        return {
            'success': success,
            'action': 'updated' if success else 'failed',
            'detail': {
                'name': profile_name,
                'action': 'updated',
                'success': success
            }
        }
    else:
        success = await async_add_profile(base_url, api_key, profile_data)
        return {
            'success': success,
            'action': 'added' if success else 'failed',
            'detail': {
                'name': profile_name,
                'action': 'added',
                'success': success
            }
        }


def update_profile(base_url: str, api_key: str, profile_data: Dict) -> bool:
    try:
        url = f"{base_url.rstrip('/')}/api/v3/qualityprofile/{profile_data['id']}"
        response = requests.put(url,
                                headers={'X-Api-Key': api_key},
                                json=profile_data)
        logger.info(f"Update profile '{profile_data['name']}' response: {response.status_code}")
        return response.status_code in [200, 201, 202, 204]
    except Exception as e:
        logger.error(f"Error updating profile: {str(e)}")
        return False


async def async_update_profile(base_url: str, api_key: str,
                               profile_data: Dict) -> bool:
    """Async version of update_profile"""
    try:
        url = f"{base_url.rstrip('/')}/api/v3/qualityprofile/{profile_data['id']}"
        async with aiohttp.ClientSession() as session:
            async with session.put(url,
                                   headers={'X-Api-Key': api_key},
                                   json=profile_data) as response:
                logger.info(f"Update profile '{profile_data['name']}' response: {response.status} (async)")
                return response.status in [200, 201, 202, 204]
    except Exception as e:
        logger.error(f"Error updating profile (async): {str(e)}")
        return False


def add_profile(base_url: str, api_key: str, profile_data: Dict) -> bool:
    try:
        url = f"{base_url.rstrip('/')}/api/v3/qualityprofile"
        response = requests.post(url,
                                 headers={'X-Api-Key': api_key},
                                 json=profile_data)
        logger.info(f"Add profile '{profile_data['name']}' response: {response.status_code}")
        return response.status_code in [200, 201, 202, 204]
    except Exception as e:
        logger.error(f"Error adding profile: {str(e)}")
        return False


async def async_add_profile(base_url: str, api_key: str,
                            profile_data: Dict) -> bool:
    """Async version of add_profile"""
    try:
        url = f"{base_url.rstrip('/')}/api/v3/qualityprofile"
        async with aiohttp.ClientSession() as session:
            async with session.post(url,
                                    headers={'X-Api-Key': api_key},
                                    json=profile_data) as response:
                logger.info(f"Add profile '{profile_data['name']}' response: {response.status} (async)")
                return response.status in [200, 201, 202, 204]
    except Exception as e:
        logger.error(f"Error adding profile (async): {str(e)}")
        return False
