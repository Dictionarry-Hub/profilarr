# app/compile/format_compiler.py
"""Format compilation module for converting custom formats"""
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional
import json
import yaml

from .mappings import TargetApp, ValueResolver


@dataclass
class Specification:
    """Data class for format specifications"""
    name: str
    implementation: str
    negate: bool = False
    required: bool = False
    fields: List[Dict[str, str]] = None

    def __post_init__(self):
        if self.fields is None:
            self.fields = []


@dataclass
class CustomFormat:
    """Data class for custom format definitions"""
    name: str
    description: str
    tags: List[str]
    conditions: List[Dict]
    tests: List[Dict]


@dataclass
class ConvertedFormat:
    """Data class for converted format output"""
    name: str
    specifications: List[Specification]


class FormatConverter:
    """Converts between different format types"""

    def __init__(self, patterns: Dict[str, str]):
        self.patterns = patterns

    def _create_specification(
            self, condition: Dict,
            target_app: TargetApp) -> Optional[Specification]:
        condition_type = condition['type']

        if condition_type in ['release_title', 'release_group', 'edition']:
            pattern_name = condition['pattern']
            pattern = self.patterns.get(pattern_name)
            if not pattern:
                return None
            implementation = ('ReleaseTitleSpecification'
                              if condition_type == 'release_title' else
                              'ReleaseGroupSpecification' if condition_type
                              == 'release_group' else 'EditionSpecification')
            fields = [{'name': 'value', 'value': pattern}]

        elif condition_type == 'source':
            implementation = 'SourceSpecification'
            value = ValueResolver.get_source(condition['source'], target_app)
            fields = [{'name': 'value', 'value': value}]

        elif condition_type == 'resolution':
            implementation = 'ResolutionSpecification'
            value = ValueResolver.get_resolution(condition['resolution'])
            fields = [{'name': 'value', 'value': value}]

        elif condition_type == 'indexer_flag':
            implementation = 'IndexerFlagSpecification'
            value = ValueResolver.get_indexer_flag(condition.get('flag', ''),
                                                   target_app)
            fields = [{'name': 'value', 'value': value}]

        elif condition_type == 'quality_modifier':
            if target_app == TargetApp.SONARR:
                return None
            implementation = 'QualityModifierSpecification'
            value = ValueResolver.get_quality_modifier(
                condition['qualityModifier'])
            fields = [{'name': 'value', 'value': value}]

        elif condition_type == 'size':
            implementation = 'SizeSpecification'
            min_size = condition.get('minSize')
            max_size = condition.get('maxSize')
            fields = [{
                'name': 'min',
                'value': min_size
            }, {
                'name': 'max',
                'value': max_size
            }]

        elif condition_type == 'year':
            implementation = 'YearSpecification'
            min_year = condition.get('minYear')
            max_year = condition.get('maxYear')
            fields = [{
                'name': 'min',
                'value': min_year
            }, {
                'name': 'max',
                'value': max_year
            }]

        elif condition_type == 'language':
            implementation = 'LanguageSpecification'
            language_name = condition['language'].lower()
            try:
                language_data = ValueResolver.get_language(language_name,
                                                           target_app,
                                                           for_profile=False)
                fields = [{'name': 'value', 'value': language_data['id']}]
                if 'exceptLanguage' in condition:
                    except_value = condition['exceptLanguage']
                    fields.append({
                        'name': 'exceptLanguage',
                        'value': except_value
                    })
            except Exception:
                return None

        # still need to do release type
        else:
            return None

        return Specification(name=condition.get('name', ''),
                             implementation=implementation,
                             negate=condition.get('negate', False),
                             required=condition.get('required', False),
                             fields=fields)

    def convert_format(self, custom_format: CustomFormat,
                       target_app: TargetApp) -> ConvertedFormat:
        specifications = []
        for condition in custom_format.conditions:
            try:
                spec = self._create_specification(condition, target_app)
                if spec:
                    specifications.append(spec)
            except Exception:
                continue

        return ConvertedFormat(name=custom_format.name,
                               specifications=specifications)


class FormatProcessor:
    """Main class for processing format files"""

    def __init__(self, input_dir: Path, output_dir: Path, patterns_dir: Path):
        self.input_dir = input_dir
        self.output_dir = output_dir
        self.patterns = self._load_patterns(patterns_dir)
        self.converter = FormatConverter(self.patterns)

    @staticmethod
    def _load_patterns(patterns_dir: Path) -> Dict[str, str]:
        patterns = {}
        for file_path in patterns_dir.glob('*.yml'):
            with file_path.open('r') as f:
                pattern_data = yaml.safe_load(f)
                patterns[pattern_data['name']] = pattern_data['pattern']
        return patterns

    def _load_custom_format(self, format_name: str) -> Optional[CustomFormat]:
        format_path = self.input_dir / f"{format_name}.yml"
        if not format_path.exists():
            return None

        with format_path.open('r') as f:
            raw_data = yaml.safe_load(f)
            return CustomFormat(**raw_data)

    def process_format(self,
                       format_name: str,
                       target_app: TargetApp,
                       return_data: bool = False) -> Optional[ConvertedFormat]:
        custom_format = self._load_custom_format(format_name)
        if not custom_format:
            return None

        converted_format = self.converter.convert_format(
            custom_format, target_app)

        output_data = [{
            'name':
            converted_format.name,
            'specifications':
            [vars(spec) for spec in converted_format.specifications]
        }]

        if not return_data:
            output_path = self.output_dir / f"{format_name}.json"
            with output_path.open('w') as f:
                json.dump(output_data, f, indent=2)

        return converted_format


def compile_custom_format(format_data: Dict) -> List[Dict]:
    custom_format = CustomFormat(**format_data)
    patterns = {}
    converter = FormatConverter(patterns)
    converted = converter.convert_format(custom_format, TargetApp.RADARR)
    output_data = [{
        'name':
        converted.name,
        'specifications': [vars(spec) for spec in converted.specifications]
    }]
    return output_data
