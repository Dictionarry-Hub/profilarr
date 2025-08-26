import os
import yaml
import shutil
import logging
from datetime import datetime
from typing import Dict, List, Any, Tuple, Union
import git
import regex
import logging
import subprocess
import json
from ..db.queries.arr import update_arr_config_on_rename, update_arr_config_on_delete

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

from ..config.config import config

# Directory constants
REPO_PATH = config.DB_DIR
REGEX_DIR = config.REGEX_DIR
FORMAT_DIR = config.FORMAT_DIR
PROFILE_DIR = config.PROFILE_DIR

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
    "custom_formats",  # Array of {name, score} objects (backwards compatible)
    "custom_formats_radarr",  # Array of {name, score} objects for radarr-specific scores
    "custom_formats_sonarr",  # Array of {name, score} objects for sonarr-specific scores
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


def display_to_filename(name: str) -> str:
    """Convert display name (with []) to filename (with ())"""
    return f"{name.replace('[', '(').replace(']', ')')}.yml"


def filename_to_display(filename: str) -> str:
    """Convert filename (with ()) back to display name (with [])"""
    name = filename[:-4] if filename.endswith('.yml') else filename
    return name.replace('(', '[').replace(')', ']')


def _setup_yaml_quotes():
    """Configure YAML to quote string values"""

    def str_presenter(dumper, data):
        return dumper.represent_scalar('tag:yaml.org,2002:str',
                                       data,
                                       style="'")

    yaml.add_representer(str, str_presenter)


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
    file_path = file_path.replace('[', '(').replace(']', ')')

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


def save_yaml_file(file_path: str,
                   data: Dict[str, Any],
                   category: str,
                   use_data_name: bool = True) -> None:
    """
    Save YAML data to a file
    Args:
        file_path: The path where the file should be saved
        data: The data to save
        category: The category of data
        use_data_name: If True, use the name from data to create filename. If False, use the provided file_path as is.
    """
    if not validate(data, category):
        raise ValueError("Invalid data format")

    directory = os.path.dirname(file_path)

    if use_data_name:
        filename = display_to_filename(data['name'])
        safe_file_path = os.path.join(directory, filename)
    else:
        safe_file_path = file_path

    _, fields = CATEGORY_MAP[category]
    ordered_data = {field: data[field] for field in fields}

    _setup_yaml_quotes()

    with open(safe_file_path, 'w') as f:
        yaml.safe_dump(ordered_data, f, sort_keys=False)
    
    # Update cache
    from .cache import data_cache
    filename = os.path.basename(safe_file_path)
    data_cache.update_item(category, filename, ordered_data)


def update_yaml_file(file_path: str, data: Dict[str, Any],
                     category: str) -> None:
    try:
        # Check if this is a rename operation
        if 'rename' in data:
            new_name = data['rename']
            old_name = filename_to_display(os.path.basename(file_path)[:-4])

            directory = os.path.dirname(file_path)
            new_file_path = os.path.join(directory,
                                         display_to_filename(new_name))

            # Update references before performing the rename
            try:
                # Update regular references
                updated_files = update_references(category, old_name, new_name)
                logger.info(f"Updated references in: {updated_files}")

                # Update arr configs if this is a format or profile
                if category in ['custom_format', 'profile']:
                    arr_category = 'customFormats' if category == 'custom_format' else 'profiles'
                    updated_configs = update_arr_config_on_rename(
                        arr_category, old_name, new_name)
                    if updated_configs:
                        logger.info(
                            f"Updated arr configs for {category} rename: {updated_configs}"
                        )

            except Exception as e:
                logger.error(f"Failed to update references: {e}")
                raise Exception(f"Failed to update references: {str(e)}")

            # Remove rename field and update the name field in the data
            data_to_save = {k: v for k, v in data.items() if k != 'rename'}
            data_to_save['name'] = new_name

            repo = git.Repo(REPO_PATH)
            rel_old_path = os.path.relpath(file_path, REPO_PATH)
            rel_new_path = os.path.relpath(new_file_path, REPO_PATH)

            try:
                # First, save the content changes to the current file
                save_yaml_file(file_path,
                               data_to_save,
                               category,
                               use_data_name=False)

                # Stage the content changes first
                repo.index.add([rel_old_path])

                # Then perform the rename
                tracked_files = repo.git.ls_files().splitlines()
                is_tracked = rel_old_path in tracked_files

                if is_tracked:
                    # Use git mv for tracked files
                    repo.git.mv(rel_old_path, rel_new_path)
                else:
                    # For untracked files, manually move
                    os.rename(file_path, new_file_path)
                    # Stage the new file
                    repo.index.add([rel_new_path])
                
                # Update cache for rename
                from .cache import data_cache
                old_filename = os.path.basename(file_path)
                new_filename = os.path.basename(new_file_path)
                data_cache.rename_item(category, old_filename, new_filename)

            except git.GitCommandError as e:
                logger.error(f"Git operation failed: {e}")
                raise Exception(f"Failed to rename file: {str(e)}")
            except OSError as e:
                logger.error(f"File operation failed: {e}")
                raise Exception(f"Failed to rename file: {str(e)}")

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


