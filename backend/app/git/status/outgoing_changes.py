# git/status/outgoing_changes.py

import os
import json
import yaml
import logging
from .utils import extract_data_from_yaml, determine_type, interpret_git_status

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

        is_staged = x != ' ' and x != '?'
        is_deleted = x == 'D' or y == 'D'

        full_path = os.path.join(repo.working_dir, file_path)

        if is_deleted:
            try:
                # Get the content of the file from the last commit
                file_content = repo.git.show(f'HEAD:{file_path}')
                yaml_content = yaml.safe_load(file_content)
                original_name = yaml_content.get('name', 'Unknown')
                original_id = yaml_content.get('id', '')
            except Exception as e:
                logger.warning(f"Could not retrieve original name for deleted file {file_path}: {str(e)}")
                original_name = "Unknown"
                original_id = ""

            changes.append({
                'name': original_name,
                'id': original_id,
                'type': determine_type(file_path),
                'status': 'Deleted',
                'file_path': file_path,
                'staged': is_staged,
                'modified': False,
                'deleted': True
            })
        elif os.path.isdir(full_path):
            logger.debug(f"Found directory: {file_path}, going through folder.")
            for root, dirs, files in os.walk(full_path):
                for file in files:
                    if file.endswith('.yml') or file.endswith('.yaml'):
                        file_full_path = os.path.join(root, file)
                        logger.debug(f"Found file: {file_full_path}, going through file.")
                        file_data = extract_data_from_yaml(file_full_path)
                        if file_data:
                            logger.debug(f"File contents: {file_data}")
                            logger.debug(f"Found ID: {file_data.get('id')}")
                            logger.debug(f"Found Name: {file_data.get('name')}")
                            changes.append({
                                'name': file_data.get('name', ''),
                                'id': file_data.get('id', ''),
                                'type': determine_type(file_path),
                                'status': interpret_git_status(x, y),
                                'file_path': os.path.relpath(file_full_path, repo.working_dir),
                                'staged': x != '?' and x != ' ',
                                'modified': y == 'M',
                                'deleted': False
                            })
                        else:
                            logger.debug(f"No data extracted from file: {file_full_path}")
        else:
            file_data = extract_data_from_yaml(full_path) if os.path.exists(full_path) else None
            if file_data:
                changes.append({
                    'name': file_data.get('name', ''),
                    'id': file_data.get('id', ''),
                    'type': determine_type(file_path),
                    'status': interpret_git_status(x, y),
                    'file_path': file_path,
                    'staged': is_staged,
                    'modified': y != ' ',
                    'deleted': False
                })
            else:
                changes.append({
                    'name': os.path.basename(file_path).replace('.yml', ''),
                    'id': '',
                    'type': determine_type(file_path),
                    'status': interpret_git_status(x, y),
                    'file_path': file_path,
                    'staged': is_staged,
                    'modified': y != ' ',
                    'deleted': False
                })

    logger.debug(f"Final changes: {json.dumps(changes, indent=2)}")
    return changes