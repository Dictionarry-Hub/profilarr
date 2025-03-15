"""Profile compilation module for converting quality profiles"""
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Any, Callable
import json
import yaml
import logging
import asyncio
import aiohttp

from .mappings import TargetApp, ValueResolver
from ..data.utils import load_yaml_file, get_category_directory
from ..importarr.format_memory import import_format_from_memory, async_import_format_from_memory

logger = logging.getLogger(__name__)


@dataclass
class ConvertedProfile:
    """Data class for converted profile output"""
    name: str
    items: List[Dict]
    format_items: List[Dict]
    upgrade_allowed: bool
    min_format_score: int
    cutoff_format_score: int
    min_upgrade_format_score: int
    language: Dict
    cutoff: Optional[int] = None


class ProfileConverter:
    """Converts quality profiles between different formats"""

    def __init__(self,
                 target_app: TargetApp,
                 base_url: str = None,
                 api_key: str = None,
                 format_importer: Callable = None,
                 import_as_unique: bool = False):
        self.target_app = target_app
        self.base_url = base_url
        self.api_key = api_key
        self.format_importer = format_importer
        self.import_as_unique = import_as_unique
        self.quality_mappings = ValueResolver.get_qualities(target_app)

    def _convert_group_id(self, group_id: int) -> int:
        if group_id < 0:
            return 1000 + abs(group_id)
        return group_id

    def _create_all_qualities(self,
                              allowed_qualities: List[str]) -> List[Dict]:
        qualities = []
        for quality_name in allowed_qualities:
            if quality_name in self.quality_mappings:
                qualities.append({
                    "quality":
                    self.quality_mappings[quality_name].copy(),
                    "items": [],
                    "allowed":
                    True
                })
        return qualities

    def _generate_language_formats(self,
                               behaviour: str,
                               language: str) -> List[Dict]:
        """
        Generate language-specific format configurations without importing them.
        This is useful for pre-loading and caching language formats.
        
        Args:
            behaviour: Language behavior ('must', 'prefer', 'only')
            language: Language code ('english', 'french', etc.)
            
        Returns:
            List of format configurations for the specified language
        """
        try:
            formats_to_import = []
            
            # Get the base format as a template
            base_format_path = f"{get_category_directory('custom_format')}/Not English.yml"
            base_format = load_yaml_file(base_format_path)
            
            # Get language data for translations
            language_data = ValueResolver.get_language(
                language, self.target_app, for_profile=False
            )
            
            # Create the main "Not X" format (e.g., "Not French")
            modified_format = base_format.copy()
            base_name = f"Not {language_data['name']}"
            modified_format['name'] = base_name
            
            # Update conditions to refer to the specific language
            for condition in modified_format['conditions']:
                if condition.get('type') == 'language':
                    condition['language'] = language
                    if condition.get('name') == 'Not English':
                        condition['name'] = f"Not {language_data['name']}"
                    elif condition.get('name') == 'Includes English':
                        condition['name'] = f"Includes {language_data['name']}"
            
            formats_to_import.append(modified_format)
            
            # Add additional formats for 'only' behavior
            if behaviour == 'only':
                additional_formats = [
                    "Not Only English", "Not Only English (Missing)"
                ]
                for format_name in additional_formats:
                    format_path = f"{get_category_directory('custom_format')}/{format_name}.yml"
                    format_data = load_yaml_file(format_path)
                    format_data['name'] = format_data['name'].replace(
                        'English', language_data['name'])
                    
                    for c in format_data.get('conditions', []):
                        if c.get('type') == 'language':
                            c['language'] = language
                            if c.get('name') == 'Not English':
                                c['name'] = f"Not {language_data['name']}"
                            elif c.get('name') == 'Includes English':
                                c['name'] = f"Includes {language_data['name']}"
                    
                    formats_to_import.append(format_data)
            
            return formats_to_import
            
        except Exception as e:
            logger.error(f"Error generating language formats: {str(e)}")
            raise

    def _process_language_formats(
            self,
            behaviour: str,
            language: str,
            import_as_unique: bool = False) -> List[Dict]:
        """
        Process language formats by either importing them directly or using the format_importer.
        
        When using the cached profile import, the format_importer will be a dummy function that
        just returns success without actually importing, since the formats were already imported.
        """
        try:
            # Generate the format configurations
            formats_to_import = self._generate_language_formats(behaviour, language)
            format_configs = []
            
            # Check if we're using a format importer (might be None for direct format returns)
            if self.format_importer is None:
                # No importer provided - we're in the special caching mode
                # Just create the format configs directly without importing
                logger.info(f"Using pre-cached language formats for {behaviour}_{language}")
                
                for format_data in formats_to_import:
                    format_name = format_data['name']
                    if import_as_unique:
                        format_name = f"{format_name} [Dictionarry]"
                    
                    format_configs.append({
                        'name': format_name,
                        'score': -9999
                    })
                
                return format_configs
            
            # Regular mode with an importer - check if it's our dummy cached importer
            if self.format_importer and hasattr(self.format_importer, '__name__') and self.format_importer.__name__ == 'cached_format_importer':
                logger.info(f"Using cached importer for language formats {behaviour}_{language}")
                # Simply call the dummy importer just to keep the flow consistent,
                # but we'll generate our own format configs
                self.format_importer()
                
                # Create format configs directly
                for format_data in formats_to_import:
                    format_name = format_data['name']
                    if import_as_unique:
                        format_name = f"{format_name} [Dictionarry]"
                    
                    format_configs.append({
                        'name': format_name,
                        'score': -9999
                    })
                
                return format_configs
            
            # If we've reached here, we're doing a regular import
            if not self.base_url or not self.api_key or not self.format_importer:
                logger.error("Missing required credentials or format importer")
                raise ValueError(
                    "base_url, api_key, and format_importer are required for language format processing"
                )
                
            arr_type = 'radarr' if self.target_app == TargetApp.RADARR else 'sonarr'
            
            # Use asyncio if there are multiple formats to import
            if len(formats_to_import) > 1:
                # Run in event loop
                return asyncio.run(self._async_process_language_formats(
                    formats_to_import=formats_to_import,
                    arr_type=arr_type,
                    import_as_unique=import_as_unique
                ))
            
            # For single format, use regular synchronous version
            for format_data in formats_to_import:
                try:
                    result = import_format_from_memory(
                        format_data,
                        self.base_url,
                        self.api_key,
                        arr_type,
                        import_as_unique=self.import_as_unique)
                    if not result.get('success', False):
                        logger.error(
                            f"Format import failed for: {format_data['name']}")
                        raise Exception(
                            f"Failed to import format {format_data['name']}")

                    format_name = format_data['name']
                    if import_as_unique:
                        format_name = f"{format_name} [Dictionarry]"

                    format_configs.append({
                        'name': format_name,
                        'score': -9999
                    })

                except Exception as e:
                    logger.error(
                        f"Error importing format {format_data['name']}: {str(e)}"
                    )
                    raise

            return format_configs

        except Exception as e:
            logger.error(f"Error processing language formats: {str(e)}")
            raise
    
    async def _async_process_language_formats(
            self,
            formats_to_import: List[Dict],
            arr_type: str,
            import_as_unique: bool = False) -> List[Dict]:
        """
        Asynchronous version of _process_language_formats for concurrent imports
        """
        logger.info(f"Processing language formats asynchronously: {len(formats_to_import)} formats")
        format_configs = []
        tasks = []
        
        # Create tasks for all formats
        for format_data in formats_to_import:
            task = asyncio.create_task(
                async_import_format_from_memory(
                    format_data=format_data,
                    base_url=self.base_url,
                    api_key=self.api_key,
                    arr_type=arr_type,
                    import_as_unique=self.import_as_unique
                )
            )
            tasks.append((format_data['name'], task))
        
        # Process all format import results
        for format_name, task in tasks:
            try:
                result = await task
                if not result.get('success', False):
                    logger.error(f"Format import failed for: {format_name} (async)")
                    raise Exception(f"Failed to import format {format_name}")

                display_name = format_name
                if import_as_unique:
                    display_name = f"{format_name} [Dictionarry]"

                format_configs.append({
                    'name': display_name,
                    'score': -9999
                })
            except Exception as e:
                logger.error(f"Error importing format {format_name}: {str(e)} (async)")
                raise
        
        return format_configs

    def convert_quality_group(self, group: Dict) -> Dict:
        original_id = group.get("id", 0)
        converted_id = self._convert_group_id(original_id)

        allowed_qualities = []
        for q_item in group.get("qualities", []):
            input_name = q_item.get("name", "")
            quality_map = {k.lower(): k for k in self.quality_mappings}
            if input_name.lower() in quality_map:
                allowed_qualities.append(quality_map[input_name.lower()])

        converted_group = {
            "name": group["name"],
            "items": self._create_all_qualities(allowed_qualities),
            "allowed": True,
            "id": converted_id
        }
        return converted_group

    def convert_profile(self, profile: Dict) -> ConvertedProfile:
        language = profile.get('language', 'any')

        # Handle language processing for advanced mode (with behavior_language format)
        if language != 'any' and '_' in language:
            language_parts = language.split('_', 1)
            behaviour, language_code = language_parts
            
            # Check if we're using a special importer with cached formats
            if self.format_importer and hasattr(self.format_importer, '__name__') and self.format_importer.__name__ == 'cached_format_importer':
                # If we're using the cached importer, skip processing
                # The formats were already added directly to the profile
                logger.info(f"Using pre-added language formats for {language}")
            else:
                # Normal processing path
                try:
                    language_formats = self._process_language_formats(
                        behaviour, language_code)
                    if 'custom_formats' not in profile:
                        profile['custom_formats'] = []
                    profile['custom_formats'].extend(language_formats)
                except Exception as e:
                    logger.error(f"Failed to process language formats: {e}")

        # Simple mode: just use the language directly without custom formats
        # This lets the Arr application's built-in language filter handle it

        # Get the appropriate language data for the profile
        if language != 'any' and '_' not in language:
            # Simple mode - use the language directly
            selected_language = ValueResolver.get_language(language,
                                                           self.target_app,
                                                           for_profile=True)
            logger.info(f"Using simple language mode: {language}")
            logger.info(f"Selected language data: {selected_language}")
        else:
            # Advanced mode or 'any' - set language to 'any' as filtering is done via formats
            selected_language = ValueResolver.get_language('any',
                                                           self.target_app,
                                                           for_profile=True)
            logger.info(
                f"Using advanced mode or 'any', setting language to 'any'")

        converted_profile = ConvertedProfile(
            name=profile["name"],
            upgrade_allowed=profile.get("upgradesAllowed", True),
            items=[],
            format_items=[],
            min_format_score=profile.get("minCustomFormatScore", 0),
            cutoff_format_score=profile.get("upgradeUntilScore", 0),
            min_upgrade_format_score=max(1,
                                         profile.get("minScoreIncrement", 1)),
            language=selected_language)

        used_qualities = set()

        for quality_entry in profile.get("qualities", []):
            if quality_entry.get("id", 0) < 0:
                converted_group = self.convert_quality_group(quality_entry)
                if converted_group["items"]:
                    converted_profile.items.append(converted_group)
                    for q in quality_entry.get("qualities", []):
                        used_qualities.add(q.get("name", "").upper())
            else:
                quality_name = quality_entry.get("name")
                mapped_name = ValueResolver.get_quality_name(
                    quality_name, self.target_app)
                if mapped_name in self.quality_mappings:
                    converted_profile.items.append({
                        "quality":
                        self.quality_mappings[mapped_name],
                        "items": [],
                        "allowed":
                        True
                    })
                    used_qualities.add(mapped_name.upper())

        for quality_name, quality_data in self.quality_mappings.items():
            if quality_name.upper() not in used_qualities:
                converted_profile.items.append({
                    "quality": quality_data,
                    "items": [],
                    "allowed": False
                })

        if "upgrade_until" in profile and "id" in profile["upgrade_until"]:
            cutoff_id = profile["upgrade_until"]["id"]
            cutoff_name = profile["upgrade_until"]["name"]

            mapped_cutoff_name = ValueResolver.get_quality_name(
                cutoff_name, self.target_app)

            if cutoff_id < 0:
                converted_profile.cutoff = self._convert_group_id(cutoff_id)
            else:
                converted_profile.cutoff = self.quality_mappings[
                    mapped_cutoff_name]["id"]

        for cf in profile.get("custom_formats", []):
            format_item = {"name": cf["name"], "score": cf["score"]}
            converted_profile.format_items.append(format_item)

        converted_profile.items.reverse()

        return converted_profile


