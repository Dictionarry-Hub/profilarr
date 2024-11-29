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
                'File',
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

        # Process based on file type
        if file_path.startswith('profiles/'):
            detailed_conflicts = compare_quality_profile(
                ours_data, theirs_data)
            conflict_details['conflicting_parameters'].extend(
                detailed_conflicts)
        else:
            detailed_conflicts = compare_generic(ours_data, theirs_data)
            conflict_details['conflicting_parameters'].extend(
                detailed_conflicts)

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


def compare_quality_profile(ours_data, theirs_data):
    """Compare quality profile fields for conflicts"""
    conflicts = []

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
        ours_value = ours_data.get(field)
        theirs_value = theirs_data.get(field)
        if ours_value != theirs_value:
            conflicts.append({
                'parameter': display_name,
                'local_value': ours_value,
                'incoming_value': theirs_value
            })

    # Compare qualities
    ours_qualities = ours_data.get('qualities', [])
    theirs_qualities = theirs_data.get('qualities', [])
    if ours_qualities != theirs_qualities:
        conflicts.extend(compare_qualities(ours_qualities, theirs_qualities))

    # Compare custom formats
    ours_formats = ours_data.get('custom_formats', [])
    theirs_formats = theirs_data.get('custom_formats', [])
    if ours_formats != theirs_formats:
        conflicts.extend(compare_custom_formats(ours_formats, theirs_formats))

    # Compare tags
    ours_tags = ours_data.get('tags', [])
    theirs_tags = theirs_data.get('tags', [])
    if ours_tags != theirs_tags:
        conflicts.extend(compare_tags(ours_tags, theirs_tags))

    # Compare upgrade_until
    ours_upgrade = ours_data.get('upgrade_until', {})
    theirs_upgrade = theirs_data.get('upgrade_until', {})
    if ours_upgrade != theirs_upgrade:
        conflicts.extend(compare_upgrade_until(ours_upgrade, theirs_upgrade))

    return conflicts


def compare_qualities(ours_qualities, theirs_qualities):
    """Compare quality groups for conflicts"""
    conflicts = []

    # Create lookup dictionaries
    ours_dict = {quality.get('name'): quality for quality in ours_qualities}
    theirs_dict = {
        quality.get('name'): quality
        for quality in theirs_qualities
    }

    # Find added/removed qualities
    ours_names = set(ours_dict.keys())
    theirs_names = set(theirs_dict.keys())

    # Track additions
    for name in (theirs_names - ours_names):
        conflicts.append({
            'parameter': 'Quality Group',
            'local_value': None,
            'incoming_value': name
        })

    # Track removals
    for name in (ours_names - theirs_names):
        conflicts.append({
            'parameter': 'Quality Group',
            'local_value': name,
            'incoming_value': None
        })

    # Compare common qualities
    for name in (ours_names & theirs_names):
        ours_quality = ours_dict[name]
        theirs_quality = theirs_dict[name]

        # Compare description
        if ours_quality.get('description') != theirs_quality.get(
                'description'):
            conflicts.append({
                'parameter':
                f'Quality Group: {name}: Description',
                'local_value':
                ours_quality.get('description'),
                'incoming_value':
                theirs_quality.get('description')
            })

        # Compare nested qualities
        ours_nested = {
            q.get('name'): q
            for q in ours_quality.get('qualities', [])
        }
        theirs_nested = {
            q.get('name'): q
            for q in theirs_quality.get('qualities', [])
        }

        nested_ours = set(ours_nested.keys())
        nested_theirs = set(theirs_nested.keys())

        for nested_name in (nested_theirs - nested_ours):
            conflicts.append({
                'parameter': f'Quality Group: {name}: Quality',
                'local_value': None,
                'incoming_value': nested_name
            })

        for nested_name in (nested_ours - nested_theirs):
            conflicts.append({
                'parameter': f'Quality Group: {name}: Quality',
                'local_value': nested_name,
                'incoming_value': None
            })

    return conflicts


