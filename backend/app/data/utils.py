import os
import yaml
import shutil
import logging
from datetime import datetime
from typing import Dict, List, Any, Tuple, Union
import git
import regex

logger = logging.getLogger(__name__)

# Directory constants
REPO_PATH = '/app/data/db'
REGEX_DIR = '/app/data/db/regex_patterns'
FORMAT_DIR = '/app/data/db/custom_formats'
PROFILE_DIR = '/app/data/db/profiles'

# Expected fields for each category
REGEX_FIELDS = ["name", "pattern", "description", "tags", "tests"]
FORMAT_FIELDS = ["name", "format", "description"]
PROFILE_FIELDS = [
    "name",
    "description",
    "tags",
    "upgradesAllowed",
    "minCustomFormatScore",
    "upgradeUntilScore",
    "minScoreIncrement",
    "custom_formats",  # Array of {name, score} objects
    "qualities",  # Array of strings
    "upgrade_until",
    "language"
]

# Category mappings
CATEGORY_MAP = {
    "custom_format": (FORMAT_DIR, FORMAT_FIELDS),
    "regex_pattern": (REGEX_DIR, REGEX_FIELDS),
    "profile": (PROFILE_DIR, PROFILE_FIELDS)
}


def _setup_yaml_quotes():
    """Configure YAML to quote string values"""

    def str_presenter(dumper, data):
        return dumper.represent_scalar('tag:yaml.org,2002:str',
                                       data,
                                       style="'")

    yaml.add_representer(str, str_presenter)


def get_file_created_date(file_path: str) -> str:
    """Get file creation date in ISO format"""
    try:
        stats = os.stat(file_path)
        return datetime.fromtimestamp(stats.st_ctime).isoformat()
    except Exception as e:
        logger.error(f"Error getting creation date for {file_path}: {e}")
        return None


def get_file_modified_date(file_path: str) -> str:
    """Get file last modified date in ISO format"""
    try:
        stats = os.stat(file_path)
        return datetime.fromtimestamp(stats.st_mtime).isoformat()
    except Exception as e:
        logger.error(f"Error getting modified date for {file_path}: {e}")
        return None


def get_category_directory(category: str) -> str:
    try:
        directory, _ = CATEGORY_MAP[category]
    except KeyError:
        logger.error(f"Invalid category requested: {category}")
        raise ValueError(f"Invalid category: {category}")

    if not os.path.exists(directory):
        logger.error(f"Directory not found: {directory}")
        raise FileNotFoundError(f"Directory not found: {directory}")

    return directory


def load_yaml_file(file_path: str) -> Dict[str, Any]:
    if not os.path.exists(file_path):
        logger.error(f"File not found: {file_path}")
        raise FileNotFoundError(f"File not found: {file_path}")

    try:
        with open(file_path, 'r') as f:
            content = yaml.safe_load(f)
            return content
    except yaml.YAMLError as e:
        logger.error(f"Error parsing YAML file {file_path}: {e}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error reading file {file_path}: {e}")
        raise


def validate(data: Dict[str, Any], category: str) -> bool:
    if not isinstance(data, dict):
        return False

    _, fields = CATEGORY_MAP[category]
    return all(field in data for field in fields)


def save_yaml_file(file_path: str, data: Dict[str, Any],
                   category: str) -> None:
    if not validate(data, category):
        raise ValueError("Invalid data format")

    _, fields = CATEGORY_MAP[category]
    ordered_data = {field: data[field] for field in fields}

    _setup_yaml_quotes()  # Configure YAML for quoted strings

    with open(file_path, 'w') as f:
        yaml.safe_dump(ordered_data, f, sort_keys=False)


def update_yaml_file(file_path: str, data: Dict[str, Any],
                     category: str) -> None:
    try:
        # Check if this is a rename operation
        if 'rename' in data:
            new_name = data['rename']
            directory = os.path.dirname(file_path)
            new_file_path = os.path.join(directory, f"{new_name}.yml")

            # Remove rename field before saving
            data_to_save = {k: v for k, v in data.items() if k != 'rename'}

            # First save the updated content to the current file
            save_yaml_file(file_path, data_to_save, category)

            # Check if file is being tracked by git
            repo = git.Repo(REPO_PATH)
            rel_old_path = os.path.relpath(file_path, REPO_PATH)
            rel_new_path = os.path.relpath(new_file_path, REPO_PATH)

            try:
                # Check if file is tracked by git
                tracked_files = repo.git.ls_files().splitlines()
                is_tracked = rel_old_path in tracked_files

                if is_tracked:
                    # Use git mv for tracked files
                    repo.git.mv(rel_old_path, rel_new_path)
                else:
                    # For untracked files, manually move
                    os.rename(file_path, new_file_path)

            except git.GitCommandError as e:
                logger.error(f"Git operation failed: {e}")
                raise Exception("Failed to rename file")
            except OSError as e:
                logger.error(f"File operation failed: {e}")
                raise Exception("Failed to rename file")

        else:
            # Normal update without rename
            backup_path = f"{file_path}.bak"
            shutil.copy2(file_path, backup_path)
            try:
                save_yaml_file(file_path, data, category)
                os.remove(backup_path)
            except Exception as e:
                shutil.move(backup_path, file_path)
                raise

    except Exception as e:
        raise


def test_regex_pattern(
        pattern: str,
        tests: List[Dict[str, Any]]) -> Tuple[bool, str, List[Dict[str, Any]]]:
    """
    Test a regex pattern against a list of test cases using PCRE2 compatible engine.
    
    Args:
        pattern: The regex pattern to test
        tests: List of test dictionaries with 'input', 'expected', 'id', and 'passes' fields
        
    Returns:
        Tuple of (success, message, updated_tests)
    """
    logger.info(f"Starting regex pattern test - Pattern: {pattern}")

    try:
        # Try to compile the regex with PCRE2 compatibility
        try:
            compiled_pattern = regex.compile(pattern, regex.V1)
            logger.info(
                "Pattern compiled successfully with PCRE2 compatibility")
        except regex.error as e:
            logger.warning(f"Invalid regex pattern: {str(e)}")
            return False, f"Invalid regex pattern: {str(e)}", tests

        current_time = datetime.now().isoformat()
        logger.info(f"Processing {len(tests)} test cases")

        # Run each test
        for test in tests:
            test_id = test.get('id', 'unknown')
            test_input = test.get('input', '')
            expected = test.get('expected', False)

            logger.info(
                f"Running test {test_id} - Input: {test_input}, Expected: {expected}"
            )

            try:
                # Test if pattern matches input
                matches = bool(compiled_pattern.search(test_input))
                # Update test result
                test['passes'] = matches == expected
                test['lastRun'] = current_time

                if test['passes']:
                    logger.info(
                        f"Test {test_id} passed - Match result: {matches}")
                else:
                    logger.warning(
                        f"Test {test_id} failed - Expected {expected}, got {matches}"
                    )

            except Exception as e:
                logger.warning(f"Error running test {test_id}: {str(e)}")
                test['passes'] = False
                test['lastRun'] = current_time

        # Log overall results
        passed_tests = sum(1 for test in tests if test.get('passes', False))
        logger.info(
            f"Test execution complete - {passed_tests}/{len(tests)} tests passed"
        )

        return True, "", tests
    except Exception as e:
        logger.warning(f"Unexpected error in test_regex_pattern: {str(e)}",
                       exc_info=True)
        return False, str(e), tests
