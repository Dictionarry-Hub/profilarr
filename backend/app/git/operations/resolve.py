# git/operations/resolve.py

import yaml
from git import GitCommandError
import logging
from typing import Dict, Any
import os
from copy import deepcopy

logger = logging.getLogger(__name__)


def get_version_data(repo, ref, file_path):
    """Get YAML data from a specific version of a file."""
    try:
        content = repo.git.show(f'{ref}:{file_path}')
        return yaml.safe_load(content) if content else None
    except GitCommandError:
        return None


def resolve_conflicts(
        repo, resolutions: Dict[str, Dict[str, str]]) -> Dict[str, Any]:
    logger.debug(f"Received resolutions for files: {list(resolutions.keys())}")
    """
    Resolve merge conflicts based on provided resolutions.
    """
    # Get list of conflicting files
    try:
        status = repo.git.status('--porcelain', '-z').split('\0')
        conflicts = []
        for item in status:
            if not item or len(item) < 4:
                continue
            x, y, file_path = item[0], item[1], item[3:]
            if 'U' in (x, y) or (x == 'D' and y == 'D'):
                conflicts.append(file_path)

        # Validate resolutions are for actual conflicting files
        for file_path in resolutions:
            if file_path not in conflicts:
                return {
                    'success': False,
                    'error': f"File not in conflict: {file_path}"
                }

    except Exception as e:
        return {
            'success': False,
            'error': f"Failed to get conflicts: {str(e)}"
        }

    # Store initial states for rollback
    initial_states = {}
    for file_path in resolutions:
        try:
            # Join with repo path
            full_path = os.path.join(repo.working_dir, file_path)
            with open(full_path, 'r') as f:
                initial_states[file_path] = f.read()
        except Exception as e:
            return {
                'success': False,
                'error': f"Couldn't read file {file_path}: {str(e)}"
            }

    try:
        results = {}
        for file_path, field_resolutions in resolutions.items():
            # Get all three versions
            base_data = get_version_data(repo, 'HEAD^', file_path)
            ours_data = get_version_data(repo, 'HEAD', file_path)
            theirs_data = get_version_data(repo, 'MERGE_HEAD', file_path)

            if not base_data or not ours_data or not theirs_data:
                raise Exception(f"Couldn't get all versions of {file_path}")

            # Start with a deep copy of ours_data to preserve all fields
            resolved_data = deepcopy(ours_data)

            # Track changes
            kept_values = {}
            discarded_values = {}

            # Handle each resolution field
            for field, choice in field_resolutions.items():
                if field.startswith('custom_format_'):
                    # Extract the custom_format ID
                    try:
                        cf_id = int(field.split('_')[-1])
                    except ValueError:
                        raise Exception(
                            f"Invalid custom_format ID in field: {field}")

                    # Find the custom_format in ours and theirs
                    ours_cf = next(
                        (item for item in ours_data.get('custom_formats', [])
                         if item['id'] == cf_id), None)
                    theirs_cf = next(
                        (item
                         for item in theirs_data.get('custom_formats', [])
                         if item['id'] == cf_id), None)

                    if choice == 'local' and ours_cf:
                        resolved_cf = ours_cf
                        kept_values[field] = ours_cf
                        discarded_values[field] = theirs_cf
                    elif choice == 'incoming' and theirs_cf:
                        resolved_cf = theirs_cf
                        kept_values[field] = theirs_cf
                        discarded_values[field] = ours_cf
                    else:
                        raise Exception(
                            f"Invalid choice or missing custom_format ID {cf_id} for field: {field}"
                        )

                    # Update the resolved_data's custom_formats
                    resolved_cf_list = resolved_data.get('custom_formats', [])
                    for idx, item in enumerate(resolved_cf_list):
                        if item['id'] == cf_id:
                            resolved_cf_list[idx] = resolved_cf
                            break
                    else:
                        # If not found, append it
                        resolved_cf_list.append(resolved_cf)
                    resolved_data['custom_formats'] = resolved_cf_list

                elif field.startswith('tag_'):
                    # Extract the tag name
                    tag_name = field[len('tag_'):]
                    current_tags = set(resolved_data.get('tags', []))

                    if choice == 'local':
                        # Assume 'local' means keeping the tag from ours
                        if tag_name in ours_data.get('tags', []):
                            current_tags.add(tag_name)
                            kept_values[field] = 'local'
                            discarded_values[field] = 'incoming'
                        else:
                            current_tags.discard(tag_name)
                            kept_values[field] = 'none'
                            discarded_values[field] = 'incoming'
                    elif choice == 'incoming':
                        # Assume 'incoming' means keeping the tag from theirs
                        if tag_name in theirs_data.get('tags', []):
                            current_tags.add(tag_name)
                            kept_values[field] = 'incoming'
                            discarded_values[field] = 'local'
                        else:
                            current_tags.discard(tag_name)
                            kept_values[field] = 'none'
                            discarded_values[field] = 'local'
                    else:
                        raise Exception(
                            f"Invalid choice for tag field: {field}")

                    resolved_data['tags'] = sorted(current_tags)

                else:
                    # Handle other fields
                    field_key = field
                    if choice == 'local':
                        resolved_data[field_key] = ours_data.get(field_key)
                        kept_values[field_key] = ours_data.get(field_key)
                        discarded_values[field_key] = theirs_data.get(
                            field_key)
                    elif choice == 'incoming':
                        resolved_data[field_key] = theirs_data.get(field_key)
                        kept_values[field_key] = theirs_data.get(field_key)
                        discarded_values[field_key] = ours_data.get(field_key)
                    else:
                        raise Exception(f"Invalid choice for field: {field}")

            # Write resolved version using full path
            full_path = os.path.join(repo.working_dir, file_path)
            with open(full_path, 'w') as f:
                yaml.safe_dump(resolved_data, f, default_flow_style=False)

            # Stage the resolved file
            repo.index.add([file_path])

            results[file_path] = {
                'kept_values': kept_values,
                'discarded_values': discarded_values
            }

            # Log the base, ours, theirs, and resolved versions
            logger.info(f"Successfully resolved {file_path}")
            logger.info(
                f"Base version:\n{yaml.safe_dump(base_data, default_flow_style=False)}"
            )
            logger.info(
                f"Ours version:\n{yaml.safe_dump(ours_data, default_flow_style=False)}"
            )
            logger.info(
                f"Theirs version:\n{yaml.safe_dump(theirs_data, default_flow_style=False)}"
            )
            logger.info(
                f"Resolved version:\n{yaml.safe_dump(resolved_data, default_flow_style=False)}"
            )

        logger.debug("==== Status after resolve_conflicts ====")
        status_output = repo.git.status('--porcelain', '-z').split('\0')
        for item in status_output:
            if item:
                logger.debug(f"File status: {item}")
        logger.debug("=======================================")

        return {'success': True, 'results': results}

    except Exception as e:
        # Rollback on any error using full paths
        for file_path, initial_state in initial_states.items():
            try:
                full_path = os.path.join(repo.working_dir, file_path)
                with open(full_path, 'w') as f:
                    f.write(initial_state)
            except Exception as rollback_error:
                logger.error(
                    f"Failed to rollback {file_path}: {str(rollback_error)}")

        logger.error(f"Failed to resolve conflicts: {str(e)}")
        return {'success': False, 'error': str(e)}
