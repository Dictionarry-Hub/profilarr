import os
import yaml
import logging
from git import GitCommandError
from .comparison import create_change_summary
from .utils import determine_type, extract_name_from_path

logger = logging.getLogger(__name__)


# Use the centralized extract_name_from_path function from utils
extract_name = extract_name_from_path


def get_outgoing_changes(repo):
    """Get list of changes in working directory"""
    try:
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

            # Handle renamed files
            if x == 'R' or y == 'R':
                if i + 1 < len(status) and status[i + 1]:
                    outgoing_name = extract_name(file_path)
                    prior_name = extract_name(status[i + 1])
                    original_path = status[i + 1]  # Path for old content
                    new_path = file_path  # Path for new content
                    is_staged = x == 'R'
                    status_value = 'Renamed'
                    i += 2
                else:
                    i += 1
            else:
                name = extract_name(file_path)
                prior_name = name
                outgoing_name = name
                original_path = file_path
                new_path = file_path
                is_staged = x != ' ' and x != '?'
                status_value = None
                i += 1

            try:
                # Get old content (from HEAD)
                try:
                    old_content = repo.git.show(f'HEAD:{original_path}')
                    old_data = yaml.safe_load(old_content)
                except GitCommandError:
                    old_data = None
                except yaml.YAMLError as e:
                    logger.warning(
                        f"Failed to parse old YAML for {original_path}: {str(e)}"
                    )
                    old_data = None

                # Get new content (from working directory)
                try:
                    full_path = os.path.join(repo.working_dir, new_path)
                    with open(full_path, 'r') as f:
                        new_data = yaml.safe_load(f.read())
                except (IOError, yaml.YAMLError) as e:
                    logger.warning(
                        f"Failed to read/parse current file {new_path}: {str(e)}"
                    )
                    new_data = None

                # Generate change summary
                change = create_change_summary(old_data, new_data, new_path)
                change['type'] = determine_type(new_path)
                change['staged'] = is_staged
                change['prior_name'] = prior_name
                change['outgoing_name'] = outgoing_name

                if status_value:
                    change['status'] = status_value

                changes.append(change)

            except Exception as e:
                logger.error(f"Failed to process {file_path}: {str(e)}",
                             exc_info=True)

        return changes

    except Exception as e:
        logger.error(f"Failed to get outgoing changes: {str(e)}",
                     exc_info=True)
        return []
