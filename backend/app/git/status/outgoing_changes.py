import os
import yaml
import logging
from git import GitCommandError
from .comparison import create_change_summary
from .utils import determine_type

logger = logging.getLogger(__name__)


def get_outgoing_changes(repo):
    """Get list of changes in working directory"""
    try:
        # Get status of working directory
        status = repo.git.status('--porcelain', '-z').split('\0')
        logger.info(f"Processing {len(status)} changes from git status")

        changes = []
        i = 0

        while i < len(status):
            item = status[i]
            if not item:
                i += 1
                continue

            if len(item) < 4:
                logger.warning(f"Invalid status item format: {item}")
                i += 1
                continue

            x, y = item[0], item[1]
            file_path = item[3:]

            # Skip files in conflict state
            if x == 'U' or y == 'U':
                i += 1
                continue

            is_staged = x != ' ' and x != '?'

            try:
                # Get old content (from HEAD)
                try:
                    old_content = repo.git.show(f'HEAD:{file_path}')
                    old_data = yaml.safe_load(old_content)
                except GitCommandError:
                    old_data = None
                except yaml.YAMLError as e:
                    logger.warning(
                        f"Failed to parse old YAML for {file_path}: {str(e)}")
                    old_data = None

                # Get new content (from working directory)
                try:
                    full_path = os.path.join(repo.working_dir, file_path)
                    with open(full_path, 'r') as f:
                        new_data = yaml.safe_load(f.read())
                except (IOError, yaml.YAMLError) as e:
                    logger.warning(
                        f"Failed to read/parse current file {file_path}: {str(e)}"
                    )
                    new_data = None

                # Generate change summary
                change = create_change_summary(old_data, new_data, file_path)
                change['type'] = determine_type(file_path)
                change['staged'] = is_staged
                changes.append(change)

            except Exception as e:
                logger.error(f"Failed to process {file_path}: {str(e)}",
                             exc_info=True)

            i += 1

            # Handle renamed files
            if x == 'R' or y == 'R':
                if i + 1 < len(status) and status[i + 1]:
                    i += 2  # Skip the old filename entry
                else:
                    i += 1

        return changes

    except Exception as e:
        logger.error(f"Failed to get outgoing changes: {str(e)}",
                     exc_info=True)
        return []