def compare_custom_formats(ours_formats, theirs_formats):
    """Compare custom formats for conflicts"""
    conflicts = []

    # Create lookup dictionaries
    ours_dict = {fmt.get('name'): fmt.get('score') for fmt in ours_formats}
    theirs_dict = {fmt.get('name'): fmt.get('score') for fmt in theirs_formats}

    ours_names = set(ours_dict.keys())
    theirs_names = set(theirs_dict.keys())

    # Track additions
    for name in (theirs_names - ours_names):
        conflicts.append({
            'parameter': 'Custom Format',
            'local_value': None,
            'incoming_value': {
                'name': name,
                'score': theirs_dict[name]
            }
        })

    # Track removals
    for name in (ours_names - theirs_names):
        conflicts.append({
            'parameter': 'Custom Format',
            'local_value': {
                'name': name,
                'score': ours_dict[name]
            },
            'incoming_value': None
        })

    # Compare scores for existing formats
    for name in (ours_names & theirs_names):
        if ours_dict[name] != theirs_dict[name]:
            conflicts.append({
                'parameter': f'Custom Format: {name}: Score',
                'local_value': ours_dict[name],
                'incoming_value': theirs_dict[name]
            })

    return conflicts


def compare_tags(ours_tags, theirs_tags):
    """Compare tags for conflicts"""
    conflicts = []
    ours_set = set(ours_tags or [])
    theirs_set = set(theirs_tags or [])

    if added := (theirs_set - ours_set):
        for tag in sorted(added):
            conflicts.append({
                'parameter': f'Tags: {tag}',
                'local_value': False,
                'incoming_value': True
            })

    if removed := (ours_set - theirs_set):
        for tag in sorted(removed):
            conflicts.append({
                'parameter': f'Tags: {tag}',
                'local_value': True,
                'incoming_value': False
            })

    return conflicts


def compare_upgrade_until(ours_upgrade, theirs_upgrade):
    """Compare upgrade_until objects for conflicts"""
    conflicts = []

    # Compare name
    if ours_upgrade.get('name') != theirs_upgrade.get('name'):
        conflicts.append({
            'parameter': 'Upgrade Until: Name',
            'local_value': ours_upgrade.get('name'),
            'incoming_value': theirs_upgrade.get('name')
        })

    # Compare description
    if ours_upgrade.get('description') != theirs_upgrade.get('description'):
        conflicts.append({
            'parameter': 'Upgrade Until: Description',
            'local_value': ours_upgrade.get('description'),
            'incoming_value': theirs_upgrade.get('description')
        })

    return conflicts


def compare_generic(ours_data, theirs_data):
    conflicts = []
    all_keys = set(ours_data.keys()).union(set(theirs_data.keys()))

    for key in all_keys:
        if key == 'date_modified':
            continue

        ours_value = ours_data.get(key)
        theirs_value = theirs_data.get(key)

        if ours_value != theirs_value:
            if key == 'tests':
                ours_tests = {t['id']: t for t in ours_value or []}
                theirs_tests = {t['id']: t for t in theirs_value or []}

                # Handle deleted tests
                for test_id in set(ours_tests) - set(theirs_tests):
                    conflicts.append({
                        'parameter': f'Test {test_id}',
                        'local_value': {
                            'input': ours_tests[test_id]['input'],
                            'expected': ours_tests[test_id]['expected']
                        },
                        'incoming_value': None
                    })

                # Handle added tests
                for test_id in set(theirs_tests) - set(ours_tests):
                    conflicts.append({
                        'parameter': f'Test {test_id}',
                        'local_value': None,
                        'incoming_value': {
                            'input': theirs_tests[test_id]['input'],
                            'expected': theirs_tests[test_id]['expected']
                        }
                    })

                # Handle modified tests
                for test_id in set(ours_tests) & set(theirs_tests):
                    if ours_tests[test_id] != theirs_tests[test_id]:
                        ours_test = ours_tests[test_id]
                        theirs_test = theirs_tests[test_id]

                        if ours_test['input'] != theirs_test['input']:
                            conflicts.append({
                                'parameter':
                                f'Test {test_id} Input',
                                'local_value':
                                ours_test['input'],
                                'incoming_value':
                                theirs_test['input']
                            })

                        if ours_test['expected'] != theirs_test['expected']:
                            conflicts.append({
                                'parameter':
                                f'Test {test_id} Expected',
                                'local_value':
                                ours_test['expected'],
                                'incoming_value':
                                theirs_test['expected']
                            })
            else:
                conflicts.append({
                    'parameter': key.title(),
                    'local_value': ours_value,
                    'incoming_value': theirs_value
                })

    return conflicts


def get_version_data(repo, ref, file_path):
    """Get YAML data from a specific version of a file."""
    try:
        content = repo.git.show(f'{ref}:{file_path}')
        return yaml.safe_load(content) if content else None
    except GitCommandError as e:
        logger.warning(
            f"Failed to get version data for {ref}:{file_path}: {str(e)}")
        return None
