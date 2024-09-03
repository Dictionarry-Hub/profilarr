# git/status/utils.py

import os
import yaml
import logging

logger = logging.getLogger(__name__)

def extract_data_from_yaml(file_path):
    logger.debug(f"Extracting data from file: {file_path}")
    try:
        with open(file_path, 'r') as f:
            content = yaml.safe_load(f)
            logger.debug(f"File content: {content}")  # Log the full file content
            if content is None:
                logger.error(f"Failed to parse YAML file or file is empty: {file_path}")
                return None
            
            # Check if expected keys are in the content
            if 'name' not in content or 'id' not in content:
                logger.warning(f"'name' or 'id' not found in file: {file_path}")
            
            return {
                'name': content.get('name'),
                'id': content.get('id')
            }
    except Exception as e:
        logger.warning(f"Error reading file {file_path}: {str(e)}")
        return None

def determine_type(file_path):
    if 'regex_patterns' in file_path:
        return 'Regex Pattern'
    elif 'custom_formats' in file_path:
        return 'Custom Format'
    elif 'profiles' in file_path:
        return 'Quality Profile'
    return 'Unknown'

def interpret_git_status(x, y):
    if x == 'D' or y == 'D':
        return 'Deleted'
    elif x == 'A':
        return 'Added'
    elif x == 'M' or y == 'M':
        return 'Modified'
    elif x == 'R':
        return 'Renamed'
    elif x == 'C':
        return 'Copied'
    elif x == 'U':
        return 'Updated but unmerged'
    elif x == '?' and y == '?':
        return 'Untracked'
    else:
        return 'Unknown'
