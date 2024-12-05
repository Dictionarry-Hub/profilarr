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
FORMAT_FIELDS = ["name", "description", "tags", "conditions", "tests"]
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
    "language",
    "tweaks"
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
    Returns match information along with test results.
    """
    logger.info(f"Starting regex pattern test - Pattern: {pattern}")

    try:
        try:
            compiled_pattern = regex.compile(pattern,
                                             regex.V1 | regex.IGNORECASE)
            logger.info(
                "Pattern compiled successfully with PCRE2 compatibility")
        except regex.error as e:
            logger.warning(f"Invalid regex pattern: {str(e)}")
            return False, f"Invalid regex pattern: {str(e)}", tests

        current_time = datetime.now().isoformat()
        logger.info(f"Processing {len(tests)} test cases")

        for test in tests:
            test_id = test.get('id', 'unknown')
            test_input = test.get('input', '')
            expected = test.get('expected', False)

            try:
                match = compiled_pattern.search(test_input)
                matches = bool(match)

                # Update test result with basic fields
                test['passes'] = matches == expected
                test['lastRun'] = current_time

                # Add match information
                if match:
                    test['matchedContent'] = match.group(0)
                    test['matchSpan'] = {
                        'start': match.start(),
                        'end': match.end()
                    }
                    # Get all capture groups if they exist
                    test['matchedGroups'] = [g for g in match.groups()
                                             ] if match.groups() else []
                else:
                    test['matchedContent'] = None
                    test['matchSpan'] = None
                    test['matchedGroups'] = []

                logger.info(
                    f"Test {test_id} {'passed' if test['passes'] else 'failed'} - Match: {matches}, Expected: {expected}"
                )

            except Exception as e:
                logger.error(f"Error running test {test_id}: {str(e)}")
                test['passes'] = False
                test['lastRun'] = current_time
                test['matchedContent'] = None
                test['matchSpan'] = None
                test['matchedGroups'] = []

        # Log overall results
        passed_tests = sum(1 for test in tests if test.get('passes', False))
        logger.info(
            f"Test execution complete - {passed_tests}/{len(tests)} tests passed"
        )

        return True, "", tests

    except Exception as e:
        logger.error(f"Unexpected error in test_regex_pattern: {str(e)}",
                     exc_info=True)
        return False, str(e), tests


def test_format_conditions(conditions: List[Dict],
                           tests: List[Dict]) -> Tuple[bool, str, List[Dict]]:
    """
    Test a set of format conditions against a list of test cases.
    Tests only pattern-based conditions (release_title, release_group, edition).
    """
    logger.info(
        f"Starting format condition test - {len(conditions)} conditions")
    logger.error(f"Received conditions: {conditions}")
    logger.error(f"Received tests: {tests}")

    try:
        # First, load all regex patterns from the patterns directory
        patterns_dir = os.path.join(REPO_PATH, 'regex_patterns')
        pattern_map = {}

        logger.error(f"Loading patterns from directory: {patterns_dir}")
        if not os.path.exists(patterns_dir):
            logger.error(f"Patterns directory not found: {patterns_dir}")
            return False, "Patterns directory not found", tests

        for pattern_file in os.listdir(patterns_dir):
            if pattern_file.endswith('.yml'):
                pattern_path = os.path.join(patterns_dir, pattern_file)
                try:
                    with open(pattern_path, 'r') as f:
                        pattern_data = yaml.safe_load(f)
                        if pattern_data and 'name' in pattern_data and 'pattern' in pattern_data:
                            pattern_map[
                                pattern_data['name']] = pattern_data['pattern']
                            logger.error(
                                f"Loaded pattern: {pattern_data['name']} = {pattern_data['pattern']}"
                            )
                except Exception as e:
                    logger.error(
                        f"Error loading pattern file {pattern_file}: {e}")
                    continue

        logger.error(f"Total patterns loaded: {len(pattern_map)}")

        # Compile all regex patterns first
        compiled_patterns = {}
        for condition in conditions:
            if condition['type'] in [
                    'release_title', 'release_group', 'edition'
            ]:
                logger.error(f"Processing condition: {condition}")
                try:
                    pattern_name = condition.get('pattern', '')
                    if pattern_name:
                        # Look up the actual pattern using the pattern name
                        actual_pattern = pattern_map.get(pattern_name)
                        if actual_pattern:
                            compiled_patterns[
                                condition['name']] = regex.compile(
                                    actual_pattern,
                                    regex.V1 | regex.IGNORECASE)
                            logger.error(
                                f"Successfully compiled pattern for {condition['name']}: {actual_pattern}"
                            )
                        else:
                            logger.error(
                                f"Pattern not found for name: {pattern_name}")
                            return False, f"Pattern not found: {pattern_name}", tests
                except regex.error as e:
                    logger.error(
                        f"Invalid regex pattern in condition {condition['name']}: {str(e)}"
                    )
                    return False, f"Invalid regex pattern in condition {condition['name']}: {str(e)}", tests

        logger.error(f"Total patterns compiled: {len(compiled_patterns)}")
        current_time = datetime.now().isoformat()

        # Process each test
        for test in tests:
            test_input = test.get('input', '')
            expected = test.get('expected', False)
            condition_results = []
            logger.error(
                f"Processing test input: {test_input}, expected: {expected}")

            # Check each condition
            for condition in conditions:
                if condition['type'] not in [
                        'release_title', 'release_group', 'edition'
                ]:
                    logger.error(
                        f"Skipping non-pattern condition: {condition['type']}")
                    continue

                pattern = compiled_patterns.get(condition['name'])
                if not pattern:
                    logger.error(
                        f"No compiled pattern found for condition: {condition['name']}"
                    )
                    continue

                # Test if pattern matches input
                matches = bool(pattern.search(test_input))
                logger.error(
                    f"Condition {condition['name']} match result: {matches}")

                # Add result
                condition_results.append({
                    'name':
                    condition['name'],
                    'type':
                    condition['type'],
                    'pattern':
                    condition.get('pattern', ''),
                    'required':
                    condition.get('required', False),
                    'negate':
                    condition.get('negate', False),
                    'matches':
                    matches
                })

            # Determine if format applies
            format_applies = True

            # Check required conditions
            for result in condition_results:
                if result['required']:
                    logger.error(
                        f"Checking required condition: {result['name']}, negate: {result['negate']}, matches: {result['matches']}"
                    )
                    if result['negate']:
                        if result['matches']:
                            format_applies = False
                            logger.error(
                                f"Required negated condition {result['name']} matched - format does not apply"
                            )
                            break
                    else:
                        if not result['matches']:
                            format_applies = False
                            logger.error(
                                f"Required condition {result['name']} did not match - format does not apply"
                            )
                            break

            # Check non-required conditions
            if format_applies:
                for result in condition_results:
                    if not result['required'] and result['negate'] and result[
                            'matches']:
                        format_applies = False
                        logger.error(
                            f"Non-required negated condition {result['name']} matched - format does not apply"
                        )
                        break

            test['passes'] = format_applies == expected
            test['lastRun'] = current_time
            test['conditionResults'] = condition_results

            logger.error(
                f"Test result - format_applies: {format_applies}, expected: {expected}, passes: {test['passes']}"
            )

        # Log final results
        passed_tests = sum(1 for test in tests if test.get('passes', False))
        logger.error(
            f"Final test results - {passed_tests}/{len(tests)} tests passed")
        logger.error(f"Updated tests: {tests}")

        return True, "", tests

    except Exception as e:
        logger.error(f"Unexpected error in test_format_conditions: {str(e)}",
                     exc_info=True)
        return False, str(e), tests
