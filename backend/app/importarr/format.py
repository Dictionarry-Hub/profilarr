import requests
import logging
import json
import yaml
import asyncio
import aiohttp
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from ..data.utils import (load_yaml_file, get_category_directory, REGEX_DIR,
                          FORMAT_DIR)
from ..compile import CustomFormat, FormatConverter, TargetApp
from ..db.queries.format_renames import is_format_in_renames

logger = logging.getLogger('importarr')


def import_formats_to_arr(format_names, base_url, api_key, arr_type,
                          original_names):
    """
    Import custom formats to arr instance.
    This function supports bulk importing of formats with sequential processing.
    """
    logger.info(
        f"Received {len(format_names)} formats to import for {arr_type}")
    
    # For larger imports, use the async version to improve performance
    if len(format_names) > 5:
        # Run async function within the event loop
        return asyncio.run(
            async_import_formats_to_arr(
                format_names=format_names,
                base_url=base_url,
                api_key=api_key,
                arr_type=arr_type,
                original_names=original_names
            )
        )
    
    # For smaller imports, use the regular synchronous version
    results = {
        'success': True,
        'added': 0,
        'updated': 0,
        'failed': 0,
        'details': []
    }

    try:
        logger.info("Looking for existing formats...")
        existing_formats = get_existing_formats(base_url, api_key)
        if existing_formats is None:
            return {
                'success': False,
                'error': 'Failed to get existing formats'
            }

        existing_names = {fmt['name']: fmt['id'] for fmt in existing_formats}

        patterns = {}
        for pattern_file in Path(REGEX_DIR).glob('*.yml'):
            try:
                pattern_data = load_yaml_file(str(pattern_file))
                if pattern_data and 'name' in pattern_data and 'pattern' in pattern_data:
                    patterns[pattern_data['name']] = pattern_data['pattern']
            except Exception as e:
                logger.error(
                    f"Error loading pattern file {pattern_file}: {str(e)}")
                continue

        converter = FormatConverter(patterns)
        target_app = TargetApp.RADARR if arr_type.lower(
        ) == 'radarr' else TargetApp.SONARR

        for i, format_name in enumerate(format_names):
            try:
                # Use original name for file lookup
                original_name = original_names[i]
                format_file = f"{get_category_directory('custom_format')}/{original_name}.yml"
                format_data = load_yaml_file(format_file)
                logger.debug(f"Received format: {format_data['name']}")

                custom_format = CustomFormat(**format_data)
                converted_format = converter.convert_format(
                    custom_format, target_app)
                if not converted_format:
                    raise ValueError("Format conversion failed")

                # Create base compiled data with ordered fields
                compiled_data = {'name': format_name}  # Start with name

                # Check rename status and add field right after name if true
                if is_format_in_renames(original_name):
                    compiled_data['includeCustomFormatWhenRenaming'] = True
                    logger.info(
                        f"Format {original_name} has renames enabled, including field"
                    )

                # Add specifications last
                compiled_data['specifications'] = [
                    vars(spec) for spec in converted_format.specifications
                ]

                logger.debug(f"Compiled format: {compiled_data['name']}")

                result = process_format(compiled_data, existing_names,
                                        base_url, api_key)
                if result['success']:
                    results[result['action']] += 1
                else:
                    results['failed'] += 1
                    results['success'] = False

                results['details'].append(result['detail'])

            except Exception as e:
                logger.error(
                    f"Error processing format {format_name}: {str(e)}")
                results['failed'] += 1
                results['success'] = False
                results['details'].append({
                    'name': format_name,
                    'action': 'failed',
                    'success': False,
                    'error': str(e)
                })

        logger.info(
            f"Importing {len(format_names)} formats complete. "
            f"Added: {results['added']}, Updated: {results['updated']}, "
            f"Failed: {results['failed']}")
        return results

    except Exception as e:
        logger.error(f"Error in import_formats_to_arr: {str(e)}")
        return {'success': False, 'error': str(e)}


