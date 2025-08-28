# git/repo/unlink.py
import os
import shutil
import logging
from ...db import save_settings
from ...arr.manager import check_active_sync_configs

logger = logging.getLogger(__name__)


def unlink_repository(repo_path, remove_files=False):
    try:
        # Check for active sync configurations first
        has_active_configs, configs = check_active_sync_configs()
        if has_active_configs:
            error_msg = (
                "Cannot unlink repository while automatic sync configurations are active.\n"
                "The following configurations must be set to manual sync first:\n"
            )
            for config in configs:
                error_msg += f"- {config['name']} (ID: {config['id']}, {config['sync_method']} sync)\n"

            logger.error(error_msg)
            return False, {
                "error": error_msg,
                "code": "ACTIVE_SYNC_CONFIGS",
                "configs": configs
            }

        logger.info(
            f"Starting unlink_repository with repo_path: {repo_path} and remove_files: {remove_files}"
        )

        # Check if repo_path exists
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
            logger.info(
                f"Successfully removed all files in the repository at {repo_path}"
            )

            # Recreate necessary folders
            required_dirs = ['custom_formats', 'profiles', 'regex_patterns']
            for dir_name in required_dirs:
                os.makedirs(os.path.join(repo_path, dir_name), exist_ok=True)
                logger.info(
                    f"Recreated the directory {dir_name} at {repo_path}")
        else:
            git_folder = os.path.join(repo_path, '.git')
            if os.path.exists(git_folder):
                logger.info(f"Removing .git folder at {git_folder}")
                shutil.rmtree(git_folder)
                logger.info(
                    f"Successfully removed .git folder at {git_folder}")
            else:
                logger.warning(f".git folder does not exist at {git_folder}")

        # Clear git settings
        save_settings({'gitRepo': None})
        logger.info("Updated settings to remove git information")

        # Reload cache if files were removed
        if remove_files:
            from ...data.cache import data_cache
            logger.info("Reloading data cache after removing repository files")
            data_cache.initialize(force_reload=True)

        return True, "Repository successfully unlinked"
    except Exception as e:
        logger.error(f"Error unlinking repository: {str(e)}", exc_info=True)
        return False, f"Error unlinking repository: {str(e)}"
