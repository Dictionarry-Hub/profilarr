"""Compilation functions to transform YAML data to Arr API format."""
import logging
from typing import Dict, List, Any, Optional
from .mappings import TargetApp, ValueResolver
from .utils import load_regex_patterns
from ..db.queries.format_renames import is_format_in_renames

logger = logging.getLogger(__name__)

# Cache patterns at module level to avoid reloading
_CACHED_PATTERNS = None

def get_cached_patterns():
    """Get cached regex patterns, loading them once on first access."""
    global _CACHED_PATTERNS
    if _CACHED_PATTERNS is None:
        _CACHED_PATTERNS = load_regex_patterns()
        logger.debug(f"Loaded and cached {len(_CACHED_PATTERNS)} regex patterns")
    return _CACHED_PATTERNS


def compile_format_to_api_structure(
    format_yaml: Dict[str, Any],
    arr_type: str
) -> Dict[str, Any]:
    """
    Compile a format from YAML to Arr API structure.
    
    Args:
        format_yaml: Format data from YAML file
        arr_type: 'radarr' or 'sonarr'
        
    Returns:
        Compiled format ready for API
    """
    target_app = TargetApp.RADARR if arr_type.lower() == 'radarr' else TargetApp.SONARR
    patterns = get_cached_patterns()
    
    compiled = {
        'name': format_yaml.get('name', 'Unknown')
    }
    
    # Check if format should be included in renames
    if is_format_in_renames(format_yaml.get('name', '')):
        compiled['includeCustomFormatWhenRenaming'] = True
    
    # Compile specifications from conditions
    specifications = []
    for condition in format_yaml.get('conditions', []):
        spec = _compile_condition(condition, patterns, target_app)
        if spec:
            specifications.append(spec)
    
    compiled['specifications'] = specifications
    return compiled


def _compile_condition(
    condition: Dict[str, Any],
    patterns: Dict[str, str],
    target_app: TargetApp
) -> Optional[Dict[str, Any]]:
    """Compile a single condition to specification."""
    condition_type = condition.get('type')
    
    spec = {
        'name': condition.get('name', ''),
        'negate': condition.get('negate', False),
        'required': condition.get('required', False),
        'fields': []
    }
    
    if condition_type in ['release_title', 'release_group', 'edition']:
        pattern_name = condition.get('pattern')
        pattern = patterns.get(pattern_name)
        if not pattern:
            logger.warning(f"Pattern not found: {pattern_name}")
            return None
        
        spec['implementation'] = {
            'release_title': 'ReleaseTitleSpecification',
            'release_group': 'ReleaseGroupSpecification',
            'edition': 'EditionSpecification'
        }[condition_type]
        spec['fields'] = [{'name': 'value', 'value': pattern}]
        
    elif condition_type == 'source':
        spec['implementation'] = 'SourceSpecification'
        value = ValueResolver.get_source(condition.get('source'), target_app)
        spec['fields'] = [{'name': 'value', 'value': value}]
        
    elif condition_type == 'resolution':
        spec['implementation'] = 'ResolutionSpecification'
        value = ValueResolver.get_resolution(condition.get('resolution'))
        spec['fields'] = [{'name': 'value', 'value': value}]
        
    elif condition_type == 'indexer_flag':
        spec['implementation'] = 'IndexerFlagSpecification'
        value = ValueResolver.get_indexer_flag(condition.get('flag', ''), target_app)
        spec['fields'] = [{'name': 'value', 'value': value}]
        
    elif condition_type == 'quality_modifier':
        if target_app == TargetApp.SONARR:
            return None
        spec['implementation'] = 'QualityModifierSpecification'
        value = ValueResolver.get_quality_modifier(condition.get('qualityModifier'))
        spec['fields'] = [{'name': 'value', 'value': value}]
        
    elif condition_type == 'size':
        spec['implementation'] = 'SizeSpecification'
        spec['fields'] = [
            {'name': 'min', 'value': condition.get('minSize', 0)},
            {'name': 'max', 'value': condition.get('maxSize', 0)}
        ]
        
    elif condition_type == 'language':
        spec['implementation'] = 'LanguageSpecification'
        language_name = condition.get('language', '').lower()
        try:
            language_data = ValueResolver.get_language(language_name, target_app, for_profile=False)
            spec['fields'] = [{'name': 'value', 'value': language_data['id']}]
        except Exception:
            logger.warning(f"Language not found: {language_name}")
            return None
            
    elif condition_type == 'release_type':
        # Only supported in Sonarr
        if target_app == TargetApp.RADARR:
            return None
        spec['implementation'] = 'ReleaseTypeSpecification'
        value = ValueResolver.get_release_type(condition.get('releaseType'))
        spec['fields'] = [{'name': 'value', 'value': value}]
        
    elif condition_type == 'year':
        spec['implementation'] = 'YearSpecification'
        spec['fields'] = [
            {'name': 'min', 'value': condition.get('minYear', 0)},
            {'name': 'max', 'value': condition.get('maxYear', 0)}
        ]
        
    else:
        logger.warning(f"Unknown condition type: {condition_type}")
        return None
    
    return spec


