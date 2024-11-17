# git/status/incoming_changes.py
import os
import logging
import yaml
from git import GitCommandError
from .utils import determine_type, parse_commit_message, extract_data_from_yaml

logger = logging.getLogger(__name__)


def check_merge_conflict(repo, branch, file_path):
    """
    Checks if an incoming change will conflict with local changes.
    Returns True if there would be a merge conflict, False otherwise.
    """
    try:
        # Check for both uncommitted and committed changes
        has_changes = False

        # 1. Check uncommitted changes
        status = repo.git.status('--porcelain', file_path).strip()
        if status:
            status_code = status[:2] if len(status) >= 2 else ''
            has_changes = 'M' in status_code or 'A' in status_code or 'D' in status_code

        # 2. Check committed changes not in remote
        try:
            # Get the merge-base (common ancestor) of local and remote
            merge_base = repo.git.merge_base('HEAD',
                                             f'origin/{branch}').strip()

            # Check if there are any commits affecting this file between merge-base and HEAD
            committed_changes = repo.git.log(f'{merge_base}..HEAD',
                                             '--',
                                             file_path,
                                             ignore_missing=True).strip()
            has_changes = has_changes or bool(committed_changes)
        except GitCommandError as e:
            logger.warning(f"Error checking committed changes: {str(e)}")

        if has_changes:
            try:
                # Use correct merge-tree syntax
                merge_test = repo.git.merge_tree('--write-tree', 'HEAD',
                                                 f'origin/{branch}')

                # Check if this specific file has conflicts in the merge result
                return any(
                    line.startswith('<<<<<<< ')
                    for line in merge_test.splitlines() if file_path in line)
            except GitCommandError as e:
                logger.warning(
                    f"Merge tree test failed, assuming conflict: {str(e)}")
                return True  # If merge-tree fails, assume there's a conflict

        return False

    except Exception as e:
        logger.error(
            f"Error checking merge conflict for {file_path}: {str(e)}")
        return False  # Default to no conflict if we can't determine


def get_file_data(repo, file_path, ref):
    try:
        content = repo.git.show(f'{ref}:{file_path}')
        return yaml.safe_load(content)
    except GitCommandError:
        logger.warning(
            f"Failed to retrieve content for file: {file_path} at {ref}")
        return None


def get_incoming_changes(repo, branch):
    incoming_changes = []

    try:
        # Get changed files between local and remote
        diff_index = repo.git.diff(f'HEAD...origin/{branch}',
                                   '--name-only').split('\n')
        untracked = repo.git.ls_files('--others',
                                      '--exclude-standard').split('\n')
        changed_files = list(filter(None, set(diff_index + untracked)))
    except GitCommandError as e:
        logger.error(f"Error getting changed files: {str(e)}")
        return []

    for file_path in changed_files:
        if not file_path:
            continue

        try:
            # Get both versions of the file
            local_data = get_file_data(repo, file_path, 'HEAD')
            remote_data = get_file_data(repo, file_path, f'origin/{branch}')

            if local_data == remote_data:
                continue

            # Check for potential merge conflicts
            will_conflict = check_merge_conflict(repo, branch, file_path)

            # Get commit message
            try:
                raw_commit_message = repo.git.show(f'HEAD...origin/{branch}',
                                                   '--format=%B', '-s', '--',
                                                   file_path).strip()
                commit_message = parse_commit_message(raw_commit_message)
            except GitCommandError:
                commit_message = {
                    "body": "",
                    "footer": "",
                    "scope": "",
                    "subject": "Unable to retrieve commit message",
                    "type": ""
                }

            if not local_data and remote_data:
                status = 'New'
                local_name = remote_data.get('name')
                incoming_name = None
                changes = [{
                    'key': key,
                    'change': 'added',
                    'value': value
                } for key, value in remote_data.items()]
            else:
                status = 'Modified'
                local_name = local_data.get(
                    'name') if local_data else os.path.basename(file_path)
                incoming_name = remote_data.get(
                    'name') if remote_data else None
                changes = compare_data(local_data, remote_data)

                if not changes:
                    continue

            file_type = determine_type(file_path)
            file_id = remote_data.get('id') if remote_data else None

            incoming_changes.append({
                'commit_message': commit_message,
                'deleted': False,
                'file_path': file_path,
                'id': file_id,
                'modified': True,
                'local_name': local_name,
                'incoming_name': incoming_name,
                'staged': False,
                'status': status,
                'type': file_type,
                'changes': changes,
                'will_conflict':
                will_conflict  # Added conflict status per file
            })

        except Exception as e:
            logger.error(
                f"Error processing incoming change for {file_path}: {str(e)}")
            continue

    logger.info(f"Found {len(incoming_changes)} incoming changes")
    return incoming_changes


def compare_data(local_data, remote_data):
    if local_data is None and remote_data is not None:
        # File is entirely new
        return [{'key': 'file', 'change': 'added'}]

    if local_data is not None and remote_data is None:
        # File has been deleted
        return [{'key': 'file', 'change': 'deleted'}]

    changes = []
    all_keys = set(local_data.keys()).union(set(remote_data.keys()))

    for key in all_keys:
        local_value = local_data.get(key)
        remote_value = remote_data.get(key)

        if local_value != remote_value:
            if key == 'tags':
                changes.extend(compare_tags(local_value, remote_value))
            elif key == 'custom_formats':
                changes.extend(
                    compare_custom_formats(local_value, remote_value))
            else:
                changes.append({
                    'key': key,
                    'change': 'modified',
                    'from': local_value,
                    'to': remote_value
                })

    return changes


def compare_tags(local_tags, remote_tags):
    local_tags = set(local_tags or [])
    remote_tags = set(remote_tags or [])

    added = remote_tags - local_tags
    removed = local_tags - remote_tags

    changes = []
    if added:
        changes.append({
            'key': 'tags',
            'change': 'added',
            'value': list(added)
        })
    if removed:
        changes.append({
            'key': 'tags',
            'change': 'removed',
            'value': list(removed)
        })

    return changes


def compare_custom_formats(local_cfs, remote_cfs):
    local_cfs = {cf['id']: cf for cf in local_cfs or []}
    remote_cfs = {cf['id']: cf for cf in remote_cfs or []}

    all_ids = set(local_cfs.keys()).union(set(remote_cfs.keys()))
    changes = []

    for cf_id in all_ids:
        local_cf = local_cfs.get(cf_id)
        remote_cf = remote_cfs.get(cf_id)

        if local_cf != remote_cf:
            if local_cf and remote_cf:
                if local_cf['score'] != remote_cf['score']:
                    changes.append({
                        'key': f'custom_format_{cf_id}',
                        'change': 'modified',
                        'from': local_cf['score'],
                        'to': remote_cf['score']
                    })
            elif local_cf and not remote_cf:
                changes.append({
                    'key': f'custom_format_{cf_id}',
                    'change': 'removed',
                    'value': local_cf['score']
                })
            elif not local_cf and remote_cf:
                changes.append({
                    'key': f'custom_format_{cf_id}',
                    'change': 'added',
                    'value': remote_cf['score']
                })

    return changes
