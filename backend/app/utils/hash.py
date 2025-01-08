# app/utils/hash.py

import hashlib
from typing import Dict, Any


def generate_format_hash(format_name: str, profile_name: str,
                         arr_config: Dict[str, Any]) -> str:
    """
    Generate a unique hash for a format based on its name, parent profile, and arr config.
    """
    arr_identifier = f"{arr_config['name']}-{arr_config['type']}"
    hash_input = f"{format_name}:{profile_name}:{arr_identifier}".encode(
        'utf-8')
    return hashlib.sha256(hash_input).hexdigest()[:8]


def process_format_name(format_name: str, profile_name: str,
                        arr_config: Dict[str, Any]) -> str:
    """
    Process a format name and generate a unique hashed version if needed.
    """
    if not arr_config.get('import_as_unique', False):
        return format_name

    hash_value = generate_format_hash(format_name, profile_name, arr_config)
    return f"{format_name} [{hash_value}]"


def generate_profile_hash(profile_data: Dict[str, Any],
                          arr_config: Dict[str, Any]) -> str:
    """
    Generate a unique hash for a profile based on profile name and arr name.
    """
    profile_name = profile_data.get('name', '')
    arr_name = arr_config['name']
    hash_input = f"{profile_name}:{arr_name}".encode('utf-8')
    return hashlib.sha256(hash_input).hexdigest()[:8]


def process_profile_name(profile_data: Dict[str, Any],
                         arr_config: Dict[str, Any]) -> str:
    """
    Process a profile name and generate a unique hashed version if needed.
    """
    profile_name = profile_data['name']
    if not arr_config.get('import_as_unique', False):
        return profile_name

    hash_value = generate_profile_hash(profile_data, arr_config)
    return f"{profile_name} [{hash_value}]"
