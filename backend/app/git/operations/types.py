from dataclasses import dataclass
from typing import List, Dict, Optional, Literal
from enum import Enum


class FileType(str, Enum):
    REGEX = "regex"
    CUSTOM_FORMAT = "custom format"
    QUALITY_PROFILE = "quality profile"


class ResolutionChoice(str, Enum):
    LOCAL = "local"
    INCOMING = "incoming"


@dataclass
class TagConflict:
    tag: str
    local_status: Literal["Present", "Absent"]
    incoming_status: Literal["Present", "Absent"]
    resolution: Optional[ResolutionChoice] = None


@dataclass
class FormatConflict:
    format_id: str
    local_score: Optional[int]
    incoming_score: Optional[int]
    resolution: Optional[ResolutionChoice] = None


@dataclass
class GeneralConflict:
    key: str
    local_value: any
    incoming_value: any
    resolution: Optional[ResolutionChoice] = None


@dataclass
class FileResolution:
    file_type: FileType
    filename: str
    tags: List[TagConflict]
    formats: List[FormatConflict]
    general: List[GeneralConflict]


@dataclass
class ResolutionRequest:
    resolutions: Dict[str, FileResolution]
