import os
import yaml
import logging
from git import GitCommandError
from .utils import determine_type, parse_commit_message

logger = logging.getLogger(__name__)


def get_outgoing_changes(repo):
    """Get list of changes in working directory"""
    # Use --porcelain=1 format for consistent output
    status = repo.git.status('--porcelain', '-z').split('\0')
    logger.debug(f"Raw porcelain status: {status}")

    changes = []
    i = 0
    while i < len(status):
        item = status[i]
        if not item:
            i += 1
            continue

        logger.debug(f"Processing status item: {item}")

        if len(item) < 4:
            logger.warning(f"Unexpected status item format: {item}")
            i += 1
            continue

        x, y = item[0], item[1]
        file_path = item[3:]
        logger.debug(f"Parsed status: x={x}, y={y}, file_path={file_path}")

        # Skip files in conflict state
        if x == 'U' or y == 'U':
            i += 1
            continue

        is_staged = x != ' ' and x != '?'

        try:
            # Handle different file statuses
            if x == 'R':
                if i + 1 < len(status) and status[i + 1]:
                    old_path = status[i + 1]
                    changes.append(handle_rename(repo, old_path, file_path))
                    i += 2  # Skip the old filename entry
                    continue
            elif x == 'D' or y == 'D':
                changes.append(handle_delete(repo, file_path, is_staged))
            else:
                changes.append(handle_modification(repo, file_path, is_staged))
        except Exception as e:
            logger.error(f"Error processing change for {file_path}: {str(e)}")

        i += 1

    return changes


def handle_rename(repo, old_path, new_path):
    """Handle a renamed file"""
    try:
        # Get old content for name
        old_content = repo.git.show(f'HEAD:{old_path}')
        old_data = yaml.safe_load(old_content)
        prior_name = old_data.get('name') if old_data else None

        # Get new content for name
        with open(os.path.join(repo.working_dir, new_path), 'r') as f:
            new_data = yaml.safe_load(f.read())
            current_name = new_data.get('name') if new_data else None
    except Exception as e:
        logger.warning(
            f"Could not get content for renamed file, using file names: {str(e)}"
        )
        prior_name = os.path.basename(old_path)
        current_name = os.path.basename(new_path)

    # Only set outgoing_name if it changed
    outgoing_name = current_name if current_name != prior_name else None

    return {
        'name':
        current_name or os.path.basename(new_path),
        'prior_name':
        prior_name,
        'outgoing_name':
        outgoing_name,
        'type':
        determine_type(new_path),
        'status':
        'Renamed',
        'file_path':
        new_path,
        'old_file_path':
        old_path,
        'staged':
        False,  # Renames are always unstaged in the working directory
        'modified':
        True,
        'deleted':
        False,
        'changes': [{
            'key': 'File',
            'change': 'renamed',
            'from': old_path,
            'to': new_path
        }]
    }


def handle_delete(repo, file_path, is_staged):
    """Handle a deleted file"""
    try:
        file_content = repo.git.show(f'HEAD:{file_path}')
        yaml_content = yaml.safe_load(file_content)
        original_name = yaml_content.get('name', os.path.basename(file_path))
    except Exception as e:
        logger.warning(f"Could not get content for deleted file: {str(e)}")
        original_name = os.path.basename(file_path)

    return {
        'name': original_name,
        'prior_name': original_name,
        'outgoing_name': None,  # Deleted files have no outgoing name
        'type': determine_type(file_path),
        'status': 'Deleted',
        'file_path': file_path,
        'staged': is_staged,
        'modified': False,
        'deleted': True,
        'changes': [{
            'key': 'File',
            'change': 'deleted'
        }]
    }


def handle_modification(repo, file_path, is_staged):
    """Handle a modified or new file"""
    try:
        # Get old content if file exists in HEAD
        try:
            old_content = repo.git.show(f'HEAD:{file_path}')
            old_data = yaml.safe_load(old_content)
            prior_name = old_data.get('name')
            status = 'Modified'
        except GitCommandError:
            old_data = None
            prior_name = None
            status = 'New'

        # Get new content
        with open(os.path.join(repo.working_dir, file_path), 'r') as f:
            new_data = yaml.safe_load(f.read())
            current_name = new_data.get('name')

        # Only set outgoing_name if it changed
        outgoing_name = current_name if current_name != prior_name else None

        # Process changes based on file type and status
        if status == 'New':
            # For new files, create changes entries for all fields
            detailed_changes = process_new_file(new_data)
        elif file_path.startswith('profiles/'):
            detailed_changes = process_quality_profile(old_data, new_data)
        else:
            detailed_changes = process_generic(old_data, new_data)

        return {
            'name': current_name or os.path.basename(file_path),
            'prior_name': prior_name,
            'outgoing_name': outgoing_name,
            'type': determine_type(file_path),
            'status': status,
            'file_path': file_path,
            'staged': is_staged,
            'modified': True,
            'deleted': False,
            'changes': detailed_changes
        }
    except Exception as e:
        logger.error(f"Error processing modified file {file_path}: {str(e)}")
        raise


