# git/status/incoming_changes.py
import os
import logging
import yaml
from git import GitCommandError
from .utils import determine_type, parse_commit_message, extract_data_from_yaml

logger = logging.getLogger(__name__)


def check_merge_conflict(repo, branch, file_path):
    """Checks if an incoming change will conflict with local changes."""
    try:
        has_changes = False

        # Check uncommitted changes
        status = repo.git.status('--porcelain', file_path).strip()
        if status:
            status_code = status[:2] if len(status) >= 2 else ''
            has_changes = 'M' in status_code or 'A' in status_code or 'D' in status_code

        # Check committed changes not in remote
        try:
            merge_base = repo.git.merge_base('HEAD',
                                             f'origin/{branch}').strip()
            committed_changes = repo.git.log(f'{merge_base}..HEAD',
                                             '--',
                                             file_path,
                                             ignore_missing=True).strip()
            has_changes = has_changes or bool(committed_changes)
        except GitCommandError as e:
            logger.warning(f"Error checking committed changes: {str(e)}")

        if has_changes:
            try:
                merge_test = repo.git.merge_tree('--write-tree', 'HEAD',
                                                 f'origin/{branch}')
                return any(
                    line.startswith('<<<<<<< ')
                    for line in merge_test.splitlines() if file_path in line)
            except GitCommandError as e:
                logger.warning(
                    f"Merge tree test failed, assuming conflict: {str(e)}")
                return True

        return False

    except Exception as e:
        logger.error(
            f"Error checking merge conflict for {file_path}: {str(e)}")
        return False


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
            local_data = get_file_data(repo, file_path, 'HEAD')
            remote_data = get_file_data(repo, file_path, f'origin/{branch}')

            if local_data == remote_data:
                continue

            will_conflict = check_merge_conflict(repo, branch, file_path)

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
                changes = [{'key': 'File', 'change': 'added'}]
            else:
                status = 'Modified'
                local_name = local_data.get(
                    'name') if local_data else os.path.basename(file_path)
                incoming_name = remote_data.get(
                    'name') if remote_data else None
                if file_path.startswith('profiles/'):
                    changes = compare_quality_profile(local_data, remote_data)
                else:
                    changes = compare_generic(local_data, remote_data)

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
                'will_conflict': will_conflict
            })

        except Exception as e:
            logger.error(
                f"Error processing incoming change for {file_path}: {str(e)}")
            continue

    logger.info(f"Found {len(incoming_changes)} incoming changes")
    return incoming_changes


def compare_quality_profile(local_data, remote_data):
    """Compare quality profile specific changes"""
    if local_data is None and remote_data is not None:
        return [{'key': 'File', 'change': 'added'}]

    if local_data is not None and remote_data is None:
        return [{'key': 'File', 'change': 'deleted'}]

    changes = []

    # Simple fields with consistent capitalization
    simple_fields = {
        'name': 'Name',
        'description': 'Description',
        'language': 'Language',
        'minCustomFormatScore': 'Minimum Custom Format Score',
        'minScoreIncrement': 'Minimum Score Increment',
        'upgradeUntilScore': 'Upgrade Until Score',
        'upgradesAllowed': 'Upgrades Allowed'
    }

    for field, display_name in simple_fields.items():
        local_value = local_data.get(field)
        remote_value = remote_data.get(field)
        if local_value != remote_value:
            changes.append({
                'key': display_name,
                'change': 'modified',
                'from': local_value,
                'to': remote_value
            })

    # Compare qualities
    if local_data.get('qualities') != remote_data.get('qualities'):
        changes.extend(
            compare_qualities(local_data.get('qualities', []),
                              remote_data.get('qualities', [])))

    # Compare profile-specific custom formats
    if local_data.get('custom_formats') != remote_data.get('custom_formats'):
        changes.extend(
            compare_profile_formats(local_data.get('custom_formats', []),
                                    remote_data.get('custom_formats', [])))

    # Compare tags
    if local_data.get('tags') != remote_data.get('tags'):
        changes.extend(
            compare_tags(local_data.get('tags', []),
                         remote_data.get('tags', [])))

    # Compare upgrade_until
    if local_data.get('upgrade_until') != remote_data.get('upgrade_until'):
        changes.extend(
            compare_upgrade_until(local_data.get('upgrade_until', {}),
                                  remote_data.get('upgrade_until', {})))

    return changes


