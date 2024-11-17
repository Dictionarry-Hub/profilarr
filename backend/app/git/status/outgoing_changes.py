# git/status/outgoing_changes.py

import os
import yaml
import logging
from git import GitCommandError
from .utils import determine_type, parse_commit_message

logger = logging.getLogger(__name__)


def get_outgoing_changes(repo):
    status = repo.git.status('--porcelain', '-z').split('\0')
    logger.debug(f"Raw porcelain status: {status}")

    changes = []
    for item in status:
        if not item:
            continue

        logger.debug(f"Processing status item: {item}")

        if len(item) < 4:
            logger.warning(f"Unexpected status item format: {item}")
            continue

        x, y, file_path = item[0], item[1], item[3:]
        logger.debug(f"Parsed status: x={x}, y={y}, file_path={file_path}")

        # Skip files in conflict state
        if x == 'U' or y == 'U':
            continue

        is_staged = x != ' ' and x != '?'
        is_deleted = x == 'D' or y == 'D'

        if is_deleted:
            changes.append(process_deleted_file(repo, file_path, is_staged))
        else:
            changes.append(
                process_modified_file(repo, file_path, x, y, is_staged))

    logger.debug(f"Final changes: {changes}")
    return changes


def process_deleted_file(repo, file_path, is_staged):
    try:
        file_content = repo.git.show(f'HEAD:{file_path}')
        yaml_content = yaml.safe_load(file_content)
        original_name = yaml_content.get('name', 'Unknown')
        original_id = yaml_content.get('id', '')
    except Exception as e:
        logger.warning(
            f"Could not retrieve original content for deleted file {file_path}: {str(e)}"
        )
        original_name = "Unknown"
        original_id = ""

    return {
        'name': original_name,
        'prior_name': original_name,
        'outgoing_name': None,
        'id': original_id,
        'type': determine_type(file_path),
        'status': 'Deleted',
        'file_path': file_path,
        'staged': is_staged,
        'modified': False,
        'deleted': True,
        'changes': [{
            'key': 'file',
            'change': 'deleted'
        }]
    }


def process_modified_file(repo, file_path, x, y, is_staged):
    try:
        # Get the content of the file from the last commit
        old_content = repo.git.show(f'HEAD:{file_path}')
        old_data = yaml.safe_load(old_content)
    except GitCommandError:
        old_data = None

    # Get the current content of the file
    with open(os.path.join(repo.working_dir, file_path), 'r') as f:
        new_content = f.read()
    new_data = yaml.safe_load(new_content)

    detailed_changes = compare_data(old_data, new_data)

    # Determine prior_name and outgoing_name
    prior_name = old_data.get('name') if old_data else None
    outgoing_name = new_data.get('name') if new_data else None

    # If there's no name change, set outgoing_name to None
    if prior_name == outgoing_name:
        outgoing_name = None

    return {
        'name': new_data.get('name', os.path.basename(file_path)),
        'prior_name': prior_name,
        'outgoing_name': outgoing_name,
        'id': new_data.get('id', ''),
        'type': determine_type(file_path),
        'status': 'Modified' if old_data else 'New',
        'file_path': file_path,
        'staged': is_staged,
        'modified': y != ' ',
        'deleted': False,
        'changes': detailed_changes
    }


def compare_data(old_data, new_data):
    if old_data is None and new_data is not None:
        return [{'key': 'file', 'change': 'added'}]

    if old_data is not None and new_data is None:
        return [{'key': 'file', 'change': 'deleted'}]

    changes = []
    all_keys = set(old_data.keys()).union(set(new_data.keys()))

    for key in all_keys:
        old_value = old_data.get(key)
        new_value = new_data.get(key)

        if old_value != new_value:
            if key == 'tags':
                changes.extend(compare_tags(old_value, new_value))
            elif key == 'custom_formats':
                changes.extend(compare_custom_formats(old_value, new_value))
            elif key == 'conditions':
                changes.extend(compare_conditions(old_value, new_value))
            else:
                changes.append({
                    'key': key,
                    'change': 'modified',
                    'from': old_value,
                    'to': new_value
                })

    return changes


def compare_tags(old_tags, new_tags):
    old_tags = set(old_tags or [])
    new_tags = set(new_tags or [])

    added = new_tags - old_tags
    removed = old_tags - new_tags

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


def compare_custom_formats(old_cfs, new_cfs):
    old_cfs = {cf['id']: cf for cf in old_cfs or []}
    new_cfs = {cf['id']: cf for cf in new_cfs or []}

    all_ids = set(old_cfs.keys()).union(set(new_cfs.keys()))
    changes = []

    for cf_id in all_ids:
        old_cf = old_cfs.get(cf_id)
        new_cf = new_cfs.get(cf_id)

        if old_cf != new_cf:
            if old_cf and new_cf:
                if old_cf['score'] != new_cf['score']:
                    changes.append({
                        'key': f'custom_format_{cf_id}',
                        'change': 'modified',
                        'from': old_cf['score'],
                        'to': new_cf['score']
                    })
            elif old_cf and not new_cf:
                changes.append({
                    'key': f'custom_format_{cf_id}',
                    'change': 'removed',
                    'value': old_cf['score']
                })
            elif not old_cf and new_cf:
                changes.append({
                    'key': f'custom_format_{cf_id}',
                    'change': 'added',
                    'value': new_cf['score']
                })

    return changes


def compare_conditions(old_conditions, new_conditions):
    changes = []
    old_conditions = old_conditions or []
    new_conditions = new_conditions or []

    # Check for removed or modified conditions
    for i, old_cond in enumerate(old_conditions):
        if i >= len(new_conditions):
            changes.append({
                'key': f'conditions[{i}]',
                'change': 'removed',
                'value': old_cond
            })
        elif old_cond != new_conditions[i]:
            for key in old_cond.keys():
                if old_cond.get(key) != new_conditions[i].get(key):
                    changes.append({
                        'key': f'conditions[{i}].{key}',
                        'change': 'modified',
                        'from': old_cond.get(key),
                        'to': new_conditions[i].get(key)
                    })

    # Check for added conditions
    for i in range(len(old_conditions), len(new_conditions)):
        changes.append({
            'key': f'conditions[{i}]',
            'change': 'added',
            'value': new_conditions[i]
        })

    return changes
