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
        # Local version deleted
        param_name = path or 'File'
        return [{
            'parameter': param_name,
            'local_value': '🗑️ File deleted in local version',
            'incoming_value': '📄 File exists in incoming version'
        }]
    if theirs_data is None:
        # Incoming version deleted
        param_name = path or 'File'
        return [{
            'parameter': param_name,
            'local_value': '📄 File exists in local version',
            'incoming_value': '🗑️ File deleted in incoming version'
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


def format_array_for_display(data):
    """Format array data for display in conflict resolution"""
    if isinstance(data, list):
        if not data:
            return "[] (empty array)"
        elif all(isinstance(x, dict) and 'name' in x for x in data):
            # Array of objects with names - show the names
            names = [x['name'] for x in data]
            if len(names) <= 5:
                return f"[{', '.join(names)}]"
            else:
                return f"[{', '.join(names[:5])}, ... and {len(names) - 5} more]"
        elif all(not isinstance(x, (dict, list)) for x in data):
            # Array of primitives
            if len(data) <= 5:
                return f"[{', '.join(str(x) for x in data)}]"
            else:
                return f"[{', '.join(str(x) for x in data[:5])}, ... and {len(data) - 5} more]"
        else:
            # Mixed or complex array
            return f"Array with {len(data)} items"
    return data


def compare_dicts(ours_data: Dict, theirs_data: Dict, path: str) -> List[Dict]:
    """Compare dictionaries recursively"""
    conflicts = []

    # Get all keys from both dictionaries
    all_keys = set(ours_data.keys()) | set(theirs_data.keys())

    for key in all_keys:
        new_path = f"{path}.{key}" if path else key

        if key not in ours_data:
            # Format arrays for better display when field is missing locally
            incoming_val = theirs_data[key]
            if isinstance(incoming_val, list):
                incoming_val = format_array_for_display(incoming_val)
            conflicts.append({
                'parameter': new_path,
                'local_value': None,
                'incoming_value': incoming_val
            })
        elif key not in theirs_data:
            # Format arrays for better display when field is missing remotely
            local_val = ours_data[key]
            if isinstance(local_val, list):
                local_val = format_array_for_display(local_val)
            conflicts.append({
                'parameter': new_path,
                'local_value': local_val,
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
        - incoming_name: Name from their version (if available)
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

        # Get local name
        local_name = None
        if ours_data and isinstance(ours_data, dict) and 'name' in ours_data:
            local_name = ours_data.get('name')
        
        if not local_name:
            # Strip the extension to get a cleaner name
            basename = os.path.basename(file_path)
            local_name = os.path.splitext(basename)[0]
            
        # Get incoming name
        incoming_name = None
        if theirs_data and isinstance(theirs_data, dict) and 'name' in theirs_data:
            incoming_name = theirs_data.get('name')
        
        if not incoming_name:
            # Strip the extension to get a cleaner name
            basename = os.path.basename(file_path)
            incoming_name = os.path.splitext(basename)[0]

        result = {
            'file_path': file_path,
            'type': determine_type(file_path),
            'name': local_name,
            'incoming_name': incoming_name,
            'status': status,
            'conflict_details': conflict_details
        }
        
        return result

    except Exception as e:
        logger.error(
            f"Failed to create conflict summary for {file_path}: {str(e)}")
        return None
