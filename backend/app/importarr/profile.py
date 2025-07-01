# app/importarr/profile.py

import requests
import logging
import json
import yaml
from pathlib import Path
from typing import Dict, List, Optional, Any
from ..data.utils import load_yaml_file, get_category_directory
from ..compile.profile_compiler import compile_quality_profile
from ..compile.mappings import TargetApp
from .format import import_formats_to_arr
from ..arr.manager import get_arr_config

logger = logging.getLogger('importarr')


def import_profiles_to_arr(profile_names: List[str], original_names: List[str],
                           base_url: str, api_key: str, arr_type: str,
                           arr_id: str, import_as_unique: bool) -> Dict:
    logger.info(
        f"Received {len(profile_names)} profiles to import for {arr_type}")
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
        ) == 'radarr' else TargetApp.SONARR if arr_type.lower(
        ) == 'sonarr' else TargetApp.READARR

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

                logger.info("Received profile:\n" +
                            yaml.dump(profile_data, sort_keys=False))

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

                logger.info("Compiling quality profile...")
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

                logger.info(
                    f"Synchronizing format IDs in profile '{profile_name}'")
                profile_data = sync_format_ids(profile_data, format_id_map)

                logger.debug("Format items after sync:")
                for item in profile_data.get('formatItems', []):
                    logger.debug(
                        f"  {item['name']} => Score: {item.get('score', 0)}, "
                        f"Format ID: {item.get('format', 'missing')}")

                logger.info("Compiled to:\n" +
                            json.dumps(profile_data, indent=2))

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


def process_profile(profile_data: Dict, existing_names: Dict[str, int],
                    base_url: str, api_key: str) -> Dict:
    profile_name = profile_data['name']

    if profile_name in existing_names:
        profile_data['id'] = existing_names[profile_name]
        logger.info(f"Found existing profile '{profile_name}'. Updating...")
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
        logger.info(f"Profile '{profile_name}' not found. Adding...")
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


def update_profile(base_url: str, api_key: str, profile_data: Dict) -> bool:
    try:
        url = f"{base_url.rstrip('/')}/api/v3/qualityprofile/{profile_data['id']}"
        logger.info(f"Updating profile at URL: {url}")
        response = requests.put(url,
                                headers={'X-Api-Key': api_key},
                                json=profile_data)
        logger.info(f"Update response status: {response.status_code}")
        return response.status_code in [200, 201, 202, 204]
    except Exception as e:
        logger.error(f"Error updating profile: {str(e)}")
        return False


def add_profile(base_url: str, api_key: str, profile_data: Dict) -> bool:
    try:
        url = f"{base_url.rstrip('/')}/api/v3/qualityprofile"
        logger.info(f"Adding profile at URL: {url}")
        response = requests.post(url,
                                 headers={'X-Api-Key': api_key},
                                 json=profile_data)
        logger.info(f"Add response status: {response.status_code}")
        return response.status_code in [200, 201, 202, 204]
    except Exception as e:
        logger.error(f"Error adding profile: {str(e)}")
        return False
