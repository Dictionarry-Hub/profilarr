# app/utils/hash.py

import hashlib
import logging
from typing import Dict, Any

logger = logging.getLogger('hash')


def generate_format_hash(format_name: str, profile_name: str,
                         arr_config: Dict[str, Any]) -> str:
    """
    Generate a unique hash for a format based on its name, parent profile, and arr config.
    """
    arr_identifier = f"{arr_config['name']}-{arr_config['type']}"
    hash_input = f"{format_name}:{profile_name}:{arr_identifier}".encode(
        'utf-8')
    hash_value = hashlib.sha256(hash_input).hexdigest()[:8]
    logger.info(
        f"Generated hash for format '{format_name}' in profile '{profile_name}' for {arr_identifier}"
    )
    return hash_value


def process_format_name(format_name: str, profile_name: str,
                        arr_config: Dict[str, Any]) -> str:
    """
    Process a format name and generate a unique hashed version if needed.
    """
    logger.info(f"Processing format name: {format_name}")

    if not arr_config.get('import_as_unique', False):
        logger.info(
            f"Unique import disabled, keeping original name: {format_name}")
        return format_name

    hash_value = generate_format_hash(format_name, profile_name, arr_config)
    new_name = f"{format_name} [{hash_value}]"
    logger.info(f"Format name changed: {format_name} -> {new_name}")
    return new_name


def generate_profile_hash(profile_data: Dict[str, Any],
                          arr_config: Dict[str, Any]) -> str:
    """
    Generate a unique hash for a profile based on profile name and arr name.
    """
    profile_name = profile_data.get('name', '')
    arr_name = arr_config['name']

    logger.info(f"Generating hash for profile '{profile_name}' for {arr_name}")
    hash_input = f"{profile_name}:{arr_name}".encode('utf-8')
    hash_value = hashlib.sha256(hash_input).hexdigest()[:8]
    logger.info(f"Generated profile hash: {hash_value}")
    return hash_value


def process_profile_name(profile_data: Dict[str, Any],
                         arr_config: Dict[str, Any]) -> str:
    """
    Process a profile name and generate a unique hashed version if needed.
    """
    profile_name = profile_data['name']
    logger.info(f"Processing profile name: {profile_name}")

    if not arr_config.get('import_as_unique', False):
        logger.info(
            f"Unique import disabled, keeping original name: {profile_name}")
        return profile_name

    hash_value = generate_profile_hash(profile_data, arr_config)
    new_name = f"{profile_name} [{hash_value}]"
    logger.info(f"Profile name changed: {profile_name} -> {new_name}")
    return new_name
