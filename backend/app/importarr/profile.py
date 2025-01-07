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

logger = logging.getLogger('importarr')


def import_profiles_to_arr(profile_names: List[str], base_url: str,
                           api_key: str, arr_type: str) -> Dict:
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
        logger.info("Looking for existing profiles...")
        existing_profiles = get_existing_profiles(base_url, api_key)
        if existing_profiles is None:
            return {
                'success': False,
                'error': 'Failed to get existing profiles'
            }

        existing_profile_map = {
            profile['name']: profile['id']
            for profile in existing_profiles
        }
        logger.debug(f"Found {len(existing_profile_map)} existing profiles")

        target_app = TargetApp.RADARR if arr_type.lower(
        ) == 'radarr' else TargetApp.SONARR

        for profile_name in profile_names:
            try:
                profile_file = f"{get_category_directory('profile')}/{profile_name}.yml"
                profile_data = load_yaml_file(profile_file)
                logger.info("Received profile:\n" +
                            yaml.dump(profile_data, sort_keys=False))

                # Log the language setting (if any)
                profile_language = profile_data.get('language', 'any')
                if profile_language != 'any':
                    logger.info(
                        f"Profile '{profile_name}' has language override: {profile_language}"
                    )

                logger.info(
                    f"Processing tweaks and importing formats for profile '{profile_name}'"
                )
                profile_data = process_tweaks(profile_data, base_url, api_key,
                                              arr_type)

                logger.info("Compiling quality profile...")
                compiled_profiles = compile_quality_profile(
                    profile_data=profile_data,
                    target_app=target_app,
                    base_url=base_url,
                    api_key=api_key,
                    format_importer=import_formats_to_arr)

                if not compiled_profiles:
                    raise ValueError("Profile compilation returned no data")

                # We'll assume the compile function returns a list, and we take the first
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

    existing_format_names = {
        item['name']
        for item in profile_data['formatItems']
    }
    synced_items = []

    for item in profile_data['formatItems']:
        if item['name'] in format_id_map:
            synced_items.append({
                'format': format_id_map[item['name']],
                'name': item['name'],
                'score': item['score']
            })
        else:
            logger.warning(f"Custom format not found in arr: {item['name']}")

    for format_name, format_id in format_id_map.items():
        if format_name not in existing_format_names:
            synced_items.append({
                'format': format_id,
                'name': format_name,
                'score': 0
            })

    profile_data['formatItems'] = synced_items
    return profile_data


def process_tweaks(profile_data: Dict, base_url: str, api_key: str,
                   arr_type: str) -> Dict:
    logger.debug(f"Processing tweaks for profile: {profile_data.get('name')}")
    tweaks = profile_data.get('tweaks', {})

    if tweaks.get('preferFreeleech', False):
        freeleech_formats = ["Free25", "Free50", "Free75", "Free100"]
        freeleech_scores = [{
            "name": n,
            "score": s
        } for n, s in zip(freeleech_formats, range(1, 5))]
        _import_and_score_formats(formats=freeleech_formats,
                                  scores=freeleech_scores,
                                  profile_data=profile_data,
                                  base_url=base_url,
                                  api_key=api_key,
                                  arr_type=arr_type,
                                  feature_name="freeleech")

    lossless_formats = [
        "FLAC", "DTS-X", "DTS-HD MA", "TrueHD", "TrueHD (Missing)"
    ]
    default_score = 0 if tweaks.get('allowLosslessAudio', False) else -9999
    lossless_scores = [{
        "name": f,
        "score": default_score
    } for f in lossless_formats]
    _import_and_score_formats(formats=lossless_formats,
                              scores=lossless_scores,
                              profile_data=profile_data,
                              base_url=base_url,
                              api_key=api_key,
                              arr_type=arr_type,
                              feature_name="lossless audio")

    dv_formats = ["Dolby Vision (Without Fallback)"]
    dv_score = 0 if tweaks.get('allowDVNoFallback', False) else -9999
    dv_scores = [{"name": n, "score": dv_score} for n in dv_formats]
    _import_and_score_formats(formats=dv_formats,
                              scores=dv_scores,
                              profile_data=profile_data,
                              base_url=base_url,
                              api_key=api_key,
                              arr_type=arr_type,
                              feature_name="Dolby Vision no fallback")

    codec_formats = ["AV1", "VVC"]
    codec_score = 0 if tweaks.get('allowBleedingEdgeCodecs', False) else -9999
    codec_scores = [{"name": f, "score": codec_score} for f in codec_formats]
    _import_and_score_formats(formats=codec_formats,
                              scores=codec_scores,
                              profile_data=profile_data,
                              base_url=base_url,
                              api_key=api_key,
                              arr_type=arr_type,
                              feature_name="bleeding edge codecs")

    return profile_data


def _import_and_score_formats(formats: List[str], scores: List[Dict[str, Any]],
                              profile_data: Dict, base_url: str, api_key: str,
                              arr_type: str, feature_name: str) -> None:
    logger.info(
        f"Processing {feature_name} formats for profile '{profile_data.get('name')}'"
    )
    try:
        result = import_formats_to_arr(formats, base_url, api_key, arr_type)
        if not result.get('success', False):
            logger.warning(
                f"Failed to import {feature_name} formats for '{profile_data.get('name')}'"
            )
    except Exception as e:
        logger.error(f"Error importing {feature_name} formats: {str(e)}")
        return

    if 'custom_formats' not in profile_data:
        profile_data['custom_formats'] = []
    profile_data['custom_formats'].extend(scores)


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
