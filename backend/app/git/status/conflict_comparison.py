import os
import yaml
import logging
from typing import Any, Dict, List, Optional, Union

logger = logging.getLogger(__name__)

# Define conflict states
UNRESOLVED = "UNRESOLVED"
RESOLVED = "RESOLVED"
MODIFY_DELETE = "MODIFY_DELETE"


def compare_conflict_yaml(ours_data: Any,
                          theirs_data: Any,
                          path: str = "") -> List[Dict[str, Any]]:
    """
    Compare two YAML structures and generate conflict information.
    Handles nested structures and produces conflict records in the format:
    {
        'parameter': 'Field Name',
        'local_value': value_from_ours,
        'incoming_value': value_from_theirs
    }
    """
    conflicts = []

    # Handle None/deletion cases
    if ours_data is None and theirs_data is None:
        return conflicts
    if ours_data is None:
        return [{
            'parameter': path or 'File',
            'local_value': 'deleted',
            'incoming_value': theirs_data
        }]
    if theirs_data is None:
        return [{
            'parameter': path or 'File',
            'local_value': ours_data,
            'incoming_value': 'deleted'
        }]

    # Handle different types as conflicts
    if type(ours_data) != type(theirs_data):
        return [{
            'parameter': path,
            'local_value': ours_data,
            'incoming_value': theirs_data
        }]

    # Handle lists
    if isinstance(ours_data, list):
        # Check if list contains objects
        has_objects = any(
            isinstance(x, dict) for x in ours_data + theirs_data
            if x is not None)

        if has_objects:
            return compare_object_arrays(ours_data, theirs_data, path)
        else:
            return compare_primitive_arrays(ours_data, theirs_data, path)

    # Handle dictionaries
    elif isinstance(ours_data, dict):
        return compare_dicts(ours_data, theirs_data, path)

    # Handle primitive values
    elif ours_data != theirs_data:
        return [{
            'parameter': path,
            'local_value': ours_data,
            'incoming_value': theirs_data
        }]

    return conflicts


def compare_object_arrays(ours_data: List[Dict], theirs_data: List[Dict],
                          path: str) -> List[Dict]:
    """Compare arrays of objects using name field as identifier"""
    conflicts = []

    try:
        # Build lookup dictionaries
        ours_dict = {x.get('name'): x for x in ours_data if x}
        theirs_dict = {x.get('name'): x for x in theirs_data if x}

        # Find additions/removals
        ours_keys = set(ours_dict.keys())
        theirs_keys = set(theirs_dict.keys())

        # Handle added items
        for key in (theirs_keys - ours_keys):
            conflicts.append({
                'parameter': f"{path}[{key}]" if path else key,
                'local_value': None,
                'incoming_value': theirs_dict[key]
            })

        # Handle removed items
        for key in (ours_keys - theirs_keys):
            conflicts.append({
                'parameter': f"{path}[{key}]" if path else key,
                'local_value': ours_dict[key],
                'incoming_value': None
            })

        # Compare common items
        for key in (ours_keys & theirs_keys):
            if ours_dict[key] != theirs_dict[key]:
                new_path = f"{path}[{key}]" if path else key
                conflicts.extend(
                    compare_conflict_yaml(ours_dict[key], theirs_dict[key],
                                          new_path))

    except Exception as e:
        logger.warning(
            f"Failed to compare objects by name at {path}, using positional comparison: {str(e)}"
        )
        # Fallback to positional comparison
        for i, (ours_item,
                theirs_item) in enumerate(zip(ours_data, theirs_data)):
            if ours_item != theirs_item:
                new_path = f"{path}[{i}]" if path else str(i)
                conflicts.extend(
                    compare_conflict_yaml(ours_item, theirs_item, new_path))

    return conflicts


def compare_primitive_arrays(ours_data: List, theirs_data: List,
                             path: str) -> List[Dict]:
    """Compare arrays of primitive values"""
    conflicts = []

    ours_set = set(ours_data)
    theirs_set = set(theirs_data)

    # Handle additions
    added = theirs_set - ours_set
    if added:
        conflicts.append({
            'parameter': path or 'Array',
            'local_value': sorted(list(ours_set)),
            'incoming_value': sorted(list(theirs_set))
        })

    return conflicts


def compare_dicts(ours_data: Dict, theirs_data: Dict, path: str) -> List[Dict]:
    """Compare dictionaries recursively"""
    conflicts = []

    # Get all keys from both dictionaries
    all_keys = set(ours_data.keys()) | set(theirs_data.keys())

    for key in all_keys:
        new_path = f"{path}.{key}" if path else key

        if key not in ours_data:
            conflicts.append({
                'parameter': new_path,
                'local_value': None,
                'incoming_value': theirs_data[key]
            })
        elif key not in theirs_data:
            conflicts.append({
                'parameter': new_path,
                'local_value': ours_data[key],
                'incoming_value': None
            })
        elif ours_data[key] != theirs_data[key]:
            conflicts.extend(
                compare_conflict_yaml(ours_data[key], theirs_data[key],
                                      new_path))

    return conflicts


def create_conflict_summary(file_path: str,
                            ours_data: Optional[Dict],
                            theirs_data: Optional[Dict],
                            status: str = UNRESOLVED) -> Dict[str, Any]:
    """
    Create a summary of conflicts between two versions of a file.
    
    Args:
        file_path: Path to the file in conflict
        ours_data: Our version of the YAML data
        theirs_data: Their version of the YAML data
        status: Conflict status (UNRESOLVED, RESOLVED, or MODIFY_DELETE)
    
    Returns:
        Dict containing:
        - file_path: Path to the conflicted file
        - type: Type of item
        - name: Name from our version or filename
        - status: Current conflict status
        - conflict_details: List of specific conflicts
    """
    try:
        from .utils import determine_type  # Import here to avoid circular imports

        # Generate conflict details
        conflict_details = {
            'conflicting_parameters':
            compare_conflict_yaml(ours_data, theirs_data)
        }

        # Get name from our version or fallback to filename
        name = ours_data.get('name') if ours_data else os.path.basename(
            file_path)

        return {
            'file_path': file_path,
            'type': determine_type(file_path),
            'name': name,
            'status': status,
            'conflict_details': conflict_details
        }

    except Exception as e:
        logger.error(
            f"Failed to create conflict summary for {file_path}: {str(e)}")
        return None
