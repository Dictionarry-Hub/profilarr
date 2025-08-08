"""Utility functions for import operations."""
import logging
import yaml
from pathlib import Path
from typing import Dict, List, Any, Set
from ..data.utils import get_category_directory

logger = logging.getLogger(__name__)


def load_yaml(file_path: str) -> Dict[str, Any]:
    """
    Load a YAML file.
    
    Args:
        file_path: Path to YAML file (relative to data directory)
        
    Returns:
        Parsed YAML data
        
    Raises:
        FileNotFoundError: If file doesn't exist
        yaml.YAMLError: If YAML is invalid
    """
    # Handle both absolute and relative paths
    if file_path.startswith('/'):
        full_path = Path(file_path)
    else:
        # Check if it starts with a category
        if file_path.startswith('custom_format/'):
            base_dir = get_category_directory('custom_format')
            filename = file_path.replace('custom_format/', '')
            full_path = Path(base_dir) / filename
        elif file_path.startswith('profile/'):
            base_dir = get_category_directory('profile')
            filename = file_path.replace('profile/', '')
            full_path = Path(base_dir) / filename
        else:
            # Assume it's just a filename, figure out category
            full_path = Path(file_path)
    
    if not full_path.exists():
        raise FileNotFoundError(f"File not found: {full_path}")
    
    with open(full_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def extract_format_names(profile_data: Dict[str, Any]) -> Set[str]:
    """
    Extract all custom format names referenced in a profile.
    
    Args:
        profile_data: Profile YAML data
        
    Returns:
        Set of unique format names
    """
    format_names = set()
    
    # Extract from main custom_formats
    for cf in profile_data.get('custom_formats', []):
        if isinstance(cf, dict) and 'name' in cf:
            format_names.add(cf['name'])
    
    # Extract from app-specific custom_formats
    for key in ['custom_formats_radarr', 'custom_formats_sonarr']:
        for cf in profile_data.get(key, []):
            if isinstance(cf, dict) and 'name' in cf:
                format_names.add(cf['name'])
    
    return format_names


def generate_language_formats(language: str, arr_type: str) -> List[Dict[str, Any]]:
    """
    Generate language-specific format configurations.
    
    Args:
        language: Language string (e.g., 'must_english', 'prefer_french')
        arr_type: 'radarr' or 'sonarr'
        
    Returns:
        List of format configurations for language handling
    """
    if language == 'any' or '_' not in language:
        return []
    
    behavior, language_code = language.split('_', 1)
    formats = []
    
    # Load base "Not English" format as template
    try:
        base_format = load_yaml('custom_format/Not English.yml')
        
        # Create "Not [Language]" format
        not_format = base_format.copy()
        lang_display = language_code.capitalize()
        not_format['name'] = f"Not {lang_display}"
        
        # Update conditions for the specific language
        for condition in not_format.get('conditions', []):
            if condition.get('type') == 'language':
                condition['language'] = language_code
                if 'name' in condition:
                    condition['name'] = condition['name'].replace('English', lang_display)
        
        formats.append(not_format)
        
        # For 'only' behavior, add additional formats
        if behavior == 'only':
            additional_format_names = [
                "Not Only English",
                "Not Only English (Missing)"
            ]
            
            for format_name in additional_format_names:
                try:
                    additional = load_yaml(f'custom_format/{format_name}.yml')
                    additional['name'] = additional['name'].replace('English', lang_display)
                    
                    for condition in additional.get('conditions', []):
                        if condition.get('type') == 'language':
                            condition['language'] = language_code
                            if 'name' in condition:
                                condition['name'] = condition['name'].replace('English', lang_display)
                    
                    formats.append(additional)
                except Exception as e:
                    logger.warning(f"Could not load {format_name}: {e}")
        
    except Exception as e:
        logger.error(f"Failed to generate language formats for {language}: {e}")
    
    return formats


def load_regex_patterns() -> Dict[str, str]:
    """
    Load all regex patterns from the regex directory.
    
    Returns:
        Dictionary mapping pattern names to regex patterns
    """
    from ..data.utils import REGEX_DIR
    
    patterns = {}
    pattern_dir = Path(REGEX_DIR)
    
    if not pattern_dir.exists():
        logger.warning(f"Pattern directory not found: {pattern_dir}")
        return patterns
    
    for pattern_file in pattern_dir.glob('*.yml'):
        try:
            with open(pattern_file, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
                if data and 'name' in data and 'pattern' in data:
                    patterns[data['name']] = data['pattern']
        except Exception as e:
            logger.warning(f"Failed to load pattern {pattern_file}: {e}")
    
    return patterns