def process_new_file(new_data):
    """Process all fields in a new file"""
    if not new_data:
        return [{'key': 'File', 'change': 'added'}]

    changes = [{'key': 'File', 'change': 'added'}]

    def process_value(key, value, parent_key=None):
        # Generate the display key
        display_key = f"{parent_key}: {key}" if parent_key else key.title()

        if isinstance(value, dict):
            # Handle nested dictionaries
            for k, v in value.items():
                process_value(k, v, display_key)
        elif isinstance(value, list):
            # Handle lists
            if value and isinstance(value[0], dict):
                # Handle list of dictionaries (e.g., qualities, custom_formats)
                for item in value:
                    if 'name' in item:
                        item_name = item['name']
                        for k, v in item.items():
                            if k != 'name':
                                changes.append({
                                    'key':
                                    f"{display_key}: {item_name}: {k.title()}",
                                    'change': 'added',
                                    'value': v
                                })
            else:
                # Handle simple lists
                changes.append({
                    'key': display_key,
                    'change': 'added',
                    'value': value
                })
        else:
            # Handle simple values
            changes.append({
                'key': display_key,
                'change': 'added',
                'value': value
            })

    # Process each top-level field
    for key, value in new_data.items():
        process_value(key, value)

    return changes


def process_quality_profile(old_data, new_data):
    """Process changes in quality profile files"""
    if old_data is None and new_data is not None:
        return [{'key': 'File', 'change': 'added'}]

    if old_data is not None and new_data is None:
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
        old_value = old_data.get(field)
        new_value = new_data.get(field)
        if old_value != new_value:
            changes.append({
                'key': display_name,
                'change': 'modified',
                'from': old_value,
                'to': new_value
            })

    # Compare qualities
    if old_data.get('qualities') != new_data.get('qualities'):
        changes.extend(
            compare_qualities(old_data.get('qualities', []),
                              new_data.get('qualities', [])))

    # Compare profile-specific custom formats
    if old_data.get('custom_formats') != new_data.get('custom_formats'):
        changes.extend(
            compare_profile_formats(old_data.get('custom_formats', []),
                                    new_data.get('custom_formats', [])))

    # Compare tags
    if old_data.get('tags') != new_data.get('tags'):
        changes.extend(
            compare_tags(old_data.get('tags', []), new_data.get('tags', [])))

    # Compare upgrade_until
    if old_data.get('upgrade_until') != new_data.get('upgrade_until'):
        changes.extend(
            compare_upgrade_until(old_data.get('upgrade_until', {}),
                                  new_data.get('upgrade_until', {})))

    return changes


def compare_qualities(old_qualities, new_qualities):
    """Compare quality groups and their qualities"""
    if not old_qualities and not new_qualities:
        return []

    changes = []

    # Create lookup dictionaries
    old_dict = {quality.get('name'): quality for quality in old_qualities}
    new_dict = {quality.get('name'): quality for quality in new_qualities}

    # Find added/removed qualities
    old_names = set(old_dict.keys())
    new_names = set(new_dict.keys())

    # Track additions
    for name in (new_names - old_names):
        changes.append({
            'key': 'Quality Group',
            'change': 'added',
            'value': name
        })

    # Track removals
    for name in (old_names - new_names):
        changes.append({
            'key': 'Quality Group',
            'change': 'removed',
            'value': name
        })

    # Compare common qualities
    for name in (old_names & new_names):
        old_quality = old_dict[name]
        new_quality = new_dict[name]

        # Compare description
        if old_quality.get('description') != new_quality.get('description'):
            changes.append({
                'key': f'Quality Group: {name}: Description',
                'change': 'modified',
                'from': old_quality.get('description'),
                'to': new_quality.get('description')
            })

        # Compare nested qualities
        old_nested = {
            q.get('name'): q
            for q in old_quality.get('qualities', [])
        }
        new_nested = {
            q.get('name'): q
            for q in new_quality.get('qualities', [])
        }

        nested_old = set(old_nested.keys())
        nested_new = set(new_nested.keys())

        for nested_name in (nested_new - nested_old):
            changes.append({
                'key': f'Quality Group: {name}: Quality',
                'change': 'added',
                'value': nested_name
            })

        for nested_name in (nested_old - nested_new):
            changes.append({
                'key': f'Quality Group: {name}: Quality',
                'change': 'removed',
                'value': nested_name
            })

    return changes


