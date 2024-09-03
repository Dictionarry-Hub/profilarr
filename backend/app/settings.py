import os
import yaml
import git
from flask import Blueprint, request, jsonify
import logging
from .git.clone_repo import clone_repository
from .git.authenticate import validate_git_token
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

    def clone_repository(self):
        return clone_repository(self.repo_url, self.repo_path, self.settings["gitToken"])

        
settings_manager = SettingsManager()

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