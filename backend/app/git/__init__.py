from flask import Blueprint, request, jsonify
from .status.status import get_git_status
from .status.diff import get_diff
from .branches.branches import Branch_Manager
from .operations.operations import GitOperations
from .unlink_repo import unlink_repository
import logging

logger = logging.getLogger(__name__)

bp = Blueprint('git', __name__, url_prefix='/git')

# Assume these are set up elsewhere, perhaps in a config file
REPO_PATH = '/app/data/db'
branch_manager = Branch_Manager(REPO_PATH)
git_operations = GitOperations(REPO_PATH)

@bp.route('/status', methods=['GET'])
def get_status():
    logger.debug("Received request for git status")
    success, message = get_git_status(REPO_PATH)
    if success:
        logger.debug("Successfully retrieved git status")
        return jsonify({'success': True, 'data': message}), 200
    else:
        logger.error(f"Failed to retrieve git status: {message}")
        return jsonify({'success': False, 'error': message}), 400

@bp.route('/branch', methods=['POST'])
def create_branch():
    branch_name = request.json.get('name')
    base_branch = request.json.get('base', 'main')
    logger.debug(f"Received request to create branch {branch_name} from {base_branch}")
    success, result = branch_manager.create(branch_name, base_branch)
    if success:
        logger.debug(f"Successfully created branch: {branch_name}")
        return jsonify({'success': True, **result}), 200
    else:
        logger.error(f"Failed to create branch: {result}")
        return jsonify({'success': False, 'error': result}), 400

@bp.route('/branches', methods=['GET'])
def get_branches():
    logger.debug("Received request for branches")
    success, result = branch_manager.get_all()
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
    success, result = branch_manager.checkout(branch_name)
    if success:
        logger.debug(f"Successfully checked out branch: {branch_name}")
        return jsonify({'success': True, **result}), 200
    else:
        logger.error(f"Failed to checkout branch: {result}")
        return jsonify({'success': False, 'error': result}), 400

@bp.route('/branch/<branch_name>', methods=['DELETE'])
def delete_branch(branch_name):
    logger.debug(f"Received request to delete branch: {branch_name}")
    success, result = branch_manager.delete(branch_name)
    if success:
        logger.debug(f"Successfully deleted branch: {branch_name}")
        return jsonify({'success': True, **result}), 200
    else:
        logger.error(f"Failed to delete branch: {result}")
        return jsonify({'success': False, 'error': result}), 400

@bp.route('/push', methods=['POST'])
def push_files():
    files = request.json.get('files', [])
    user_commit_message = request.json.get('commit_message', "Commit and push staged files")
    logger.debug(f"Received request to push files: {files}")
    commit_message = generate_commit_message(user_commit_message, files)
    success, message = git_operations.push(files, commit_message)
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
    success, message = git_operations.revert(file_path)
    if success:
        return jsonify({'success': True, 'message': message}), 200
    else:
        logger.error(f"Error reverting file: {message}")
        return jsonify({'success': False, 'error': message}), 400

@bp.route('/revert-all', methods=['POST'])
def revert_all():
    success, message = git_operations.revert_all()
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
    success, message = git_operations.delete(file_path)
    if success:
        return jsonify({'success': True, 'message': message}), 200
    else:
        logger.error(f"Error deleting file: {message}")
        return jsonify({'success': False, 'error': message}), 400

@bp.route('/pull', methods=['POST'])
def pull_branch():
    branch_name = request.json.get('branch')
    success, message = git_operations.pull(branch_name)
    if success:
        return jsonify({'success': True, 'message': message}), 200
    else:
        logger.error(f"Error pulling branch: {message}")
        return jsonify({'success': False, 'error': message}), 400

@bp.route('/diff', methods=['POST'])
def diff_file():
    file_path = request.json.get('file_path')
    try:
        diff = get_diff(REPO_PATH, file_path)
        logger.debug(f"Diff for file {file_path}: {diff}")
        return jsonify({'success': True, 'diff': diff if diff else ""}), 200
    except Exception as e:
        logger.error(f"Error getting diff for file {file_path}: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': f"Error getting diff for file: {str(e)}"}), 400

@bp.route('/stage', methods=['POST'])
def handle_stage_files():
    files = request.json.get('files', [])
    success, message = git_operations.stage(files)
    if success:
        return jsonify({'success': True, 'message': message}), 200
    else:
        return jsonify({'success': False, 'error': message}), 400

@bp.route('/unlink', methods=['POST'])
def unlink_repo():
    success, message = unlink_repository(REPO_PATH)
    if success:
        return jsonify({'success': True, 'message': message}), 200
    else:
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