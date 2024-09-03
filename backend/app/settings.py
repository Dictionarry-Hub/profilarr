import os
import yaml
import git
from flask import Blueprint, request, jsonify
from git.exc import GitCommandError, InvalidGitRepositoryError
import shutil
import subprocess
import logging
from datetime import datetime
import json
import requests
from .git.unlink_repo import repo_bp, unlink_repository
from .git.clone_repo import clone_repository
from .git.authenticate import validate_git_token
from .git.status.status import get_git_status
from .git.status.diff import get_diff
from .git.branches.branches import Branch_Manager
from .git.operations.operations import GitOperations
from .settings_utils import load_settings, save_settings

logging.basicConfig(level=logging.DEBUG)
logging.getLogger('git').setLevel(logging.WARNING)
logger = logging.getLogger(__name__)

bp = Blueprint('settings', __name__, url_prefix='/settings')

DATA_DIR = '/app/data'
DB_DIR = os.path.join(DATA_DIR, 'db')
SETTINGS_FILE = os.path.join(DATA_DIR, 'config', 'settings.yml')
REGEX_DIR = os.path.join(DB_DIR, 'regex_patterns')
FORMAT_DIR = os.path.join(DB_DIR, 'custom_formats')

class SettingsManager:
    def __init__(self):
        self.settings = load_settings()
        self.repo_url = self.settings.get('gitRepo') if self.settings else None
        self.repo_path = DB_DIR
        self.branch_manager = Branch_Manager(self.repo_path)
        self.git_operations = GitOperations(self.repo_path)

    def clone_repository(self):
        return clone_repository(self.repo_url, self.repo_path, self.settings["gitToken"])
    
    def get_git_status(self):
        return get_git_status(self.repo_path)

    def get_branches(self):
        return self.branch_manager.get_all()

    def create_branch(self, branch_name, base_branch='main'):
        return self.branch_manager.create(branch_name, base_branch)

    def checkout_branch(self, branch_name):
        return self.branch_manager.checkout(branch_name)

    def delete_branch(self, branch_name):
        return self.branch_manager.delete(branch_name)

    def get_current_branch(self):
        return self.branch_manager.get_current()
        
    def stage_files(self, files):
        return self.git_operations.stage(files)

    def push_files(self, files, commit_message):
        return self.git_operations.push(files, commit_message)

    def revert_file(self, file_path):
        return self.git_operations.revert(file_path)

    def revert_all(self):
        return self.git_operations.revert_all()

    def delete_file(self, file_path):
        return self.git_operations.delete(file_path)

    def pull_branch(self, branch_name):
        return self.git_operations.pull(branch_name)

        
settings_manager = SettingsManager()
repo_bp.settings_manager = settings_manager

@bp.route('', methods=['GET'])
def handle_settings():
    settings = load_settings()
    if not settings:
        return jsonify({}), 204
    return jsonify(settings), 200

@bp.route('', methods=['POST'])
def update_settings():
    try:
        new_settings = request.json
        logger.info(f"Received new settings: {new_settings}")
        
        # Validate required fields
        required_fields = ['gitRepo', 'gitToken']
        for field in required_fields:
            if field not in new_settings:
                logger.error(f"Missing required field: {field}")
                return jsonify({"error": f"Missing required field: {field}"}), 400

        # Validate Git token
        if not validate_git_token(new_settings['gitRepo'], new_settings['gitToken']):
            logger.warning("Invalid Git token provided")
            return jsonify({"error": "Invalid Git token. Please check your credentials and try again."}), 401

        # Attempt to clone the repository before saving settings
        settings_manager.settings = new_settings
        settings_manager.repo_url = new_settings['gitRepo']
        success, message = settings_manager.clone_repository()
        
        if success:
            # Only save the settings if the clone was successful
            save_settings(new_settings)
            logger.info("Settings updated and repository cloned successfully")
            return jsonify(new_settings), 200
        else:
            logger.error(f"Failed to clone repository: {message}")
            return jsonify({"error": message}), 400
    except Exception as e:
        logger.exception("Unexpected error in update_settings")
        return jsonify({"error": f"Failed to update settings: {str(e)}"}), 500

@bp.route('/status', methods=['GET'])
def get_status():
    logger.debug("Received request for git status")
    success, message = settings_manager.get_git_status()
    if success:
        logger.debug("Successfully retrieved git status")
        return jsonify({'success': True, 'data': message}), 200
    else:
        logger.error(f"Failed to retrieve git status: {message}")
        return jsonify({'success': False, 'error': message}), 400

# Update the route handlers
@bp.route('/branch', methods=['POST'])
def create_branch():
    branch_name = request.json.get('name')
    base_branch = request.json.get('base', 'main')
    logger.debug(f"Received request to create branch {branch_name} from {base_branch}")
    success, result = settings_manager.create_branch(branch_name, base_branch)
    if success:
        logger.debug(f"Successfully created branch: {branch_name}")
        return jsonify({'success': True, **result}), 200
    else:
        logger.error(f"Failed to create branch: {result}")
        return jsonify({'success': False, 'error': result}), 400
    
