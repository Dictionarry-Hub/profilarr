"""Profile compilation module for converting quality profiles"""
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Any, Callable
import json
import yaml
import logging

from .mappings import TargetApp, ValueResolver
from ..data.utils import load_yaml_file, get_category_directory
from ..importarr.format_memory import import_format_from_memory

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

    def _process_language_formats(
            self,
            behaviour: str,
            language: str,
            import_as_unique: bool = False) -> List[Dict]:
        if not self.base_url or not self.api_key or not self.format_importer:
            logger.error("Missing required credentials or format importer")
            raise ValueError(
                "base_url, api_key, and format_importer are required for language format processing"
            )

        try:
            formats_to_import = []
            format_configs = []

            base_format_path = f"{get_category_directory('custom_format')}/Not English.yml"
            base_format = load_yaml_file(base_format_path)

            language_data = ValueResolver.get_language(language,
                                                       self.target_app,
                                                       for_profile=False)

            modified_format = base_format.copy()
            base_name = f"Not {language_data['name']}"
            modified_format['name'] = base_name

            for condition in modified_format['conditions']:
                if condition.get('type') == 'language':
                    condition['language'] = language
                    if condition.get('name') == 'Not English':
                        condition['name'] = f"Not {language_data['name']}"
                    elif condition.get('name') == 'Includes English':
                        condition['name'] = f"Includes {language_data['name']}"

            formats_to_import.append(modified_format)

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

            arr_type = 'radarr' if self.target_app == TargetApp.RADARR else 'sonarr'
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

    def convert_quality_group(self, group: Dict) -> Dict:
        original_id = group.get("id", 0)
        converted_id = self._convert_group_id(original_id)

        allowed_qualities = []
        for q_item in group.get("qualities", []):
            input_name = q_item.get("name", "")

            # First map the quality name to handle remux qualities properly
            mapped_name = ValueResolver.get_quality_name(
                input_name, self.target_app)

            # Create a case-insensitive lookup map
            quality_map = {k.lower(): k for k in self.quality_mappings}

            # Try to find the mapped name in quality mappings
            if mapped_name.lower() in quality_map:
                allowed_qualities.append(quality_map[mapped_name.lower()])
            # Fallback to the original name
            elif input_name.lower() in quality_map:
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
        quality_ids_in_groups = set()
        
        # First pass: Gather all quality IDs in groups to avoid duplicates
        for quality_entry in profile.get("qualities", []):
            if quality_entry.get("id", 0) < 0:  # It's a group
                # Process this group to collect quality IDs
                converted_group = self.convert_quality_group(quality_entry)
                for item in converted_group["items"]:
                    if "quality" in item and "id" in item["quality"]:
                        quality_ids_in_groups.add(item["quality"]["id"])

        # Second pass: Add groups and individual qualities to the profile
        for quality_entry in profile.get("qualities", []):
            if quality_entry.get("id", 0) < 0:  # It's a group
                converted_group = self.convert_quality_group(quality_entry)
                if converted_group["items"]:
                    converted_profile.items.append(converted_group)
                    for q in quality_entry.get("qualities", []):
                        used_qualities.add(q.get("name", "").upper())
            else:  # It's a single quality
                quality_name = quality_entry.get("name")
                mapped_name = ValueResolver.get_quality_name(
                    quality_name, self.target_app)
                if mapped_name in self.quality_mappings:
                    converted_profile.items.append({
                        "quality": self.quality_mappings[mapped_name],
                        "items": [],
                        "allowed": True
                    })
                    used_qualities.add(mapped_name.upper())

        # Add all unused qualities as disabled, but skip those already in groups
        for quality_name, quality_data in self.quality_mappings.items():
            if (quality_name.upper() not in used_qualities and 
                quality_data["id"] not in quality_ids_in_groups):
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
