# app/compile/mappings.py
"""Centralized constants and mappings for arr applications"""
from enum import Enum, auto
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


class TargetApp(Enum):
    """Enum for target application types"""
    RADARR = auto()
    SONARR = auto()


class IndexerFlags:
    """Indexer flag mappings for both applications"""
    RADARR = {
        'freeleech': 1,
        'halfleech': 2,
        'double_upload': 4,
        'internal': 32,
        'scene': 128,
        'freeleech_75': 256,
        'freeleech_25': 512,
        'nuked': 2048,
        'ptp_golden': 8,
        'ptp_approved': 16
    }

    SONARR = {
        'freeleech': 1,
        'halfleech': 2,
        'double_upload': 4,
        'internal': 8,
        'scene': 16,
        'freeleech_75': 32,
        'freeleech_25': 64,
        'nuked': 128
    }


class Sources:
    """Source mappings for both applications"""
    RADARR = {
        'cam': 1,
        'telesync': 2,
        'telecine': 3,
        'workprint': 4,
        'dvd': 5,
        'tv': 6,
        'web_dl': 7,
        'webrip': 8,
        'bluray': 9
    }

    SONARR = {
        'television': 1,
        'television_raw': 2,
        'web_dl': 3,
        'webrip': 4,
        'dvd': 5,
        'bluray': 6,
        'bluray_raw': 7
    }


class Quality_Modifiers:
    """Quality modifier mappings for Radarr ONLY"""
    RADARR = {
        'none': 0,
        'regional': 1,
        'screener': 2,
        'rawhd': 3,
        'brdisk': 4,
        'remux': 5,
    }


class Release_Types:
    """Release type mappings for Sonarr ONLY"""
    SONARR = {
        'none': 0,
        'single_episode': 1,
        'multi_episode': 2,
        'season_pack': 3,
    }