class ProfileProcessor:
    """Main class for processing profile files"""

    def __init__(self,
                 input_dir: Path,
                 output_dir: Path,
                 target_app: TargetApp,
                 base_url: str = None,
                 api_key: str = None,
                 format_importer: Callable = None):
        self.input_dir = input_dir
        self.output_dir = output_dir
        self.converter = ProfileConverter(target_app, base_url, api_key,
                                          format_importer)

    def _load_profile(self, profile_name: str) -> Optional[Dict]:
        profile_path = self.input_dir / f"{profile_name}.yml"
        if not profile_path.exists():
            return None
        with profile_path.open('r') as f:
            return yaml.safe_load(f)

    def process_profile(
            self,
            profile_name: str,
            return_data: bool = False) -> Optional[ConvertedProfile]:
        profile_data = self._load_profile(profile_name)
        if not profile_data:
            return None

        converted = self.converter.convert_profile(profile_data)
        if return_data:
            return converted

        output_data = [{
            'name': converted.name,
            'upgradeAllowed': converted.upgrade_allowed,
            'items': converted.items,
            'formatItems': converted.format_items,
            'minFormatScore': converted.min_format_score,
            'cutoffFormatScore': converted.cutoff_format_score,
            'minUpgradeFormatScore': converted.min_upgrade_format_score,
            'language': converted.language
        }]

        if converted.cutoff is not None:
            output_data[0]['cutoff'] = converted.cutoff

        output_path = self.output_dir / f"{profile_name}.json"
        with output_path.open('w') as f:
            json.dump(output_data, f, indent=2)

        return converted


def compile_quality_profile(profile_data: Dict,
                            target_app: TargetApp,
                            base_url: str = None,
                            api_key: str = None,
                            format_importer: Callable = None,
                            import_as_unique: bool = False) -> List[Dict]:
    converter = ProfileConverter(target_app,
                                 base_url,
                                 api_key,
                                 format_importer,
                                 import_as_unique=import_as_unique)
    converted = converter.convert_profile(profile_data)

    output = {
        'name': converted.name,
        'upgradeAllowed': converted.upgrade_allowed,
        'items': converted.items,
        'formatItems': converted.format_items,
        'minFormatScore': converted.min_format_score,
        'cutoffFormatScore': converted.cutoff_format_score,
        'minUpgradeFormatScore': converted.min_upgrade_format_score,
        'language': converted.language
    }

    if converted.cutoff is not None:
        output['cutoff'] = converted.cutoff

    return [output]
