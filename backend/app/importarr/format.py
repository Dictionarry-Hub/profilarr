import requests
import logging
import json
import yaml
from pathlib import Path
from ..data.utils import (load_yaml_file, get_category_directory, REGEX_DIR,
                          FORMAT_DIR)
from ..compile import CustomFormat, FormatConverter, TargetApp

logger = logging.getLogger('importarr')


def import_formats_to_arr(format_names, base_url, api_key, arr_type):
    logger.info(
        f"Received {len(format_names)} formats to import for {arr_type}")
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

        for format_name in format_names:
            try:
                format_file = f"{get_category_directory('custom_format')}/{format_name}.yml"
                format_data = load_yaml_file(format_file)
                logger.info("Received format:\n" +
                            yaml.dump(format_data, sort_keys=False))

                custom_format = CustomFormat(**format_data)
                converted_format = converter.convert_format(
                    custom_format, target_app)
                if not converted_format:
                    raise ValueError("Format conversion failed")

                compiled_data = {
                    'name':
                    converted_format.name,
                    'specifications':
                    [vars(spec) for spec in converted_format.specifications]
                }
                logger.info("Compiled to:\n" +
                            json.dumps([compiled_data], indent=2))

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