async def async_import_formats_to_arr(format_names: List[str], 
                                     base_url: str, 
                                     api_key: str, 
                                     arr_type: str,
                                     original_names: List[str]) -> Dict:
    """
    Asynchronous version of import_formats_to_arr that processes formats concurrently.
    This significantly improves performance for large batches.
    """
    logger.info(
        f"Received {len(format_names)} formats to import (async) for {arr_type}")
    results = {
        'success': True,
        'added': 0,
        'updated': 0,
        'failed': 0,
        'details': []
    }

    try:
        logger.info("Looking for existing formats (async)...")
        existing_formats = await async_get_existing_formats(base_url, api_key)
        if existing_formats is None:
            return {
                'success': False,
                'error': 'Failed to get existing formats'
            }

        existing_names = {fmt['name']: fmt['id'] for fmt in existing_formats}

        # Load patterns - this doesn't need to be async as it's file system operations
        patterns = {}
        for pattern_file in Path(REGEX_DIR).glob('*.yml'):
            try:
                pattern_data = load_yaml_file(str(pattern_file))
                if pattern_data and 'name' in pattern_data and 'pattern' in pattern_data:
                    patterns[pattern_data['name']] = pattern_data['pattern']
            except Exception as e:
                logger.error(
                    f"Error loading pattern file {pattern_file}: {str(e)}")
                continue

        converter = FormatConverter(patterns)
        target_app = TargetApp.RADARR if arr_type.lower() == 'radarr' else TargetApp.SONARR
        
        # Process all formats into API-ready format first
        compiled_formats = []
        format_tasks = []
        
        for i, format_name in enumerate(format_names):
            try:
                # Use original name for file lookup
                original_name = original_names[i]
                format_file = f"{get_category_directory('custom_format')}/{original_name}.yml"
                format_data = load_yaml_file(format_file)
                logger.debug(f"Received format: {format_data['name']} (async)")

                custom_format = CustomFormat(**format_data)
                converted_format = converter.convert_format(custom_format, target_app)
                if not converted_format:
                    raise ValueError("Format conversion failed")

                # Create base compiled data with ordered fields
                compiled_data = {'name': format_name}  # Start with name

                # Check rename status and add field right after name if true
                if is_format_in_renames(original_name):
                    compiled_data['includeCustomFormatWhenRenaming'] = True
                    logger.info(
                        f"Format {original_name} has renames enabled, including field"
                    )

                # Add specifications last
                compiled_data['specifications'] = [
                    vars(spec) for spec in converted_format.specifications
                ]

                logger.debug(f"Compiled format: {compiled_data['name']} (async)")
                compiled_formats.append((format_name, compiled_data))
                
            except Exception as e:
                logger.error(f"Error processing format {format_name}: {str(e)}")
                results['failed'] += 1
                results['success'] = False
                results['details'].append({
                    'name': format_name,
                    'action': 'failed',
                    'success': False,
                    'error': str(e)
                })
        
        # Now create async tasks for all formats to upload them concurrently
        for format_name, compiled_data in compiled_formats:
            task = asyncio.ensure_future(
                async_process_format(
                    format_data=compiled_data,
                    existing_names=existing_names,
                    base_url=base_url,
                    api_key=api_key
                )
            )
            format_tasks.append((format_name, task))
        
        # Wait for all format uploads to complete
        for format_name, task in format_tasks:
            try:
                result = await task
                if result['success']:
                    results[result['action']] += 1
                else:
                    results['failed'] += 1
                    results['success'] = False
                
                results['details'].append(result['detail'])
            except Exception as e:
                logger.error(f"Error waiting for format task {format_name}: {str(e)}")
                results['failed'] += 1
                results['success'] = False
                results['details'].append({
                    'name': format_name,
                    'action': 'failed',
                    'success': False,
                    'error': str(e)
                })
        
        logger.info(
            f"Async importing {len(format_names)} formats complete. "
            f"Added: {results['added']}, Updated: {results['updated']}, "
            f"Failed: {results['failed']}")
        
        return results

    except Exception as e:
        logger.error(f"Error in async_import_formats_to_arr: {str(e)}")
        return {'success': False, 'error': str(e)}


def get_existing_formats(base_url, api_key):
    try:
        response = requests.get(f"{base_url.rstrip('/')}/api/v3/customformat",
                                headers={'X-Api-Key': api_key})
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        logger.error(f"Error getting existing formats: {str(e)}")
        return None


