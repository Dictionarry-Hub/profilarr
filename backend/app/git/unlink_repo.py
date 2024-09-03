import os
import shutil
from flask import Blueprint, jsonify, request
import logging

# Import settings utilities
from ..settings_utils import save_settings, load_settings

logger = logging.getLogger(__name__)

def unlink_repository(repo_path, remove_files=False):
    try:
        # Load current settings
        settings = load_settings()
        if not settings:
            logger.error("Settings file not found or could not be loaded")
            return False, "Settings file not found or could not be loaded"

        logger.info(f"Starting unlink_repository with repo_path: {repo_path} and remove_files: {remove_files}")

        # Check if repo_path exists and log it
        if not os.path.exists(repo_path):
            logger.error(f"Path {repo_path} does not exist.")
            return False, f"Path {repo_path} does not exist."

        # Remove the .git folder and optionally the repo files
        if remove_files:
            logger.info(f"Removing all files in the repository at {repo_path}")
            for root, dirs, files in os.walk(repo_path):
                for file in files:
                    os.remove(os.path.join(root, file))
                for dir in dirs:
                    shutil.rmtree(os.path.join(root, dir))
            logger.info(f"Successfully removed all files in the repository at {repo_path}")

            # Recreate necessary folders
            required_dirs = ['custom_formats', 'profiles', 'regex_patterns']  # Add your required subdirectories here
            for dir_name in required_dirs:
                os.makedirs(os.path.join(repo_path, dir_name), exist_ok=True)
                logger.info(f"Recreated the directory {dir_name} at {repo_path}")
        else:
            git_folder = os.path.join(repo_path, '.git')
            if os.path.exists(git_folder):
                logger.info(f"Removing .git folder at {git_folder}")
                shutil.rmtree(git_folder)
                logger.info(f"Successfully removed .git folder at {git_folder}")
            else:
                logger.warning(f".git folder does not exist at {git_folder}")

        # Update settings
        settings.pop('gitRepo', None)
        settings.pop('gitToken', None)
        save_settings(settings)
        logger.info("Updated settings to remove git information")

        return True, "Repository successfully unlinked"
    except Exception as e:
        logger.error(f"Error unlinking repository: {str(e)}", exc_info=True)
        return False, f"Error unlinking repository: {str(e)}"
