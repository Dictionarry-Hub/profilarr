from flask import Blueprint, request, jsonify
from .status.status import get_git_status
from .status.diff import get_diff
from .branches.manager import Branch_Manager
from .operations.manager import GitOperations
from .repo.unlink import unlink_repository
from .repo.clone import clone_repository
from .auth.authenticate import check_dev_mode
from ..settings_utils import save_settings
import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

bp = Blueprint('git', __name__, url_prefix='/git')

REPO_PATH = '/app/data/db'
branch_manager = Branch_Manager(REPO_PATH)
git_operations = GitOperations(REPO_PATH)


@bp.route('/clone', methods=['POST'])
def handle_clone_repository():
    try:
        new_settings = request.json
        logger.info(f"Received new settings: {new_settings}")

        # Validate required fields
        if 'gitRepo' not in new_settings:
            logger.error("Missing required field: gitRepo")
            return jsonify({"error": "Missing required field: gitRepo"}), 400

        # Attempt to clone the repository
        success, message = clone_repository(new_settings['gitRepo'], REPO_PATH)

        if success:
            # Only save the repository URL if the clone was successful
            save_settings({'gitRepo': new_settings['gitRepo']})
            logger.info("Settings updated and repository cloned successfully")
            return jsonify({
                "message":
                "Repository cloned and settings updated successfully"
            }), 200
        else:
            logger.error(f"Failed to clone repository: {message}")
            return jsonify({"error": message}), 400

    except Exception as e:
        logger.exception("Unexpected error in clone_repository")
        return jsonify({"error": f"Failed to clone repository: {str(e)}"}), 500


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
    logger.debug(
        f"Received request to create branch {branch_name} from {base_branch}")
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


@bp.route('/branch/push', methods=['POST'])
def push_branch():
    data = request.json
    logger.debug(f"Received request to push branch: {data}")
    branch_name = data.get('branch')
    if not branch_name:
        return jsonify({
            "success": False,
            "error": "Branch name is required"
        }), 400

    success, result = branch_manager.push(branch_name)
    if success:
        return jsonify({"success": True, "data": result}), 200
    else:
        return jsonify({"success": False, "error": result["error"]}), 500


@bp.route('/push', methods=['POST'])
def push_files():
    files = request.json.get('files', [])
    user_commit_message = request.json.get('commit_message',
                                           "Commit and push staged files")
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
        return jsonify({
            'success': False,
            'error': "File path is required."
        }), 400
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
        return jsonify({
            'success': False,
            'error': "File path is required."
        }), 400
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
        logger.error(f"Error getting diff for file {file_path}: {str(e)}",
                     exc_info=True)
        return jsonify({
            'success': False,
            'error': f"Error getting diff for file: {str(e)}"
        }), 400


@bp.route('/stage', methods=['POST'])
def handle_stage_files():
    files = request.json.get('files', [])
    success, message = git_operations.stage(files)
    if success:
        return jsonify({'success': True, 'message': message}), 200
    else:
        return jsonify({'success': False, 'error': message}), 400


@bp.route('/unlink', methods=['POST'])
def unlink():
    data = request.get_json()
    remove_files = data.get('removeFiles', False)
    success, message = unlink_repository(REPO_PATH, remove_files)
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


@bp.route('/dev', methods=['GET'])
def dev_mode():
    is_dev_mode = check_dev_mode()
    return jsonify({'devMode': is_dev_mode}), 200