def check_delete_constraints(category: str, name: str) -> Tuple[bool, str]:
    """
    Check if deleting an item would break any references.
    Returns (can_delete, error_message) tuple.
    """
    try:
        # Protected custom formats that cannot be deleted
        PROTECTED_FORMATS = [
            "Not English", "Not Only English", "Not Only English (Missing)"
        ]

        # Convert the input name to use parentheses for comparison
        check_name = name.replace('[', '(').replace(']', ')')
        logger.debug(
            f"Checking constraints for {category}: {name} (normalized as {check_name})"
        )

        # Check protected formats first
        if category == 'custom_format' and check_name in [
                f.replace('[', '(').replace(']', ')')
                for f in PROTECTED_FORMATS
        ]:
            return False, "This format cannot be deleted as it's required for language processing functionality"

        references = []

        if category == 'regex_pattern':
            # Check all custom formats for references to this pattern
            format_dir = get_category_directory('custom_format')
            for format_file in os.listdir(format_dir):
                if not format_file.endswith('.yml'):
                    continue

                format_path = os.path.join(format_dir, format_file)
                try:
                    format_data = load_yaml_file(format_path)
                    # Check each condition in the format
                    for condition in format_data.get('conditions', []):
                        if condition['type'] in [
                                'release_title', 'release_group', 'edition'
                        ] and condition.get('pattern') == check_name:
                            references.append(
                                f"custom format: {format_data['name']}")
                except Exception as e:
                    logger.error(
                        f"Error checking format file {format_file}: {e}")
                    continue

        elif category == 'custom_format':
            # Check all quality profiles for references to this format
            profile_dir = get_category_directory('profile')
            for profile_file in os.listdir(profile_dir):
                if not profile_file.endswith('.yml'):
                    continue

                profile_path = os.path.join(profile_dir, profile_file)
                try:
                    profile_data = load_yaml_file(profile_path)
                    
                    # Check custom_formats (both/backwards compatible)
                    custom_formats = profile_data.get('custom_formats', [])
                    if isinstance(custom_formats, list):
                        for format_ref in custom_formats:
                            format_name = format_ref.get('name', '')
                            # Convert format name to use parentheses for comparison
                            format_name = format_name.replace('[', '(').replace(']', ')')
                            logger.debug(f"Comparing '{format_name}' with '{check_name}' in both")

                            if format_name == check_name:
                                references.append(f"quality profile: {profile_data['name']} (both)")
                    
                    # Check custom_formats_radarr
                    custom_formats_radarr = profile_data.get('custom_formats_radarr', [])
                    if isinstance(custom_formats_radarr, list):
                        for format_ref in custom_formats_radarr:
                            format_name = format_ref.get('name', '')
                            # Convert format name to use parentheses for comparison
                            format_name = format_name.replace('[', '(').replace(']', ')')
                            logger.debug(f"Comparing '{format_name}' with '{check_name}' in radarr")

                            if format_name == check_name:
                                references.append(f"quality profile: {profile_data['name']} (radarr)")
                    
                    # Check custom_formats_sonarr
                    custom_formats_sonarr = profile_data.get('custom_formats_sonarr', [])
                    if isinstance(custom_formats_sonarr, list):
                        for format_ref in custom_formats_sonarr:
                            format_name = format_ref.get('name', '')
                            # Convert format name to use parentheses for comparison
                            format_name = format_name.replace('[', '(').replace(']', ')')
                            logger.debug(f"Comparing '{format_name}' with '{check_name}' in sonarr")

                            if format_name == check_name:
                                references.append(f"quality profile: {profile_data['name']} (sonarr)")
                                
                except Exception as e:
                    logger.error(f"Error checking profile file {profile_file}: {e}")
                    continue

        # Update arr configs for formats and profiles
        if category in ['custom_format', 'profile']:
            arr_category = 'customFormats' if category == 'custom_format' else 'profiles'
            updated_configs = update_arr_config_on_delete(arr_category, name)
            if updated_configs:
                logger.info(
                    f"Removed {name} from arr configs: {updated_configs}")

        if references:
            error_msg = f"Cannot delete - item is referenced in:\n" + "\n".join(
                f"- {ref}" for ref in references)
            logger.info(f"Found references for {name}: {error_msg}")
            return False, error_msg

        logger.info(f"No references found for {name}")
        return True, ""

    except Exception as e:
        logger.error(f"Error checking delete constraints: {e}")
        return False, f"Error checking references: {str(e)}"


