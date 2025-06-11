# git/status/utils.py

import os
import yaml
import logging
import re

logger = logging.getLogger(__name__)


def extract_data_from_yaml(file_path):
    logger.debug(f"Extracting data from file: {file_path}")
    try:
        with open(file_path, 'r') as f:
            content = yaml.safe_load(f)
            logger.debug(
                f"File content: {content}")  # Log the full file content
            if content is None:
                logger.error(
                    f"Failed to parse YAML file or file is empty: {file_path}")
                return None

            # Check if expected keys are in the content
            if 'name' not in content or 'id' not in content:
                logger.warning(
                    f"'name' or 'id' not found in file: {file_path}")

            return {'name': content.get('name'), 'id': content.get('id')}
    except Exception as e:
        logger.warning(f"Error reading file {file_path}: {str(e)}")
        return None


def determine_type(file_path):
    if 'regex_patterns' in file_path:
        return 'Regex Pattern'
    elif 'custom_formats' in file_path:
        return 'Custom Format'
    elif 'profiles' in file_path:
        return 'Quality Profile'
    elif 'media_management' in file_path:
        return 'Media Management'
    return 'Unknown'


def format_media_management_name(name):
    """Format media management category names for display"""
    name_mapping = {
        'misc': 'Miscellaneous',
        'naming': 'Naming',
        'quality_definitions': 'Quality Definitions'
    }
    return name_mapping.get(name, name)


def extract_name_from_path(file_path):
    """Extract and format name from file path"""
    # Remove the file extension
    name = os.path.splitext(file_path)[0]
    # Remove the type prefix (everything before the first '/')
    if '/' in name:
        name = name.split('/', 1)[1]
    
    # Format media management names
    if 'media_management' in file_path:
        return format_media_management_name(name)
    
    return name


def interpret_git_status(x, y):
    if x == 'D' or y == 'D':
        return 'Deleted'
    elif x == 'A':
        return 'Added'
    elif x == 'M' or y == 'M':
        return 'Modified'
    elif x == 'R':
        return 'Renamed'
    elif x == 'C':
        return 'Copied'
    elif x == 'U':
        return 'Updated but unmerged'
    elif x == '?' and y == '?':
        return 'Untracked'
    else:
        return 'Unknown'


def parse_commit_message(commit_message):
    # Default placeholders for missing parts of the commit message
    placeholders = {
        'type': 'Unknown Type',
        'scope': 'Unknown Scope',
        'subject': 'No subject provided',
        'body': 'No body provided',
        'footer': ''
    }

    # Mapping of commit types and scopes to canonical forms
    type_mapping = {
        'feat': 'New Feature',
        'feature': 'New Feature',
        'new': 'New Feature',
        'fix': 'BugFix',
        'bugfix': 'BugFix',
        'bug': 'BugFix',
        'docs': 'Documentation',
        'documentation': 'Documentation',
        'doc': 'Documentation',
        'style': 'Style Change',
        'formatting': 'Style Change',
        'format': 'Style Change',
        'lint': 'Style Change',
        'refactor': 'Refactor',
        'refactoring': 'Refactor',
        'restructure': 'Refactor',
        'redesign': 'Refactor',
        'perf': 'Performance Improvement',
        'performance': 'Performance Improvement',
        'optimize': 'Performance Improvement',
        'optimisation': 'Performance Improvement',
        'test': 'Test',
        'testing': 'Test',
        'chore': 'Maintenance',
        'maintenance': 'Maintenance',
        'maintain': 'Maintenance'
    }

    scope_mapping = {
        'regex': 'Regex Pattern',
        'regex pattern': 'Regex Pattern',
        'format': 'Custom Format',
        'custom format': 'Custom Format',
        'profile': 'Quality Profile',
        'quality profile': 'Quality Profile'
    }

    # Regex patterns for each part of the commit message
    type_pattern = r'^(?P<type>feat|feature|new|fix|bugfix|bug|docs|documentation|doc|style|formatting|format|lint|refactor|refactoring|restructure|redesign|perf|performance|optimize|optimisation|test|testing|chore|maintenance|maintain)'
    scope_pattern = r'\((?P<scope>regex|regex pattern|format|custom format|profile|quality profile)\)'
    subject_pattern = r':\s(?P<subject>.+)'
    body_pattern = r'(?P<body>(?:- .+\n?)+)'  # Handles multiple lines in the body
    footer_pattern = r'(?P<footer>(Fixes|Resolves|See also|Relates to)\s.+)'

    # Initialize result with placeholders
    parsed_message = placeholders.copy()

    # Parse the type and scope
    type_scope_match = re.match(
        f'{type_pattern}{scope_pattern}{subject_pattern}', commit_message,
        re.IGNORECASE)
    if type_scope_match:
        matched_type = type_scope_match.group('type').lower()
        matched_scope = type_scope_match.group('scope').lower()

        # Map the matched values to their canonical forms
        parsed_message['type'] = type_mapping.get(matched_type, 'Unknown Type')
        parsed_message['scope'] = scope_mapping.get(matched_scope,
                                                    'Unknown Scope')
        parsed_message['subject'] = type_scope_match.group('subject').strip()

    # Match and extract the body part
    body_match = re.search(body_pattern, commit_message, re.MULTILINE)
    if body_match:
        parsed_message['body'] = body_match.group('body').strip()

    # Match and extract the footer (if present)
    footer_match = re.search(footer_pattern, commit_message)
    if footer_match:
        parsed_message['footer'] = footer_match.group('footer').strip()

    return parsed_message