async def async_get_existing_formats(base_url: str, api_key: str) -> Optional[List[Dict]]:
    """Async version of get_existing_formats"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{base_url.rstrip('/')}/api/v3/customformat",
                headers={'X-Api-Key': api_key}
            ) as response:
                if response.status == 200:
                    return await response.json()
        return None
    except Exception as e:
        logger.error(f"Error getting existing formats (async): {str(e)}")
        return None


def process_format(format_data, existing_names, base_url, api_key):
    format_name = format_data['name']
    if format_name in existing_names:
        format_data['id'] = existing_names[format_name]
        logger.info(f"Found existing format '{format_name}'. Updating...")
        success = update_format(base_url, api_key, format_data)
        action = 'updated'
    else:
        logger.info(f"Format '{format_name}' not found. Adding...")
        success = add_format(base_url, api_key, format_data)
        action = 'added'

    logger.info(f"Format '{format_name}' import success: {success}")
    return {
        'success': success,
        'action': action if success else 'failed',
        'detail': {
            'name': format_name,
            'action': action if success else 'failed',
            'success': success
        }
    }


async def async_process_format(format_data: Dict, existing_names: Dict[str, int], 
                              base_url: str, api_key: str) -> Dict:
    """Async version of process_format"""
    format_name = format_data['name']
    if format_name in existing_names:
        format_data['id'] = existing_names[format_name]
        logger.info(f"Found existing format '{format_name}'. Updating...")
        success = await async_update_format(base_url, api_key, format_data)
        action = 'updated'
    else:
        logger.info(f"Format '{format_name}' not found. Adding...")
        success = await async_add_format(base_url, api_key, format_data)
        action = 'added'

    logger.info(f"Format '{format_name}' import success: {success}")
    return {
        'success': success,
        'action': action if success else 'failed',
        'detail': {
            'name': format_name,
            'action': action if success else 'failed',
            'success': success
        }
    }


def update_format(base_url, api_key, format_data):
    try:
        url = f"{base_url.rstrip('/')}/api/v3/customformat/{format_data['id']}"
        logger.info(f"Updating format at URL: {url}")
        response = requests.put(url,
                                headers={'X-Api-Key': api_key},
                                json=format_data)
        logger.info(f"Response status: {response.status_code}")
        return response.status_code in [200, 201, 202, 204]
    except Exception as e:
        logger.error(f"Error updating format: {str(e)}")
        return False


async def async_update_format(base_url: str, api_key: str, format_data: Dict) -> bool:
    """Async version of update_format"""
    try:
        url = f"{base_url.rstrip('/')}/api/v3/customformat/{format_data['id']}"
        logger.info(f"Updating format at URL: {url} (async)")
        async with aiohttp.ClientSession() as session:
            async with session.put(
                url,
                headers={'X-Api-Key': api_key},
                json=format_data
            ) as response:
                logger.info(f"Response status: {response.status} (async)")
                return response.status in [200, 201, 202, 204]
    except Exception as e:
        logger.error(f"Error updating format (async): {str(e)}")
        return False


def add_format(base_url, api_key, format_data):
    try:
        url = f"{base_url.rstrip('/')}/api/v3/customformat"
        logger.info(f"Adding format at URL: {url}")
        response = requests.post(url,
                                 headers={'X-Api-Key': api_key},
                                 json=format_data)
        logger.info(f"Response status: {response.status_code}")
        return response.status_code in [200, 201, 202, 204]
    except Exception as e:
        logger.error(f"Error adding format: {str(e)}")
        return False


async def async_add_format(base_url: str, api_key: str, format_data: Dict) -> bool:
    """Async version of add_format"""
    try:
        url = f"{base_url.rstrip('/')}/api/v3/customformat"
        logger.info(f"Adding format at URL: {url} (async)")
        async with aiohttp.ClientSession() as session:
            async with session.post(
                url,
                headers={'X-Api-Key': api_key},
                json=format_data
            ) as response:
                logger.info(f"Response status: {response.status} (async)")
                return response.status in [200, 201, 202, 204]
    except Exception as e:
        logger.error(f"Error adding format (async): {str(e)}")
        return False
