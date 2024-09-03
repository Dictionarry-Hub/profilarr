import os
import shutil
from flask import Blueprint, jsonify
import logging

logger = logging.getLogger(__name__)

repo_bp = Blueprint('repository', __name__, url_prefix='/repository')

def unlink_repository(settings_manager):
    try:
        # Remove the .git folder
        git_folder = os.path.join(settings_manager.repo_path, '.git')
        if os.path.exists(git_folder):
            shutil.rmtree(git_folder)
            logger.info(f"Removed .git folder from {settings_manager.repo_path}")

        # Update settings
        settings_manager.settings.pop('gitRepo', None)
        settings_manager.settings.pop('gitToken', None)
        settings_manager.save_settings(settings_manager.settings)
        logger.info("Updated settings to remove git information")

        return True, "Repository successfully unlinked"
    except Exception as e:
        logger.error(f"Error unlinking repository: {str(e)}", exc_info=True)
        return False, f"Error unlinking repository: {str(e)}"

@repo_bp.route('/unlink', methods=['POST'])
def unlink_repo():
    success, message = unlink_repository(repo_bp.settings_manager)
    if success:
        return jsonify({'success': True, 'message': message}), 200
    else:
        return jsonify({'success': False, 'error': message}), 400