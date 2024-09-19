# git/status/incoming_changes.py

import os
import logging
from .utils import extract_data_from_yaml, determine_type, parse_commit_message

logger = logging.getLogger(__name__)


def get_incoming_changes(repo, branch):
    incoming_changes = []
    diff = repo.git.diff(f'HEAD...origin/{branch}', name_only=True)
    changed_files = diff.split('\n') if diff else []

    for file_path in changed_files:
        if file_path:
            full_path = os.path.join(repo.working_dir, file_path)
            file_data = extract_data_from_yaml(full_path) if os.path.exists(
                full_path) else None

            # Correcting the git show command
            raw_commit_message = repo.git.show(f'HEAD...origin/{branch}',
                                               '--format=%B', '-s',
                                               file_path).strip()
            parsed_commit_message = parse_commit_message(
                raw_commit_message
            )  # Parse commit message using the util function

            incoming_changes.append({
                'name':
                file_data.get('name', os.path.basename(file_path))
                if file_data else os.path.basename(file_path),
                'id':
                file_data.get('id') if file_data else None,
                'type':
                determine_type(file_path),
                'status':
                'Incoming',
                'file_path':
                file_path,
                'commit_message':
                parsed_commit_message,  # Use parsed commit message
                'staged':
                False,
                'modified':
                True,
                'deleted':
                False
            })

    return incoming_changes
