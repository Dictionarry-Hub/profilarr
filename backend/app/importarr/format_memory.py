# app/importarr/format_memory.py
"""Imports custom formats from memory, not YML files"""
import requests
import logging
import json
from typing import Dict, List, Optional
from pathlib import Path
from ..data.utils import (load_yaml_file, get_category_directory, REGEX_DIR,
                          FORMAT_DIR)
from ..compile import CustomFormat, FormatConverter, TargetApp

logger = logging.getLogger('importarr')


def get_existing_formats(base_url: str, api_key: str) -> Optional[List[Dict]]:
    """Get existing custom formats from arr instance"""
    try:
        response = requests.get(f"{base_url.rstrip('/')}/api/v3/customformat",
                                headers={'X-Api-Key': api_key})
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        logger.error(f"Error getting existing formats: {str(e)}")
        return None


def process_format(format_data: Dict, existing_names: Dict[str, int],
                   base_url: str, api_key: str) -> Dict:
    """Process single format - either update or add new"""
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


def update_format(base_url: str, api_key: str, format_data: Dict) -> bool:
    """Update existing custom format"""
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


def add_format(base_url: str, api_key: str, format_data: Dict) -> bool:
    """Add new custom format"""
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


def import_format_from_memory(format_data: Dict,
                              base_url: str,
                              api_key: str,
                              arr_type: str,
                              import_as_unique: bool = False) -> Dict:
    """
    Import a format directly from memory without requiring file loading.
    
    Args:
        format_data: Dictionary containing the format specification
        base_url: Arr instance base URL
        api_key: API key for arr instance
        arr_type: Type of arr instance (radarr/sonarr)
        import_as_unique: Whether to append [Dictionarry] to format names
        
    Returns:
        Dict containing import results
    """
    results = {
        'success': True,
        'added': 0,
        'updated': 0,
        'failed': 0,
        'details': []
    }

    try:
        # Modify format name if import_as_unique is true
        original_name = format_data['name']
        if import_as_unique:
            format_data['name'] = f"{original_name} [Dictionarry]"
            logger.info(
                f"Modified format name for unique import: {format_data['name']}"
            )

        # Log the received memory-based format data
        logger.info("Received memory-based format:\n" +
                    json.dumps(format_data, indent=2))

        logger.info("Looking for existing formats (memory-based import)...")
        existing_formats = get_existing_formats(base_url, api_key)
        if existing_formats is None:
            return {
                'success': False,
                'error': 'Failed to get existing formats'
            }

        existing_format_map = {
            fmt['name']: fmt['id']
            for fmt in existing_formats
        }

        # Convert from raw data into a CustomFormat object
        custom_format = CustomFormat(**format_data)

        # Load patterns from regex directory
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

        target_app = TargetApp.RADARR if arr_type.lower(
        ) == 'radarr' else TargetApp.SONARR
        converter = FormatConverter(patterns)
        converted_format = converter.convert_format(custom_format, target_app)

        if not converted_format:
            raise ValueError("Format conversion failed")

        # Prepare final JSON data
        api_format = {
            'name':
            converted_format.name,
            'specifications':
            [vars(spec) for spec in converted_format.specifications]
        }

        logger.info("Compiled to (memory-based):\n" +
                    json.dumps([api_format], indent=2))

        # Process the compiled format (update/add)
        result = process_format(api_format, existing_format_map, base_url,
                                api_key)
        if result['success']:
            results[result['action']] += 1
        else:
            results['failed'] += 1
            results['success'] = False

        results['details'].append(result['detail'])
        return results

    except Exception as e:
        logger.error(f"Error importing format data: {str(e)}")
        return {
            'success':
            False,
            'error':
            str(e),
            'details': [{
                'name': format_data.get('name', 'unknown'),
                'action': 'failed',
                'success': False,
                'error': str(e)
            }]
        }