class Qualities:
    """Quality mappings for both applications"""
    COMMON_RESOLUTIONS = {
        '360p': 360,
        '480p': 480,
        '540p': 540,
        '576p': 576,
        '720p': 720,
        '1080p': 1080,
        '2160p': 2160
    }

    RADARR = {
        "Unknown": {
            "id": 0,
            "name": "Unknown",
            "source": "unknown",
            "resolution": 0
        },
        "SDTV": {
            "id": 1,
            "name": "SDTV",
            "source": "tv",
            "resolution": 480
        },
        "DVD": {
            "id": 2,
            "name": "DVD",
            "source": "dvd",
            "resolution": 480
        },
        "WEBDL-1080p": {
            "id": 3,
            "name": "WEBDL-1080p",
            "source": "webdl",
            "resolution": 1080
        },
        "HDTV-720p": {
            "id": 4,
            "name": "HDTV-720p",
            "source": "tv",
            "resolution": 720
        },
        "WEBDL-720p": {
            "id": 5,
            "name": "WEBDL-720p",
            "source": "webdl",
            "resolution": 720
        },
        "Bluray-720p": {
            "id": 6,
            "name": "Bluray-720p",
            "source": "bluray",
            "resolution": 720
        },
        "Bluray-1080p": {
            "id": 7,
            "name": "Bluray-1080p",
            "source": "bluray",
            "resolution": 1080
        },
        "WEBDL-480p": {
            "id": 8,
            "name": "WEBDL-480p",
            "source": "webdl",
            "resolution": 480
        },
        "HDTV-1080p": {
            "id": 9,
            "name": "HDTV-1080p",
            "source": "tv",
            "resolution": 1080
        },
        "Raw-HD": {
            "id": 10,
            "name": "Raw-HD",
            "source": "tv",
            "resolution": 1080
        },
        "WEBRip-480p": {
            "id": 12,
            "name": "WEBRip-480p",
            "source": "webrip",
            "resolution": 480
        },
        "WEBRip-720p": {
            "id": 14,
            "name": "WEBRip-720p",
            "source": "webrip",
            "resolution": 720
        },
        "WEBRip-1080p": {
            "id": 15,
            "name": "WEBRip-1080p",
            "source": "webrip",
            "resolution": 1080
        },
        "HDTV-2160p": {
            "id": 16,
            "name": "HDTV-2160p",
            "source": "tv",
            "resolution": 2160
        },
        "WEBRip-2160p": {
            "id": 17,
            "name": "WEBRip-2160p",
            "source": "webrip",
            "resolution": 2160
        },
        "WEBDL-2160p": {
            "id": 18,
            "name": "WEBDL-2160p",
            "source": "webdl",
            "resolution": 2160
        },
        "Bluray-2160p": {
            "id": 19,
            "name": "Bluray-2160p",
            "source": "bluray",
            "resolution": 2160
        },
        "Bluray-480p": {
            "id": 20,
            "name": "Bluray-480p",
            "source": "bluray",
            "resolution": 480
        },
        "Bluray-576p": {
            "id": 21,
            "name": "Bluray-576p",
            "source": "bluray",
            "resolution": 576
        },
        "BR-DISK": {
            "id": 22,
            "name": "BR-DISK",
            "source": "bluray",
            "resolution": 1080
        },
        "DVD-R": {
            "id": 23,
            "name": "DVD-R",
            "source": "dvd",
            "resolution": 480
        },
        "WORKPRINT": {
            "id": 24,
            "name": "WORKPRINT",
            "source": "workprint",
            "resolution": 0
        },
        "CAM": {
            "id": 25,
            "name": "CAM",
            "source": "cam",
            "resolution": 0
        },
        "TELESYNC": {
            "id": 26,
            "name": "TELESYNC",
            "source": "telesync",
            "resolution": 0
        },
        "TELECINE": {
            "id": 27,
            "name": "TELECINE",
            "source": "telecine",
            "resolution": 0
        },
        "DVDSCR": {
            "id": 28,
            "name": "DVDSCR",
            "source": "dvd",
            "resolution": 480
        },
        "REGIONAL": {
            "id": 29,
            "name": "REGIONAL",
            "source": "dvd",
            "resolution": 480
        },
        "Remux-1080p": {
            "id": 30,
            "name": "Remux-1080p",
            "source": "bluray",
            "resolution": 1080
        },
        "Remux-2160p": {
            "id": 31,
            "name": "Remux-2160p",
            "source": "bluray",
            "resolution": 2160
        }
    }

    SONARR = {
        "Unknown": {
            "id": 0,
            "name": "Unknown",
            "source": "unknown",
            "resolution": 0
        },
        "SDTV": {
            "id": 1,
            "name": "SDTV",
            "source": "television",
            "resolution": 480
        },
        "DVD": {
            "id": 2,
            "name": "DVD",
            "source": "dvd",
            "resolution": 480
        },
        "WEBDL-1080p": {
            "id": 3,
            "name": "WEBDL-1080p",
            "source": "web",
            "resolution": 1080
        },
        "HDTV-720p": {
            "id": 4,
            "name": "HDTV-720p",
            "source": "television",
            "resolution": 720
        },
        "WEBDL-720p": {
            "id": 5,
            "name": "WEBDL-720p",
            "source": "web",
            "resolution": 720
        },
        "Bluray-720p": {
            "id": 6,
            "name": "Bluray-720p",
            "source": "bluray",
            "resolution": 720
        },
        "Bluray-1080p": {
            "id": 7,
            "name": "Bluray-1080p",
            "source": "bluray",
            "resolution": 1080
        },
        "WEBDL-480p": {
            "id": 8,
            "name": "WEBDL-480p",
            "source": "web",
            "resolution": 480
        },
        "HDTV-1080p": {
            "id": 9,
            "name": "HDTV-1080p",
            "source": "television",
            "resolution": 1080
        },
        "Raw-HD": {
            "id": 10,
            "name": "Raw-HD",
            "source": "televisionRaw",
            "resolution": 1080
        },
        "WEBRip-480p": {
            "id": 12,
            "name": "WEBRip-480p",
            "source": "webRip",
            "resolution": 480
        },
        "Bluray-480p": {
            "id": 13,
            "name": "Bluray-480p",
            "source": "bluray",
            "resolution": 480
        },
        "WEBRip-720p": {
            "id": 14,
            "name": "WEBRip-720p",
            "source": "webRip",
            "resolution": 720
        },
        "WEBRip-1080p": {
            "id": 15,
            "name": "WEBRip-1080p",
            "source": "webRip",
            "resolution": 1080
        },
        "HDTV-2160p": {
            "id": 16,
            "name": "HDTV-2160p",
            "source": "television",
            "resolution": 2160
        },
        "WEBRip-2160p": {
            "id": 17,
            "name": "WEBRip-2160p",
            "source": "webRip",
            "resolution": 2160
        },
        "WEBDL-2160p": {
            "id": 18,
            "name": "WEBDL-2160p",
            "source": "web",
            "resolution": 2160
        },
        "Bluray-2160p": {
            "id": 19,
            "name": "Bluray-2160p",
            "source": "bluray",
            "resolution": 2160
        },
        "Bluray-1080p Remux": {
            "id": 20,
            "name": "Bluray-1080p Remux",
            "source": "blurayRaw",
            "resolution": 1080
        },
        "Bluray-2160p Remux": {
            "id": 21,
            "name": "Bluray-2160p Remux",
            "source": "blurayRaw",
            "resolution": 2160
        },
        "Bluray-576p": {
            "id": 22,
            "name": "Bluray-576p",
            "source": "bluray",
            "resolution": 576
        }
    }


