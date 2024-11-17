import os
import yaml
import logging
from git import GitCommandError
from .utils import determine_type

logger = logging.getLogger(__name__)

# Define the possible states
UNRESOLVED = "UNRESOLVED"  # File is still in conflict, hasn't been resolved and not added
RESOLVED = "RESOLVED"  # File is no longer in conflict, been resolved and has been added


def get_merge_conflicts(repo):
    """Get all merge conflicts in the repository."""
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

            if 'U' in (x, y) or (x == 'D' and y == 'D'):
                conflict = process_conflict_file(repo, file_path)
                if conflict:
                    conflicts.append(conflict)

        logger.debug(f"Found {len(conflicts)} conflicts")
        return conflicts

    except Exception as e:
        logger.error(f"Error getting merge conflicts: {str(e)}", exc_info=True)
        return []


def process_conflict_file(repo, file_path):
    """Process a single conflict file and return its conflict information."""
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

        # Check if file still has unmerged (UU) status
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
        logger.error(
            f"Error getting version data for {ref}:{file_path}: {str(e)}")
        return None
