from flask import Blueprint, request, jsonify
from .status.status import get_git_status
from .status.commit_history import get_git_commit_history
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
        if 'merging' in result.get('error', '').lower():
            return jsonify({'success': False, 'error': result}), 409
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
        if 'merging' in result.get('error', '').lower():
            return jsonify({'success': False, 'error': result}), 409
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
        if 'merging' in result.get('error', '').lower():
            return jsonify({'success': False, 'error': result}), 409
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
        if 'merging' in result.get('error', '').lower():
            return jsonify({'success': False, 'error': result}), 409
        return jsonify({'success': False, 'error': result["error"]}), 500


@bp.route('/commit', methods=['POST'])
def commit_files():
    files = request.json.get('files', [])
    user_commit_message = request.json.get('commit_message', "Commit changes")
    logger.debug(f"Received request to commit files: {files}")

    commit_message = generate_commit_message(user_commit_message, files)
    success, message = git_operations.commit(files, commit_message)

    if success:
        logger.debug("Successfully committed files")
        return jsonify({'success': True, 'message': message}), 200
    else:
        logger.error(f"Error committing files: {message}")
        return jsonify({'success': False, 'error': message}), 400


@bp.route('/push', methods=['POST'])
def push_files():
    logger.debug("Received request to push changes")
    success, message = git_operations.push()

    if success:
        logger.debug("Successfully pushed changes")
        return jsonify({'success': True, 'message': message}), 200
    else:
        logger.error(f"Error pushing changes: {message}")
        # If message is a dict, it's a structured error
        if isinstance(message, dict):
            return jsonify({'success': False, 'error': message}), 400
        # Otherwise it's a string error
        return jsonify({'success': False, 'error': str(message)}), 400


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
    success, response = git_operations.pull(branch_name)

    # Handle different response types
    if isinstance(response, dict):
        if response.get('state') == 'resolve':
            # Merge conflict is now a success case with state='resolve'
            return jsonify({
                'success': True,
                'state': 'resolve',
                'message': response['message'],
                'details': response['details']
            }), 200
        elif response.get('state') == 'error':
            # Handle error states
            return jsonify({
                'success': False,
                'state': 'error',
                'message': response['message'],
                'details': response.get('details', {})
            }), 409 if response.get('type') in [
                'merge_conflict', 'uncommitted_changes'
            ] else 400
        elif response.get('state') == 'complete':
            # Normal success case
            return jsonify({
                'success': True,
                'state': 'complete',
                'message': response['message'],
                'details': response.get('details', {})
            }), 200

    # Fallback for string responses or unexpected formats
    if success:
        return jsonify({
            'success': True,
            'state': 'complete',
            'message': response
        }), 200
    return jsonify({
        'success': False,
        'state': 'error',
        'message': str(response)
    }), 400


@bp.route('/stage', methods=['POST'])
def handle_stage_files():
    files = request.json.get('files', [])
    success, message = git_operations.stage(files)
    if success:
        return jsonify({'success': True, 'message': message}), 200
    else:
        return jsonify({'success': False, 'error': message}), 400


@bp.route('/unstage', methods=['POST'])
def handle_unstage_files():
    files = request.json.get('files', [])
    success, message = git_operations.unstage(files)
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
    return user_message


@bp.route('/dev', methods=['GET'])
def dev_mode():
    is_dev_mode = check_dev_mode()
    return jsonify({'devMode': is_dev_mode}), 200


@bp.route('/resolve', methods=['POST'])
def resolve_conflicts():
    logger.debug("Received request to resolve conflicts")
    resolutions = request.json.get('resolutions')

    if not resolutions:
        return jsonify({
            'success': False,
            'error': "Resolutions are required"
        }), 400

    result = git_operations.resolve(resolutions)

    if result.get('success'):
        logger.debug("Successfully resolved conflicts")
        return jsonify(result), 200
    else:
        logger.error(f"Error resolving conflicts: {result.get('error')}")
        return jsonify(result), 400


@bp.route('/merge/finalize', methods=['POST'])
def finalize_merge():
    """
    Route to finalize a merge after all conflicts have been resolved.
    Expected to be called only after all conflicts are resolved and changes are staged.
    """
    logger.debug("Received request to finalize merge")

    result = git_operations.finalize_merge()

    if result.get('success'):
        logger.debug(
            f"Successfully finalized merge with files: {result.get('committed_files', [])}"
        )
        return jsonify({
            'success': True,
            'message': result.get('message'),
            'committed_files': result.get('committed_files', [])
        }), 200
    else:
        logger.error(f"Error finalizing merge: {result.get('error')}")
        return jsonify({'success': False, 'error': result.get('error')}), 400


@bp.route('/merge/abort', methods=['POST'])
def abort_merge():
    logger.debug("Received request to abort merge")
    success, message = git_operations.abort_merge()
    if success:
        logger.debug("Successfully aborted merge")
        return jsonify({'success': True, 'message': message}), 200
    else:
        logger.error(f"Error aborting merge: {message}")
        return jsonify({'success': False, 'error': message}), 400


@bp.route('/commits', methods=['GET'])
def get_commit_history():
    logger.debug("Received request for commit history")
    branch = request.args.get('branch')  # Optional branch parameter
    success, result = get_git_commit_history(REPO_PATH, branch)

    if success:
        logger.debug("Successfully retrieved commit history")
        return jsonify({'success': True, 'data': result}), 200
    else:
        logger.error(f"Failed to retrieve commit history: {result}")
        return jsonify({'success': False, 'error': result}), 400