class Languages:
    """Language mappings for both applications"""
    RADARR = {
        'any': {
            'id': -1,
            'name': 'Any'
        },
        'original': {
            'id': -2,
            'name': 'Original'
        },
        'unknown': {
            'id': 0,
            'name': 'Unknown'
        },
        'english': {
            'id': 1,
            'name': 'English'
        },
        'french': {
            'id': 2,
            'name': 'French'
        },
        'spanish': {
            'id': 3,
            'name': 'Spanish'
        },
        'german': {
            'id': 4,
            'name': 'German'
        },
        'italian': {
            'id': 5,
            'name': 'Italian'
        },
        'danish': {
            'id': 6,
            'name': 'Danish'
        },
        'dutch': {
            'id': 7,
            'name': 'Dutch'
        },
        'japanese': {
            'id': 8,
            'name': 'Japanese'
        },
        'icelandic': {
            'id': 9,
            'name': 'Icelandic'
        },
        'chinese': {
            'id': 10,
            'name': 'Chinese'
        },
        'russian': {
            'id': 11,
            'name': 'Russian'
        },
        'polish': {
            'id': 12,
            'name': 'Polish'
        },
        'vietnamese': {
            'id': 13,
            'name': 'Vietnamese'
        },
        'swedish': {
            'id': 14,
            'name': 'Swedish'
        },
        'norwegian': {
            'id': 15,
            'name': 'Norwegian'
        },
        'finnish': {
            'id': 16,
            'name': 'Finnish'
        },
        'turkish': {
            'id': 17,
            'name': 'Turkish'
        },
        'portuguese': {
            'id': 18,
            'name': 'Portuguese'
        },
        'flemish': {
            'id': 19,
            'name': 'Flemish'
        },
        'greek': {
            'id': 20,
            'name': 'Greek'
        },
        'korean': {
            'id': 21,
            'name': 'Korean'
        },
        'hungarian': {
            'id': 22,
            'name': 'Hungarian'
        },
        'hebrew': {
            'id': 23,
            'name': 'Hebrew'
        },
        'lithuanian': {
            'id': 24,
            'name': 'Lithuanian'
        },
        'czech': {
            'id': 25,
            'name': 'Czech'
        },
        'hindi': {
            'id': 26,
            'name': 'Hindi'
        },
        'romanian': {
            'id': 27,
            'name': 'Romanian'
        },
        'thai': {
            'id': 28,
            'name': 'Thai'
        },
        'bulgarian': {
            'id': 29,
            'name': 'Bulgarian'
        },
        'portuguese_br': {
            'id': 30,
            'name': 'Portuguese (Brazil)'
        },
        'arabic': {
            'id': 31,
            'name': 'Arabic'
        },
        'ukrainian': {
            'id': 32,
            'name': 'Ukrainian'
        },
        'persian': {
            'id': 33,
            'name': 'Persian'
        },
        'bengali': {
            'id': 34,
            'name': 'Bengali'
        },
        'slovak': {
            'id': 35,
            'name': 'Slovak'
        },
        'latvian': {
            'id': 36,
            'name': 'Latvian'
        },
        'spanish_latino': {
            'id': 37,
            'name': 'Spanish (Latino)'
        },
        'catalan': {
            'id': 38,
            'name': 'Catalan'
        },
        'croatian': {
            'id': 39,
            'name': 'Croatian'
        },
        'serbian': {
            'id': 40,
            'name': 'Serbian'
        },
        'bosnian': {
            'id': 41,
            'name': 'Bosnian'
        },
        'estonian': {
            'id': 42,
            'name': 'Estonian'
        },
        'tamil': {
            'id': 43,
            'name': 'Tamil'
        },
        'indonesian': {
            'id': 44,
            'name': 'Indonesian'
        },
        'telugu': {
            'id': 45,
            'name': 'Telugu'
        },
        'macedonian': {
            'id': 46,
            'name': 'Macedonian'
        },
        'slovenian': {
            'id': 47,
            'name': 'Slovenian'
        },
        'malayalam': {
            'id': 48,
            'name': 'Malayalam'
        },
        'kannada': {
            'id': 49,
            'name': 'Kannada'
        },
        'albanian': {
            'id': 50,
            'name': 'Albanian'
        },
        'afrikaans': {
            'id': 51,
            'name': 'Afrikaans'
        }
    }

    SONARR = {
        'unknown': {
            'id': 0,
            'name': 'Unknown'
        },
        'english': {
            'id': 1,
            'name': 'English'
        },
        'french': {
            'id': 2,
            'name': 'French'
        },
        'spanish': {
            'id': 3,
            'name': 'Spanish'
        },
        'german': {
            'id': 4,
            'name': 'German'
        },
        'italian': {
            'id': 5,
            'name': 'Italian'
        },
        'danish': {
            'id': 6,
            'name': 'Danish'
        },
        'dutch': {
            'id': 7,
            'name': 'Dutch'
        },
        'japanese': {
            'id': 8,
            'name': 'Japanese'
        },
        'icelandic': {
            'id': 9,
            'name': 'Icelandic'
        },
        'chinese': {
            'id': 10,
            'name': 'Chinese'
        },
        'russian': {
            'id': 11,
            'name': 'Russian'
        },
        'polish': {
            'id': 12,
            'name': 'Polish'
        },
        'vietnamese': {
            'id': 13,
            'name': 'Vietnamese'
        },
        'swedish': {
            'id': 14,
            'name': 'Swedish'
        },
        'norwegian': {
            'id': 15,
            'name': 'Norwegian'
        },
        'finnish': {
            'id': 16,
            'name': 'Finnish'
        },
        'turkish': {
            'id': 17,
            'name': 'Turkish'
        },
        'portuguese': {
            'id': 18,
            'name': 'Portuguese'
        },
        'flemish': {
            'id': 19,
            'name': 'Flemish'
        },
        'greek': {
            'id': 20,
            'name': 'Greek'
        },
        'korean': {
            'id': 21,
            'name': 'Korean'
        },
        'hungarian': {
            'id': 22,
            'name': 'Hungarian'
        },
        'hebrew': {
            'id': 23,
            'name': 'Hebrew'
        },
        'lithuanian': {
            'id': 24,
            'name': 'Lithuanian'
        },
        'czech': {
            'id': 25,
            'name': 'Czech'
        },
        'arabic': {
            'id': 26,
            'name': 'Arabic'
        },
        'hindi': {
            'id': 27,
            'name': 'Hindi'
        },
        'bulgarian': {
            'id': 28,
            'name': 'Bulgarian'
        },
        'malayalam': {
            'id': 29,
            'name': 'Malayalam'
        },
        'ukrainian': {
            'id': 30,
            'name': 'Ukrainian'
        },
        'slovak': {
            'id': 31,
            'name': 'Slovak'
        },
        'thai': {
            'id': 32,
            'name': 'Thai'
        },
        'portuguese_br': {
            'id': 33,
            'name': 'Portuguese (Brazil)'
        },
        'spanish_latino': {
            'id': 34,
            'name': 'Spanish (Latino)'
        },
        'romanian': {
            'id': 35,
            'name': 'Romanian'
        },
        'latvian': {
            'id': 36,
            'name': 'Latvian'
        },
        'persian': {
            'id': 37,
            'name': 'Persian'
        },
        'catalan': {
            'id': 38,
            'name': 'Catalan'
        },
        'croatian': {
            'id': 39,
            'name': 'Croatian'
        },
        'serbian': {
            'id': 40,
            'name': 'Serbian'
        },
        'bosnian': {
            'id': 41,
            'name': 'Bosnian'
        },
        'estonian': {
            'id': 42,
            'name': 'Estonian'
        },
        'tamil': {
            'id': 43,
            'name': 'Tamil'
        },
        'indonesian': {
            'id': 44,
            'name': 'Indonesian'
        },
        'macedonian': {
            'id': 45,
            'name': 'Macedonian'
        },
        'slovenian': {
            'id': 46,
            'name': 'Slovenian'
        },
        'original': {
            'id': -2,
            'name': 'Original'
        }
    }