@bp.route('/branches', methods=['GET'])
def get_branches():
    logger.debug("Received request for branches")
    success, result = settings_manager.get_branches()
    if success:
        logger.debug("Successfully retrieved branches")
        return jsonify({'success': True, 'data': result}), 200
    else:
        logger.error(f"Failed to retrieve branches: {result}")
        return jsonify({'success': False, 'error': result}), 400

@bp.route('/checkout', methods=['POST'])
def checkout_branch():
    branch_name = request.json.get('branch')
    logger.debug(f"Received request to checkout branch: {branch_name}")
    success, result = settings_manager.checkout_branch(branch_name)
    if success:
        logger.debug(f"Successfully checked out branch: {branch_name}")
        return jsonify({'success': True, **result}), 200
    else:
        logger.error(f"Failed to checkout branch: {result}")
        return jsonify({'success': False, 'error': result}), 400

@bp.route('/branch/<branch_name>', methods=['DELETE'])
def delete_branch(branch_name):
    logger.debug(f"Received request to delete branch: {branch_name}")
    success, result = settings_manager.delete_branch(branch_name)
    if success:
        logger.debug(f"Successfully deleted branch: {branch_name}")
        return jsonify({'success': True, **result}), 200
    else:
        logger.error(f"Failed to delete branch: {result}")
        return jsonify({'success': False, 'error': result}), 400

@bp.route('/current-branch', methods=['GET'])
def get_current_branch():
    current_branch = settings_manager.get_current_branch()
    if current_branch:
        return jsonify({'success': True, 'current_branch': current_branch}), 200
    else:
        return jsonify({'success': False, 'error': 'Failed to get current branch'}), 400


@bp.route('/stage', methods=['POST'])
def stage_files():
    files = request.json.get('files', [])
    success, message = settings_manager.stage_files(files)
    if success:
        return jsonify({'success': True, 'message': message}), 200
    else:
        logger.error(f"Error staging files: {message}")
        return jsonify({'success': False, 'error': message}), 400


def generate_commit_message(user_message, files):
    file_changes = []
    for file in files:
        if 'regex_patterns' in file:
            file_changes.append(f"Update regex pattern: {file.split('/')[-1]}")
        elif 'custom_formats' in file:
            file_changes.append(f"Update custom format: {file.split('/')[-1]}")
        else:
            file_changes.append(f"Update: {file}")

    commit_message = f"{user_message}\n\nChanges:\n" + "\n".join(file_changes)
    return commit_message

@bp.route('/push', methods=['POST'])
def push_files():
    files = request.json.get('files', [])
    user_commit_message = request.json.get('commit_message', "Commit and push staged files")
    logger.debug(f"Received request to push files: {files}")
    commit_message = generate_commit_message(user_commit_message, files)
    success, message = settings_manager.push_files(files, commit_message)
    if success:
        logger.debug("Successfully committed and pushed files")
        return jsonify({'success': True, 'message': message}), 200
    else:
        logger.error(f"Error pushing files: {message}")
        return jsonify({'success': False, 'error': message}), 400

@bp.route('/revert', methods=['POST'])
def revert_file():
    file_path = request.json.get('file_path')
    if not file_path:
        return jsonify({'success': False, 'error': "File path is required."}), 400
    success, message = settings_manager.revert_file(file_path)
    if success:
        return jsonify({'success': True, 'message': message}), 200
    else:
        logger.error(f"Error reverting file: {message}")
        return jsonify({'success': False, 'error': message}), 400


@bp.route('/revert-all', methods=['POST'])
def revert_all():
    success, message = settings_manager.revert_all()
    if success:
        return jsonify({'success': True, 'message': message}), 200
    else:
        logger.error(f"Error reverting all changes: {message}")
        return jsonify({'success': False, 'error': message}), 400


@bp.route('/file', methods=['DELETE'])
def delete_file():
    file_path = request.json.get('file_path')
    if not file_path:
        return jsonify({'success': False, 'error': "File path is required."}), 400
    success, message = settings_manager.delete_file(file_path)
    if success:
        return jsonify({'success': True, 'message': message}), 200
    else:
        logger.error(f"Error deleting file: {message}")
        return jsonify({'success': False, 'error': message}), 400
    
@bp.route('/pull', methods=['POST'])
def pull_branch():
    branch_name = request.json.get('branch')
    success, message = settings_manager.pull_branch(branch_name)
    if success:
        return jsonify({'success': True, 'message': message}), 200
    else:
        logger.error(f"Error pulling branch: {message}")
        return jsonify({'success': False, 'error': message}), 400

@bp.route('/diff', methods=['POST'])
def diff_file():
    file_path = request.json.get('file_path')
    try:
        diff = get_diff(settings_manager.repo_path, file_path)
        logger.debug(f"Diff for file {file_path}: {diff}")
        return jsonify({'success': True, 'diff': diff if diff else ""}), 200
    except Exception as e:
        logger.error(f"Error getting diff for file {file_path}: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': f"Error getting diff for file: {str(e)}"}), 400