def verify_dotnet_regex(pattern: str) -> Tuple[bool, str]:
    """
    Verify a regex pattern using .NET regex engine via PowerShell.
    Returns (success, message) tuple.
    """
    try:
        # Get the path to the validate.ps1 script
        # In Docker, the structure is /app/app/data/utils.py and script is at /app/scripts/validate.ps1
        script_path = os.path.join('/app', 'scripts', 'validate.ps1')
        if not os.path.exists(script_path):
            # Fallback for local development
            script_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'scripts', 'validate.ps1')
        
        # Run PowerShell script, passing pattern via stdin to avoid shell escaping issues
        result = subprocess.run(
            ['pwsh', '-File', script_path],
            input=pattern,
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode != 0 and not result.stdout:
            logger.error(f"PowerShell script failed: {result.stderr}")
            return False, "Failed to validate pattern"
        
        # Log the raw output for debugging
        logger.debug(f"PowerShell output: {result.stdout}")
        
        # Parse JSON output
        try:
            output = json.loads(result.stdout.strip())
        except json.JSONDecodeError:
            # Try to find JSON in the output
            lines = result.stdout.strip().split('\n')
            for line in reversed(lines):
                if line.strip():
                    try:
                        output = json.loads(line)
                        break
                    except json.JSONDecodeError:
                        continue
            else:
                logger.error(f"No valid JSON found in output: {result.stdout}")
                return False, "Failed to parse validation result"
        
        if output.get('valid'):
            return True, output.get('message', 'Pattern is valid')
        else:
            return False, output.get('error', 'Invalid pattern')
            
    except subprocess.TimeoutExpired:
        logger.error("Pattern validation timed out")
        return False, "Pattern validation timed out"
    except FileNotFoundError:
        logger.error("PowerShell (pwsh) not found")
        return False, "PowerShell is not available"
    except Exception as e:
        logger.error(f"Error validating pattern: {e}")
        return False, f"Validation error: {str(e)}"


def update_references(category: str, old_name: str,
                      new_name: str) -> List[str]:
    """
    Update references to a renamed item across all relevant files.
    Returns a list of files that were updated.
    """
    updated_files = []

    try:
        # Convert names to use parentheses for comparison
        old_check_name = old_name.replace('[', '(').replace(']', ')')
        new_check_name = new_name.replace('[', '(').replace(']', ')')

        if category == 'regex_pattern':
            # Update references in custom formats
            format_dir = get_category_directory('custom_format')
            for format_file in os.listdir(format_dir):
                if not format_file.endswith('.yml'):
                    continue

                format_path = os.path.join(format_dir, format_file)
                try:
                    format_data = load_yaml_file(format_path)
                    updated = False

                    # Check and update each condition in the format
                    for condition in format_data.get('conditions', []):
                        if (condition['type'] in [
                                'release_title', 'release_group', 'edition'
                        ] and condition.get('pattern') == old_check_name):
                            condition['pattern'] = new_check_name
                            updated = True

                    if updated:
                        save_yaml_file(format_path,
                                       format_data,
                                       'custom_format',
                                       use_data_name=False)
                        updated_files.append(
                            f"custom format: {format_data['name']}")

                except Exception as e:
                    logger.error(
                        f"Error updating format file {format_file}: {e}")
                    continue

        elif category == 'custom_format':
            # Update references in quality profiles
            profile_dir = get_category_directory('profile')
            for profile_file in os.listdir(profile_dir):
                if not profile_file.endswith('.yml'):
                    continue

                profile_path = os.path.join(profile_dir, profile_file)
                try:
                    profile_data = load_yaml_file(profile_path)
                    updated = False

                    # Update custom_formats (both/backwards compatible)
                    custom_formats = profile_data.get('custom_formats', [])
                    if isinstance(custom_formats, list):
                        for format_ref in custom_formats:
                            format_name = format_ref.get('name', '')
                            # Convert format name to use parentheses for comparison
                            format_name = format_name.replace('[', '(').replace(']', ')')

                            if format_name == old_check_name:
                                format_ref['name'] = new_name
                                updated = True
                    
                    # Update custom_formats_radarr
                    custom_formats_radarr = profile_data.get('custom_formats_radarr', [])
                    if isinstance(custom_formats_radarr, list):
                        for format_ref in custom_formats_radarr:
                            format_name = format_ref.get('name', '')
                            # Convert format name to use parentheses for comparison
                            format_name = format_name.replace('[', '(').replace(']', ')')

                            if format_name == old_check_name:
                                format_ref['name'] = new_name
                                updated = True
                    
                    # Update custom_formats_sonarr
                    custom_formats_sonarr = profile_data.get('custom_formats_sonarr', [])
                    if isinstance(custom_formats_sonarr, list):
                        for format_ref in custom_formats_sonarr:
                            format_name = format_ref.get('name', '')
                            # Convert format name to use parentheses for comparison
                            format_name = format_name.replace('[', '(').replace(']', ')')

                            if format_name == old_check_name:
                                format_ref['name'] = new_name
                                updated = True

                    if updated:
                        save_yaml_file(profile_path,
                                       profile_data,
                                       'profile',
                                       use_data_name=False)
                        updated_files.append(
                            f"quality profile: {profile_data['name']}")

                except Exception as e:
                    logger.error(
                        f"Error updating profile file {profile_file}: {e}")
                    continue

        return updated_files

    except Exception as e:
        logger.error(f"Error updating references: {e}")
        raise


def test_regex_pattern(
        pattern: str,
        tests: List[Dict[str, Any]]) -> Tuple[bool, str, List[Dict[str, Any]]]:
    """
    Test a regex pattern against a list of test cases using .NET regex engine via PowerShell.
    Returns match information along with test results.
    """

    try:
        # Get the path to the test.ps1 script
        script_path = os.path.join('/app', 'scripts', 'test.ps1')
        if not os.path.exists(script_path):
            # Fallback for local development
            script_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'scripts', 'test.ps1')
        
        # Prepare the input data
        input_data = {
            'pattern': pattern,
            'tests': tests
        }
        
        # Run PowerShell script
        result = subprocess.run(
            ['pwsh', '-File', script_path],
            input=json.dumps(input_data),
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode != 0 and not result.stdout:
            logger.error(f"PowerShell script failed: {result.stderr}")
            return False, "Failed to run tests", tests
        
        # Parse JSON output
        try:
            output = json.loads(result.stdout.strip())
        except json.JSONDecodeError:
            # Try to find JSON in the output
            lines = result.stdout.strip().split('\n')
            for line in reversed(lines):
                if line.strip():
                    try:
                        output = json.loads(line)
                        break
                    except json.JSONDecodeError:
                        continue
            else:
                logger.error(f"No valid JSON found in output: {result.stdout}")
                return False, "Failed to parse test results", tests
        
        if output.get('success'):
            return True, "Tests completed successfully", output.get('tests', tests)
        else:
            return False, output.get('message', 'Tests failed'), tests
            
    except subprocess.TimeoutExpired:
        logger.error("Test execution timed out")
        return False, "Test execution timed out", tests
    except FileNotFoundError:
        logger.error("PowerShell (pwsh) not found")
        return False, "PowerShell is not available", tests
    except Exception as e:
        logger.error(f"Error running tests: {e}")
        return False, f"Test error: {str(e)}", tests


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
