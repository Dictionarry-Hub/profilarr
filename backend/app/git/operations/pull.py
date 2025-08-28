# git/operations/pull.py

import git
import logging
from git import GitCommandError
from ..status.status import GitStatusManager
from ...arr.manager import get_pull_configs
from ...importer import handle_pull_import

logger = logging.getLogger(__name__)


def pull_branch(repo_path, branch_name):
    try:
        repo = git.Repo(repo_path)

        # Check for uncommitted changes first
        if repo.is_dirty(untracked_files=True):
            return False, {
                'type': 'uncommitted_changes',
                'message':
                'Cannot pull: You have uncommitted local changes that would be lost',
                'details': 'Please commit or stash your changes before pulling'
            }

        # Fetch first to get remote changes
        repo.remotes.origin.fetch()

        try:
            # Pull with explicit merge strategy
            repo.git.pull('origin', branch_name, '--no-rebase')

            # Update remote status
            status_manager = GitStatusManager.get_instance(repo_path)
            if status_manager:
                status_manager.update_remote_status()

            # Reload cache for updated data files
            from ...data.cache import data_cache
            logger.info("Reloading data cache after pull")
            data_cache.initialize(force_reload=True)  # This will reload all data

            # -------------------------------
            # *** "On pull" ARR import logic using new importer:
            # 1) Query all ARR configs that have sync_method="pull"
            # 2) For each, run the importer pull handler
            # -------------------------------
            pull_configs = get_pull_configs()
            logger.info(
                f"[Pull] Found {len(pull_configs)} ARR configs to import (sync_method='pull')"
            )
            for cfg in pull_configs:
                handle_pull_import(cfg['id'])

            return True, f"Successfully pulled changes for branch {branch_name}"

        except GitCommandError as e:
            if "CONFLICT" in str(e):
                return True, {
                    'state': 'resolve',
                    'type': 'merge_conflict',
                    'message':
                    'Repository is now in conflict resolution state. Please resolve conflicts to continue merge.',
                    'details': 'Please resolve conflicts to continue merge'
                }
            raise e

    except Exception as e:
        logger.error(f"Error pulling branch: {str(e)}", exc_info=True)
        return False, f"Error pulling branch: {str(e)}"
