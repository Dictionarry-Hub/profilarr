import os
import yaml
import logging
from git import GitCommandError
from .utils import determine_type

logger = logging.getLogger(__name__)

# Define the possible states
UNRESOLVED = "UNRESOLVED"  # File is still in conflict, hasn't been resolved and not added
RESOLVED = "RESOLVED"  # File is no longer in conflict, been resolved and has been added
MODIFY_DELETE = "MODIFY_DELETE"  # One side modified the file while the other deleted it


def get_merge_conflicts(repo):
    try:
        if not os.path.exists(os.path.join(repo.git_dir, 'MERGE_HEAD')):
            logger.debug("No MERGE_HEAD found - not in merge state")
            return []

        conflicts = []
        status = repo.git.status('--porcelain', '-z').split('\0')
        logger.debug(f"Raw status output: {[s for s in status if s]}")

        for item in status:
            if not item or len(item) < 4:
                continue

            x, y, file_path = item[0], item[1], item[3:]
            logger.debug(
                f"Processing status item - X: {x}, Y: {y}, Path: {file_path}")

            # Check for any unmerged status including AU (Added/Unmerged)
            if ((x == 'D' and y == 'U') or (x == 'U' and y == 'D')
                    or (x == 'A' and y == 'U')):
                logger.debug("Found modify/delete conflict")
                conflict = process_modify_delete_conflict(
                    repo, file_path, deleted_in_head=(x == 'D'))
                if conflict:
                    logger.debug(f"Adding modify/delete conflict: {conflict}")
                    conflicts.append(conflict)
            elif 'U' in (x, y) or (x == 'D' and y == 'D'):
                logger.debug("Found regular conflict")
                conflict = process_conflict_file(repo, file_path)
                if conflict:
                    logger.debug(f"Adding regular conflict: {conflict}")
                    conflicts.append(conflict)

        logger.debug(f"Found {len(conflicts)} conflicts: {conflicts}")
        return conflicts
    except Exception as e:
        logger.error(f"Error getting merge conflicts: {str(e)}", exc_info=True)
        return []


def process_modify_delete_conflict(repo, file_path, deleted_in_head):
    try:
        logger.debug(f"Processing modify/delete conflict for {file_path}")
        logger.debug(f"Deleted in HEAD: {deleted_in_head}")

        # Check the current status of the file
        status_output = repo.git.status('--porcelain', file_path)
        logger.debug(f"Status output for {file_path}: {status_output}")

        # If the file exists in working directory and is staged, it's resolved
        file_exists = os.path.exists(os.path.join(repo.working_dir, file_path))
        is_staged = status_output and status_output[0] in ['M', 'A']

        # Determine the correct status
        if file_exists and is_staged:
            status = RESOLVED
        elif not file_exists and status_output.startswith('D '):
            status = RESOLVED
        else:
            status = MODIFY_DELETE

        logger.debug(f"Determined status: {status} for {file_path}")

        # Get file data based on current state
        existing_data = None
        if file_exists:
            try:
                with open(os.path.join(repo.working_dir, file_path), 'r') as f:
                    existing_data = yaml.safe_load(f.read())
            except Exception as e:
                logger.warning(f"Failed to read working dir file: {e}")

        if not existing_data:
            # Try to get MERGE_HEAD version as fallback
            existing_data = get_version_data(repo, 'MERGE_HEAD', file_path)

        if not existing_data:
            logger.warning(f"Could not get existing version for {file_path}")
            return None

        file_type = determine_type(file_path)
        logger.debug(f"File type: {file_type}")

        conflict_details = {
            'conflicting_parameters': [{
                'parameter':
                'file',
                'local_value':
                'deleted' if deleted_in_head else existing_data,
                'incoming_value':
                existing_data if deleted_in_head else 'deleted'
            }]
        }

        result = {
            'file_path': file_path,
            'type': file_type,
            'name': existing_data.get('name', os.path.basename(file_path)),
            'status': status,
            'conflict_details': conflict_details,
            'deleted_in_head': deleted_in_head
        }

        logger.debug(f"Processed modify/delete conflict result: {result}")
        return result

    except Exception as e:
        logger.error(f"Error processing modify/delete conflict: {str(e)}",
                     exc_info=True)
        return None


def process_conflict_file(repo, file_path):
    """Process a regular conflict file and return its conflict information."""
    try:
        logger.debug(f"Processing conflict file: {file_path}")

        # Get current and incoming versions
        ours_data = get_version_data(repo, 'HEAD', file_path)
        theirs_data = get_version_data(repo, 'MERGE_HEAD', file_path)

        if not ours_data or not theirs_data:
            logger.warning(
                f"Missing data for {file_path} - Ours: {bool(ours_data)}, Theirs: {bool(theirs_data)}"
            )
            return None

        conflict_details = {'conflicting_parameters': []}

        # Find conflicting fields
        for key in set(ours_data.keys()) | set(theirs_data.keys()):
            if key == 'date_modified':
                continue

            ours_value = ours_data.get(key)
            theirs_value = theirs_data.get(key)

            if ours_value != theirs_value:
                logger.debug(
                    f"Found conflict in {key} - Local: {ours_value}, Incoming: {theirs_value}"
                )
                conflict_details['conflicting_parameters'].append({
                    'parameter':
                    key,
                    'local_value':
                    ours_value,
                    'incoming_value':
                    theirs_value
                })

        # Check if file still has unmerged status
        status_output = repo.git.status('--porcelain', file_path)
        logger.debug(f"Status output for {file_path}: {status_output}")
        status = UNRESOLVED if status_output.startswith('UU') else RESOLVED

        result = {
            'file_path': file_path,
            'type': determine_type(file_path),
            'name': ours_data.get('name'),
            'status': status,
            'conflict_details': conflict_details
        }

        logger.debug(f"Processed conflict result: {result}")
        return result

    except Exception as e:
        logger.error(f"Error processing conflict file {file_path}: {str(e)}",
                     exc_info=True)
        return None


def get_version_data(repo, ref, file_path):
    """Get YAML data from a specific version of a file."""
    try:
        content = repo.git.show(f'{ref}:{file_path}')
        return yaml.safe_load(content) if content else None
    except GitCommandError as e:
        logger.warning(
            f"Failed to get version data for {ref}:{file_path}: {str(e)}")
        return None