class QualityNameMapper:
    """Maps between different quality naming conventions"""
    REMUX_MAPPINGS = {
        TargetApp.SONARR: {
            "Remux-1080p": "Bluray-1080p Remux",
            "Remux-2160p": "Bluray-2160p Remux"
        },
        TargetApp.RADARR: {
            "Remux-1080p": "Remux-1080p",
            "Remux-2160p": "Remux-2160p"
        }
    }

    ALTERNATE_NAMES = {
        "BR-Disk": "BR-DISK",
        "BR-DISK": "BR-DISK",
        "BRDISK": "BR-DISK",
        "BR_DISK": "BR-DISK",
        "BLURAY-DISK": "BR-DISK",
        "BLURAY_DISK": "BR-DISK",
        "BLURAYDISK": "BR-DISK",
        "Telecine": "TELECINE",
        "TELECINE": "TELECINE",
        "TeleCine": "TELECINE",
        "Telesync": "TELESYNC",
        "TELESYNC": "TELESYNC",
        "TeleSync": "TELESYNC",
    }

    @classmethod
    def map_quality_name(cls, name: str, target_app: TargetApp) -> str:
        """
        Maps quality names between different formats based on target app
        Args:
            name: The quality name to map
            target_app: The target application (RADARR or SONARR)
        Returns:
            The mapped quality name
        """
        # Handle empty or None cases
        if not name:
            return name

        # First check for remux mappings
        if name in cls.REMUX_MAPPINGS.get(target_app, {}):
            return cls.REMUX_MAPPINGS[target_app][name]

        # Then check for alternate spellings
        normalized_name = name.upper().replace("-", "").replace("_", "")
        for alt_name, standard_name in cls.ALTERNATE_NAMES.items():
            if normalized_name == alt_name.upper().replace("-", "").replace(
                    "_", ""):
                return standard_name

        return name


