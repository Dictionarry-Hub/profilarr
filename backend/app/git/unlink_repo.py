import os
import shutil
from flask import Blueprint, jsonify
import logging

# Import settings utilities
from ..settings_utils import save_settings, load_settings

logger = logging.getLogger(__name__)

def unlink_repository(repo_path):
    try:
        # Load current settings
        settings = load_settings()
        if not settings:
            return False, "Settings file not found or could not be loaded"

        # Remove the .git folder
        git_folder = os.path.join(repo_path, '.git')
        if os.path.exists(git_folder):
            shutil.rmtree(git_folder)
            logger.info(f"Removed .git folder from {repo_path}")

        # Update settings
        settings.pop('gitRepo', None)
        settings.pop('gitToken', None)
        save_settings(settings)
        logger.info("Updated settings to remove git information")

        return True, "Repository successfully unlinked"
    except Exception as e:
        logger.error(f"Error unlinking repository: {str(e)}", exc_info=True)
        return False, f"Error unlinking repository: {str(e)}"