def compare_qualities(local_qualities, remote_qualities):
    """Compare quality groups and their qualities"""
    if not local_qualities and not remote_qualities:
        return []

    changes = []

    # Create lookup dictionaries
    local_dict = {quality.get('name'): quality for quality in local_qualities}
    remote_dict = {
        quality.get('name'): quality
        for quality in remote_qualities
    }

    # Find added/removed qualities
    local_names = set(local_dict.keys())
    remote_names = set(remote_dict.keys())

    # Track additions
    for name in (remote_names - local_names):
        changes.append({
            'key': 'Quality Group',
            'change': 'added',
            'value': name
        })

    # Track removals
    for name in (local_names - remote_names):
        changes.append({
            'key': 'Quality Group',
            'change': 'removed',
            'value': name
        })

    # Compare common qualities
    for name in (local_names & remote_names):
        local_quality = local_dict[name]
        remote_quality = remote_dict[name]

        # Compare description
        if local_quality.get('description') != remote_quality.get(
                'description'):
            changes.append({
                'key': f'Quality Group: {name}: Description',
                'change': 'modified',
                'from': local_quality.get('description'),
                'to': remote_quality.get('description')
            })

        # Compare nested qualities
        local_nested = {
            q.get('name'): q
            for q in local_quality.get('qualities', [])
        }
        remote_nested = {
            q.get('name'): q
            for q in remote_quality.get('qualities', [])
        }

        nested_local = set(local_nested.keys())
        nested_remote = set(remote_nested.keys())

        for nested_name in (nested_remote - nested_local):
            changes.append({
                'key': f'Quality Group: {name}: Quality',
                'change': 'added',
                'value': nested_name
            })

        for nested_name in (nested_local - nested_remote):
            changes.append({
                'key': f'Quality Group: {name}: Quality',
                'change': 'removed',
                'value': nested_name
            })

    return changes


def compare_profile_formats(local_formats, remote_formats):
    """Compare custom formats within a quality profile"""
    if not local_formats and not remote_formats:
        return []

    changes = []

    # Create lookup dictionaries
    local_dict = {fmt.get('name'): fmt.get('score') for fmt in local_formats}
    remote_dict = {fmt.get('name'): fmt.get('score') for fmt in remote_formats}

    local_names = set(local_dict.keys())
    remote_names = set(remote_dict.keys())

    # Track additions
    for name in (remote_names - local_names):
        changes.append({
            'key': 'Custom Format',
            'change': 'added',
            'value': {
                'name': name,
                'score': remote_dict[name]
            }
        })

    # Track removals
    for name in (local_names - remote_names):
        changes.append({
            'key': 'Custom Format',
            'change': 'removed',
            'value': {
                'name': name,
                'score': local_dict[name]
            }
        })

    # Compare scores for existing formats
    for name in (local_names & remote_names):
        if local_dict[name] != remote_dict[name]:
            changes.append({
                'key': f'Custom Format: {name}: Score',
                'change': 'modified',
                'from': local_dict[name],
                'to': remote_dict[name]
            })

    return changes


def compare_tags(local_tags, remote_tags):
    """Compare tag lists"""
    local_set = set(local_tags or [])
    remote_set = set(remote_tags or [])

    changes = []

    if added := (remote_set - local_set):
        changes.append({
            'key': 'Tags',
            'change': 'added',
            'value': sorted(list(added))
        })

    if removed := (local_set - remote_set):
        changes.append({
            'key': 'Tags',
            'change': 'removed',
            'value': sorted(list(removed))
        })

    return changes


def compare_upgrade_until(local_upgrade, remote_upgrade):
    """Compare upgrade_until objects"""
    if not local_upgrade and not remote_upgrade:
        return []

    changes = []

    # Compare name
    if local_upgrade.get('name') != remote_upgrade.get('name'):
        changes.append({
            'key': 'Upgrade Until: Name',
            'change': 'modified',
            'from': local_upgrade.get('name'),
            'to': remote_upgrade.get('name')
        })

    # Compare description
    if local_upgrade.get('description') != remote_upgrade.get('description'):
        changes.append({
            'key': 'Upgrade Until: Description',
            'change': 'modified',
            'from': local_upgrade.get('description'),
            'to': remote_upgrade.get('description')
        })

    return changes


def compare_generic(local_data, remote_data):
    """Process changes for non-profile files"""
    if local_data is None and remote_data is not None:
        return [{'key': 'File', 'change': 'added'}]

    if local_data is not None and remote_data is None:
        return [{'key': 'File', 'change': 'deleted'}]

    changes = []
    all_keys = set(local_data.keys()).union(set(remote_data.keys()))

    for key in all_keys:
        local_value = local_data.get(key)
        remote_value = remote_data.get(key)

        if local_value != remote_value:
            changes.append({
                'key': key.title(),  # Capitalize generic keys
                'change': 'modified',
                'from': local_value,
                'to': remote_value
            })

    return changes