class LanguageNameMapper:
    """Maps between different language naming conventions"""
    ALTERNATE_NAMES = {
        "spanish-latino": "spanish_latino",
        "spanish_latino": "spanish_latino",
        "spanishlatino": "spanish_latino",
        "portuguese-br": "portuguese_br",
        "portuguese_br": "portuguese_br",
        "portuguesebr": "portuguese_br",
        "portuguese-brazil": "portuguese_br",
        "portuguese_brazil": "portuguese_br"
    }

    @classmethod
    def normalize_language_name(cls, name: str) -> str:
        """
        Normalizes language names to a consistent format
        Args:
            name: The language name to normalize
        Returns:
            The normalized language name
        """
        if not name:
            return name

        normalized = name.lower().replace(" ", "_")
        return cls.ALTERNATE_NAMES.get(normalized, normalized)


class ValueResolver:
    """Helper class to resolve values based on target app"""

    @classmethod
    def get_indexer_flag(cls, flag: str, target_app: TargetApp) -> int:
        flags = IndexerFlags.RADARR if target_app == TargetApp.RADARR else IndexerFlags.SONARR
        return flags.get(flag.lower(), 0)

    @classmethod
    def get_source(cls, source: str, target_app: TargetApp) -> int:
        sources = Sources.RADARR if target_app == TargetApp.RADARR else Sources.SONARR
        return sources.get(source.lower(), 0)

    @classmethod
    def get_resolution(cls, resolution: str) -> int:
        return Qualities.COMMON_RESOLUTIONS.get(resolution.lower(), 0)

    @classmethod
    def get_qualities(cls, target_app: TargetApp) -> Dict[str, Any]:
        qualities = Qualities.RADARR if target_app == TargetApp.RADARR else Qualities.SONARR
        return qualities

    @classmethod
    def get_quality_name(cls, name: str, target_app: TargetApp) -> str:
        """Maps quality names between different formats based on target app"""
        return QualityNameMapper.map_quality_name(name, target_app)

    @classmethod
    def get_quality_modifier(cls, quality_modifier: str) -> int:
        return Quality_Modifiers.RADARR.get(quality_modifier.lower(), 0)

    @classmethod
    def get_release_type(cls, release_type: str) -> int:
        return Release_Types.SONARR.get(release_type.lower(), 0)

    @classmethod
    def get_language(cls,
                     language_name: str,
                     target_app: TargetApp,
                     for_profile: bool = True) -> Dict[str, Any]:
        """
        Get language mapping based on target app and context
        
        Args:
            language_name: Name of the language to look up
            target_app: Target application (RADARR or SONARR)
            for_profile: If True, this is for a quality profile. If False, this is for a custom format.
        """
        languages = Languages.RADARR if target_app == TargetApp.RADARR else Languages.SONARR

        # For profiles, only Radarr uses language settings
        if for_profile and target_app == TargetApp.SONARR:
            return {'id': -2, 'name': 'Original'}

        # Normalize the language name
        normalized_name = LanguageNameMapper.normalize_language_name(
            language_name)
        language_data = languages.get(normalized_name)

        if not language_data:
            logger.warning(
                f"Language '{language_name}' (normalized: '{normalized_name}') "
                f"not found in {target_app} mappings, falling back to Unknown")
            language_data = languages['unknown']

        return language_data