def compile_profile_to_api_structure(
    profile_yaml: Dict[str, Any],
    arr_type: str
) -> Dict[str, Any]:
    """
    Compile a profile from YAML to Arr API structure.
    
    Args:
        profile_yaml: Profile data from YAML file
        arr_type: 'radarr' or 'sonarr'
        
    Returns:
        Compiled profile ready for API
    """
    target_app = TargetApp.RADARR if arr_type.lower() == 'radarr' else TargetApp.SONARR
    quality_mappings = ValueResolver.get_qualities(target_app)
    
    compiled = {
        'name': profile_yaml.get('name', 'Unknown')
    }
    
    # Build quality items - following the structure from the working compile/profile_compiler.py
    items = []
    cutoff_id = None
    used_qualities = set()
    quality_ids_in_groups = set()
    
    # Convert group IDs (negative to positive with offset)
    def convert_group_id(group_id: int) -> int:
        if group_id < 0:
            return 1000 + abs(group_id)
        return group_id
    
    # First pass: gather quality IDs in groups to avoid duplicates
    for quality_entry in profile_yaml.get('qualities', []):
        if isinstance(quality_entry, dict) and quality_entry.get('id', 0) < 0:
            # It's a group
            for q in quality_entry.get('qualities', []):
                if isinstance(q, dict):
                    q_name = q.get('name', '')
                    mapped_name = ValueResolver.get_quality_name(q_name, target_app)
                    if mapped_name in quality_mappings:
                        quality_ids_in_groups.add(quality_mappings[mapped_name]['id'])
    
    # Second pass: add groups and individual qualities
    for quality_entry in profile_yaml.get('qualities', []):
        if isinstance(quality_entry, dict):
            if quality_entry.get('id', 0) < 0:
                # It's a group
                group_id = convert_group_id(quality_entry.get('id', 0))
                group_item = {
                    'id': group_id,
                    'name': quality_entry.get('name', 'Group'),
                    'items': [],
                    'allowed': True
                }
                
                for q in quality_entry.get('qualities', []):
                    if isinstance(q, dict):
                        q_name = q.get('name', '')
                        mapped_name = ValueResolver.get_quality_name(q_name, target_app)
                        if mapped_name in quality_mappings:
                            group_item['items'].append({
                                'quality': quality_mappings[mapped_name].copy(),
                                'items': [],
                                'allowed': True
                            })
                            used_qualities.add(mapped_name.upper())
                
                if group_item['items']:
                    items.append(group_item)
            else:
                # Individual quality
                q_name = quality_entry.get('name', '')
                mapped_name = ValueResolver.get_quality_name(q_name, target_app)
                if mapped_name in quality_mappings:
                    items.append({
                        'quality': quality_mappings[mapped_name].copy(),
                        'items': [],
                        'allowed': True
                    })
                    used_qualities.add(mapped_name.upper())
        elif isinstance(quality_entry, str):
            # Simple quality name string
            mapped_name = ValueResolver.get_quality_name(quality_entry, target_app)
            if mapped_name in quality_mappings:
                items.append({
                    'quality': quality_mappings[mapped_name].copy(),
                    'items': [],
                    'allowed': True
                })
                used_qualities.add(mapped_name.upper())
    
    # Add all unused qualities as disabled
    for quality_name, quality_data in quality_mappings.items():
        if (quality_name.upper() not in used_qualities and 
            quality_data['id'] not in quality_ids_in_groups):
            items.append({
                'quality': quality_data.copy(),
                'items': [],
                'allowed': False
            })
    
    # Handle cutoff/upgrade_until
    if 'upgrade_until' in profile_yaml and isinstance(profile_yaml['upgrade_until'], dict):
        cutoff_id_raw = profile_yaml['upgrade_until'].get('id')
        cutoff_name = profile_yaml['upgrade_until'].get('name', '')
        mapped_cutoff_name = ValueResolver.get_quality_name(cutoff_name, target_app)
        
        if cutoff_id_raw and cutoff_id_raw < 0:
            cutoff_id = convert_group_id(cutoff_id_raw)
        elif mapped_cutoff_name in quality_mappings:
            cutoff_id = quality_mappings[mapped_cutoff_name]['id']
    
    # Handle language
    language = profile_yaml.get('language', 'any')
    if language != 'any' and '_' not in language:
        # Simple language mode
        try:
            language_data = ValueResolver.get_language(language, target_app, for_profile=True)
        except Exception:
            language_data = ValueResolver.get_language('any', target_app, for_profile=True)
    else:
        # Advanced mode or any
        language_data = ValueResolver.get_language('any', target_app, for_profile=True)
    
    # Build format items (without IDs, those get synced later)
    format_items = []
    
    # Add language-specific formats for advanced mode
    if language != 'any' and '_' in language:
        behavior, language_code = language.split('_', 1)
        
        # Add "Not [Language]" format with appropriate score
        # Use proper capitalization for the language name
        lang_display = language_code.capitalize()
        not_language_name = f"Not {lang_display}"
        format_items.append({
            'name': not_language_name,
            'score': -9999  # Standard score for language exclusion
        })
        
        # For 'only' behavior, add additional formats
        if behavior == 'only':
            format_items.append({
                'name': f"Not Only {lang_display}",
                'score': -9999
            })
            format_items.append({
                'name': f"Not Only {lang_display} (Missing)",
                'score': -9999
            })
    
    # Main custom formats
    for cf in profile_yaml.get('custom_formats', []):
        format_items.append({
            'name': cf.get('name'),
            'score': cf.get('score', 0)
        })
    
    # App-specific custom formats
    app_key = f'custom_formats_{arr_type.lower()}'
    for cf in profile_yaml.get(app_key, []):
        format_items.append({
            'name': cf.get('name'),
            'score': cf.get('score', 0)
        })
    
    # Reverse items to match expected order
    items.reverse()
    
    compiled['items'] = items
    compiled['language'] = language_data
    compiled['upgradeAllowed'] = profile_yaml.get('upgradesAllowed', True)
    compiled['minFormatScore'] = profile_yaml.get('minCustomFormatScore', 0)
    compiled['cutoffFormatScore'] = profile_yaml.get('upgradeUntilScore', 0)
    compiled['formatItems'] = format_items
    
    if cutoff_id is not None:
        compiled['cutoff'] = cutoff_id
    
    # Handle minUpgradeFormatScore with proper default
    compiled['minUpgradeFormatScore'] = max(1, profile_yaml.get('minScoreIncrement', 1))
    
    return compiled