import os
import yaml
import logging
from git import GitCommandError
from .conflict_comparison import create_conflict_summary, UNRESOLVED, RESOLVED, MODIFY_DELETE

logger = logging.getLogger(__name__)


def get_version_data(repo, ref, file_path):
    """Get YAML data from a specific version of a file"""
    try:
        content = repo.git.show(f'{ref}:{file_path}')
        return yaml.safe_load(content) if content else None
    except GitCommandError:
        return None


def process_modify_delete_conflict(repo, file_path, deleted_in_head):
    """Handle case where one side modified while other deleted"""
    try:
        # Check if conflict is resolved
        status_output = repo.git.status('--porcelain', file_path)
        file_exists = os.path.exists(os.path.join(repo.working_dir, file_path))
        is_staged = status_output and status_output[0] in ['M', 'A']

        # Determine status
        if (file_exists and is_staged) or (not file_exists
                                           and status_output.startswith('D ')):
            status = RESOLVED
        else:
            status = MODIFY_DELETE

        # Get the surviving version
        if file_exists:
            with open(os.path.join(repo.working_dir, file_path), 'r') as f:
                existing_data = yaml.safe_load(f.read())
        else:
            existing_data = get_version_data(repo, 'MERGE_HEAD', file_path)

        if not existing_data:
            return None

        # Create summary with the appropriate sides marked as deleted
        return create_conflict_summary(
            file_path, None if deleted_in_head else existing_data,
            existing_data if deleted_in_head else None, status)

    except Exception as e:
        logger.error(
            f"Failed to process modify/delete conflict for {file_path}: {str(e)}"
        )
        return None


def process_regular_conflict(repo, file_path):
    """Handle standard merge conflict between two versions"""
    try:
        # Get both versions
        ours_data = get_version_data(repo, 'HEAD', file_path)
        theirs_data = get_version_data(repo, 'MERGE_HEAD', file_path)

        if not ours_data and not theirs_data:
            return None

        # Check if conflict is resolved
        status_output = repo.git.status('--porcelain', file_path)
        status = UNRESOLVED if status_output.startswith('UU') else RESOLVED

        return create_conflict_summary(file_path, ours_data, theirs_data,
                                       status)

    except Exception as e:
        logger.error(f"Failed to process conflict for {file_path}: {str(e)}")
        return None


def get_merge_conflicts(repo):
    """Get all merge conflicts in the repository"""
    try:
        # Check if we're in a merge state
        if not os.path.exists(os.path.join(repo.git_dir, 'MERGE_HEAD')):
            return []

        conflicts = []
        status = repo.git.status('--porcelain', '-z').split('\0')

        # Process each status entry
        for item in status:
            if not item or len(item) < 4:
                continue

            x, y = item[0], item[1]
            file_path = item[3:]

            # Handle modify/delete conflicts
            if (x == 'D' and y == 'U') or (x == 'U'
                                           and y == 'D') or (x == 'A'
                                                             and y == 'U'):
                conflict = process_modify_delete_conflict(
                    repo, file_path, x == 'D')
                if conflict:
                    conflicts.append(conflict)

            # Handle regular conflicts
            elif 'U' in (x, y) or (x == 'D' and y == 'D'):
                conflict = process_regular_conflict(repo, file_path)
                if conflict:
                    conflicts.append(conflict)

        return conflicts

    except Exception as e:
        logger.error(f"Failed to get merge conflicts: {str(e)}")
        return []
