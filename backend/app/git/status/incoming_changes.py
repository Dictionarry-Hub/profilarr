import os
import yaml
import logging
from git import GitCommandError
from .comparison import create_change_summary
from .utils import determine_type, parse_commit_message

logger = logging.getLogger(__name__)


def extract_name(file_path):
    """Extract name from file path by removing type prefix and extension"""
    # Remove the file extension
    name = os.path.splitext(file_path)[0]
    # Remove the type prefix (everything before the first '/')
    if '/' in name:
        name = name.split('/', 1)[1]
    return name


def check_merge_conflict(repo, branch, file_path):
    """Check if pulling a file would cause merge conflicts"""
    try:
        # Check for local changes (uncommitted or unpushed)
        status = repo.git.status('--porcelain', file_path).strip()
        if status:
            status_code = status[:2] if len(status) >= 2 else ''
            has_changes = 'M' in status_code or 'A' in status_code or 'D' in status_code or 'R' in status_code
        else:
            # Check for unpushed commits
            merge_base = repo.git.merge_base('HEAD',
                                             f'origin/{branch}').strip()
            committed_changes = repo.git.log(f'{merge_base}..HEAD',
                                             '--',
                                             file_path,
                                             ignore_missing=True).strip()
            has_changes = bool(committed_changes)

        if has_changes:
            # Test if merge would cause conflicts
            try:
                merge_test = repo.git.merge_tree('--write-tree', 'HEAD',
                                                 f'origin/{branch}')
                return any(
                    line.startswith('<<<<<<< ')
                    for line in merge_test.splitlines() if file_path in line)
            except GitCommandError:
                return True  # Assume conflict if merge test fails

        return False
    except Exception as e:
        logger.error(f"Failed to check conflicts for {file_path}: {str(e)}")
        return False


def get_commit_message(repo, branch, file_path):
    """Get commit message for incoming changes to a file"""
    try:
        raw_message = repo.git.show(f'HEAD...origin/{branch}', '--format=%B',
                                    '-s', '--', file_path).strip()
        return parse_commit_message(raw_message)
    except GitCommandError:
        return {
            "body": "",
            "footer": "",
            "scope": "",
            "subject": "Unable to retrieve commit message",
            "type": ""
        }


def get_incoming_changes(repo, branch):
    """Get list of changes that would come in from origin"""
    try:
        # Get status including renames
        diff_output = repo.git.diff(f'HEAD...origin/{branch}', '--name-status',
                                    '-M').split('\n')
        changed_files = []
        rename_mapping = {}

        # Process status to identify renames
        for line in diff_output:
            if not line:
                continue
            parts = line.split('\t')
            if len(parts) < 2:
                continue

            status = parts[0]
            if status.startswith('R'):
                old_path, new_path = parts[1], parts[2]
                rename_mapping[new_path] = old_path
                changed_files.append(new_path)
            else:
                changed_files.append(parts[1])

        logger.info(f"Processing {len(changed_files)} incoming changes")

        incoming_changes = []
        for file_path in changed_files:
            try:
                # Handle renamed files
                old_path = rename_mapping.get(file_path, file_path)
                is_rename = file_path in rename_mapping

                # Get local and remote versions
                try:
                    local_content = repo.git.show(f'HEAD:{old_path}')
                    local_data = yaml.safe_load(local_content)
                except (GitCommandError, yaml.YAMLError):
                    local_data = None

                try:
                    remote_content = repo.git.show(
                        f'origin/{branch}:{file_path}')
                    remote_data = yaml.safe_load(remote_content)
                except (GitCommandError, yaml.YAMLError):
                    remote_data = None

                # Skip if no actual changes
                if local_data == remote_data and not is_rename:
                    continue

                # Check for conflicts and get commit info
                will_conflict = check_merge_conflict(repo, branch, file_path)
                commit_message = get_commit_message(repo, branch, file_path)

                # Generate change summary
                change = create_change_summary(local_data, remote_data,
                                               file_path)

                # Add incoming-specific fields
                change.update({
                    'commit_message':
                    commit_message,
                    'type':
                    determine_type(file_path),
                    'will_conflict':
                    will_conflict,
                    'id':
                    remote_data.get('id') if remote_data else None,
                    'local_name':
                    extract_name(old_path)
                    if is_rename else extract_name(file_path),
                    'incoming_name':
                    extract_name(file_path),
                    'staged':
                    False
                })

                if is_rename:
                    change['status'] = 'Renamed'

                incoming_changes.append(change)

            except Exception as e:
                logger.error(
                    f"Failed to process incoming change for {file_path}: {str(e)}"
                )
                continue

        return incoming_changes

    except Exception as e:
        logger.error(f"Failed to get incoming changes: {str(e)}")
        return []