def compare_profile_formats(old_formats, new_formats):
    """Compare custom formats within a quality profile"""
    if not old_formats and not new_formats:
        return []

    changes = []

    # Create lookup dictionaries
    old_dict = {fmt.get('name'): fmt.get('score') for fmt in old_formats}
    new_dict = {fmt.get('name'): fmt.get('score') for fmt in new_formats}

    old_names = set(old_dict.keys())
    new_names = set(new_dict.keys())

    # Track additions
    for name in (new_names - old_names):
        changes.append({
            'key': 'Custom Format',
            'change': 'added',
            'value': {
                'name': name,
                'score': new_dict[name]
            }
        })

    # Track removals
    for name in (old_names - new_names):
        changes.append({
            'key': 'Custom Format',
            'change': 'removed',
            'value': {
                'name': name,
                'score': old_dict[name]
            }
        })

    # Compare scores for existing formats
    for name in (old_names & new_names):
        if old_dict[name] != new_dict[name]:
            changes.append({
                'key': f'Custom Format: {name}: Score',
                'change': 'modified',
                'from': old_dict[name],
                'to': new_dict[name]
            })

    return changes


def compare_tags(old_tags, new_tags):
    """Compare tag lists"""
    old_set = set(old_tags or [])
    new_set = set(new_tags or [])

    changes = []

    if added := (new_set - old_set):
        changes.append({
            'key': 'Tags',
            'change': 'added',
            'value': sorted(list(added))
        })

    if removed := (old_set - new_set):
        changes.append({
            'key': 'Tags',
            'change': 'removed',
            'value': sorted(list(removed))
        })

    return changes


def compare_upgrade_until(old_upgrade, new_upgrade):
    """Compare upgrade_until objects"""
    if not old_upgrade and not new_upgrade:
        return []

    changes = []

    # Compare name
    if old_upgrade.get('name') != new_upgrade.get('name'):
        changes.append({
            'key': 'Upgrade Until: Name',
            'change': 'modified',
            'from': old_upgrade.get('name'),
            'to': new_upgrade.get('name')
        })

    # Compare description
    if old_upgrade.get('description') != new_upgrade.get('description'):
        changes.append({
            'key': 'Upgrade Until: Description',
            'change': 'modified',
            'from': old_upgrade.get('description'),
            'to': new_upgrade.get('description')
        })

    return changes


def process_generic(old_data, new_data):
    if old_data is None and new_data is not None:
        return [{'key': 'File', 'change': 'added'}]
    if old_data is not None and new_data is None:
        return [{'key': 'File', 'change': 'deleted'}]

    changes = []
    all_keys = set(old_data.keys()).union(set(new_data.keys()))

    for key in all_keys:
        old_value = old_data.get(key)
        new_value = new_data.get(key)

        if old_value != new_value:
            if key == 'tests':
                old_tests = {t['id']: t for t in old_value or []}
                new_tests = {t['id']: t for t in new_value or []}

                # Handle deleted tests
                for test_id in set(old_tests) - set(new_tests):
                    test = old_tests[test_id]
                    changes.append({
                        'key': 'Test',
                        'change': 'deleted',
                        'from':
                        f'#{test_id}: "{test["input"]}" (Expected: {test["expected"]})',
                        'to': None
                    })

                # Handle added tests
                for test_id in set(new_tests) - set(old_tests):
                    test = new_tests[test_id]
                    changes.append({
                        'key':
                        'Test',
                        'change':
                        'added',
                        'from':
                        None,
                        'to':
                        f'#{test_id}: "{test["input"]}" (Expected: {test["expected"]})'
                    })

                # Handle modified tests
                for test_id in set(old_tests) & set(new_tests):
                    if old_tests[test_id] != new_tests[test_id]:
                        old_test = old_tests[test_id]
                        new_test = new_tests[test_id]

                        if old_test['input'] != new_test['input']:
                            changes.append({
                                'key':
                                f'Test #{test_id}',
                                'change':
                                'modified',
                                'from':
                                f'Input: "{old_test["input"]}"',
                                'to':
                                f'Input: "{new_test["input"]}"'
                            })

                        if old_test['expected'] != new_test['expected']:
                            changes.append({
                                'key':
                                f'Test #{test_id}',
                                'change':
                                'modified',
                                'from':
                                f'Expected: {old_test["expected"]}',
                                'to':
                                f'Expected: {new_test["expected"]}'
                            })
            else:
                changes.append({
                    'key': key.title(),
                    'change': 'modified',
                    'from': old_value,
                    'to': new_value
                })

    return changes
