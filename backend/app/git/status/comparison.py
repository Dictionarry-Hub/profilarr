import logging
import os
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


def compare_yaml(old_data: Any,
                 new_data: Any,
                 path: str = "") -> List[Dict[str, Any]]:
    """
    Recursively compare two YAML structures and generate a list of changes.
    Handles nested structures including:
    - Simple values (strings, numbers, booleans)
    - Lists of primitives (like tags: ['1080p', 'x264'])
    - Lists of objects (like custom_formats: [{name: 'DON', score: 80}])
    - Nested objects (like qualities: {id: 1, name: 'HD', qualities: [...]})

    Args:
        old_data: Original data structure
        new_data: New data structure to compare against
        path: Current path in the data structure (for tracking nested changes)

    Returns:
        List of changes, where each change is a dict containing:
        {
            key: Path to the changed field (e.g. "custom_formats[DON].score")
            change: 'added' | 'removed' | 'modified'
            from: Original value (for modified/removed)
            to: New value (for modified/added)
            value: List of values (for array additions/removals)
        }
    """
    logger.debug(f"Comparing path: {path or 'root'}")
    changes = []

    if old_data is None and new_data is None:
        return changes

    if old_data is None and new_data is not None:
        if isinstance(new_data, dict):
            old_data = {}
        elif isinstance(new_data, list):
            old_data = []
        else:
            old_data = None

    if old_data is not None and new_data is None:
        logger.debug(f"Path {path} removed")
        return [{"key": path, "change": "removed", "from": old_data}]

    if type(old_data) != type(new_data):
        logger.debug(
            f"Type mismatch at {path}: {type(old_data)} → {type(new_data)}")
        return [{
            "key": path,
            "change": "modified",
            "from": old_data,
            "to": new_data
        }]

    if isinstance(old_data, list):
        has_objects = any(
            isinstance(x, dict) for x in old_data + new_data if x is not None)
        if has_objects:
            try:
                old_dict = {x.get("name"): x for x in old_data if x}
                new_dict = {x.get("name"): x for x in new_data if x}
                added = set(new_dict) - set(old_dict)
                removed = set(old_dict) - set(new_dict)
                common = set(old_dict) & set(new_dict)

                if added:
                    logger.debug(f"Added items at {path}: {added}")
                if removed:
                    logger.debug(f"Removed items at {path}: {removed}")

                for key in added:
                    changes.append({
                        "key": f"{path}[{key}]",
                        "change": "added",
                        "to": new_dict[key]
                    })
                for key in removed:
                    changes.append({
                        "key": f"{path}[{key}]",
                        "change": "removed",
                        "from": old_dict[key]
                    })
                for key in common:
                    if old_dict[key] != new_dict[key]:
                        logger.debug(
                            f"Found changes in common item {key} at {path}")
                        changes.extend(
                            compare_yaml(old_dict[key], new_dict[key],
                                         f"{path}[{key}]"))
            except Exception as e:
                logger.warning(
                    f"Failed to compare by name at {path}, falling back to index comparison: {str(e)}"
                )
                for i, (old_item,
                        new_item) in enumerate(zip(old_data, new_data)):
                    if old_item != new_item:
                        changes.extend(
                            compare_yaml(old_item, new_item, f"{path}[{i}]"))
        else:
            old_set = set(old_data)
            new_set = set(new_data)
            if added := new_set - old_set:
                logger.debug(f"Added values at {path}: {added}")
                changes.append({
                    "key": path,
                    "change": "added",
                    "value": sorted([x for x in added if x is not None])
                })
            if removed := old_set - new_set:
                logger.debug(f"Removed values at {path}: {removed}")
                changes.append({
                    "key": path,
                    "change": "removed",
                    "value": sorted([x for x in removed if x is not None])
                })

    elif isinstance(old_data, dict):
        all_keys = set(old_data) | set(new_data)
        for key in all_keys:
            new_path = f"{path}.{key}" if path else key
            if key not in old_data:
                logger.debug(f"Added key at {new_path}")
                changes.append({
                    "key": new_path,
                    "change": "added",
                    "to": new_data[key]
                })
            elif key not in new_data:
                logger.debug(f"Removed key at {new_path}")
                changes.append({
                    "key": new_path,
                    "change": "removed",
                    "from": old_data[key]
                })
            else:
                changes.extend(
                    compare_yaml(old_data[key], new_data[key], new_path))
    else:
        if old_data != new_data:
            logger.debug(f"Modified value at {path}: {old_data} → {new_data}")
            changes.append({
                "key": path,
                "change": "modified",
                "from": old_data,
                "to": new_data
            })

    for c in changes:
        if c["change"] == "added" and "from" not in c:
            c["from"] = "~"
    return changes


def normalize_yaml_keys(data):
    """Convert boolean keys to strings in YAML data to avoid JSON serialization issues"""
    if isinstance(data, dict):
        return {str(k): normalize_yaml_keys(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [normalize_yaml_keys(item) for item in data]
    else:
        return data


def create_change_summary(old_data: Optional[Dict], new_data: Optional[Dict],
                          file_path: str) -> Dict[str, Any]:
    """
    Create a summary of changes between two YAML structures with file metadata.
    This wrapper adds git-specific fields like name, status, and file path.
    Args:
        old_data: Original YAML data (from git HEAD)
        new_data: New YAML data (from working directory)
        file_path: Path to the file being compared

    Returns:
        Dict containing:
        - name: Current name (from new_data or filename)
        - prior_name: Previous name (from old_data)
        - outgoing_name: New name if changed, else None
        - status: 'New' | 'Modified' | 'Deleted'
        - file_path: Path to the file
        - modified: True if file was modified/added
        - deleted: True if file was deleted
        - changes: Detailed changes from compare_yaml
    """
    try:
        # Normalize keys to avoid JSON serialization issues with boolean keys
        old_data = normalize_yaml_keys(old_data) if old_data else None
        new_data = normalize_yaml_keys(new_data) if new_data else None
        filename = os.path.basename(file_path)
        new_name = new_data.get("name") if new_data else None
        old_name = old_data.get("name") if old_data else None
        current_name = new_name or filename

        if old_data is None and new_data is not None:
            status = "New"
            logger.info(f"New file detected: {file_path}")
        elif old_data is not None and new_data is None:
            status = "Deleted"
            logger.info(f"Deleted file detected: {file_path}")
        else:
            status = "Modified"
            logger.info(f"Modified file detected: {file_path}")

        detailed_changes = compare_yaml(old_data, new_data)

        if detailed_changes:
            logger.info(
                f"Found {len(detailed_changes)} changes in {file_path}")
            logger.debug(f"Detailed changes: {detailed_changes}")

        return {
            "name": current_name,
            "prior_name": old_name,
            "outgoing_name": new_name if new_name != old_name else None,
            "status": status,
            "file_path": file_path,
            "modified": status != "Deleted",
            "deleted": status == "Deleted",
            "changes": detailed_changes
        }
    except Exception as e:
        logger.error(
            f"Error creating change summary for {file_path}: {str(e)}",
            exc_info=True)
        raise
