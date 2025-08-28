# git/operations/merge.py
import git
import logging
import os
from typing import Dict, Any
from ..status.status import GitStatusManager

logger = logging.getLogger(__name__)


def finalize_merge(repo) -> Dict[str, Any]:
    """
    Finalize a merge by committing all staged files after conflict resolution.
    """
    try:
        if not os.path.exists(os.path.join(repo.git_dir, 'MERGE_HEAD')):
            return {
                'success': False,
                'error': 'Not currently in a merge state'
            }

        # Get unmerged files
        unmerged_files = []
        status = repo.git.status('--porcelain', '-z').split('\0')
        for item in status:
            if item and len(item) >= 4:
                x, y, file_path = item[0], item[1], item[3:]
                if 'U' in (x, y):
                    unmerged_files.append(file_path)

        # Force update the index for unmerged files
        for file_path in unmerged_files:
            # Remove from index first
            try:
                repo.git.execute(['git', 'reset', '--', file_path])
            except git.GitCommandError:
                pass

            # Add back to index
            try:
                repo.git.execute(['git', 'add', '--', file_path])
            except git.GitCommandError as e:
                logger.error(f"Error adding file {file_path}: {str(e)}")
                return {
                    'success': False,
                    'error': f"Failed to stage resolved file {file_path}"
                }

        # Create commit message
        commit_message = "Merge complete: resolved conflicts"

        # Commit
        try:
            repo.git.commit('-m', commit_message)
            logger.info("Successfully finalized merge")

            # Update remote status after merge
            repo_path = repo.working_dir
            status_manager = GitStatusManager.get_instance(repo_path)
            if status_manager:
                status_manager.update_remote_status()

            # Reload cache for modified data files
            from ...data.cache import data_cache
            logger.info("Reloading data cache after merge completion")
            data_cache.initialize(force_reload=True)  # This will reload all data

            return {'success': True, 'message': 'Merge completed successfully'}
        except git.GitCommandError as e:
            logger.error(f"Git command error during commit: {str(e)}")
            return {
                'success': False,
                'error': f"Failed to commit merge: {str(e)}"
            }

    except Exception as e:
        logger.error(f"Failed to finalize merge: {str(e)}")
        return {
            'success': False,
            'error': f"Failed to finalize merge: {str(e)}"
        }


def abort_merge(repo_path):
    try:
        repo = git.Repo(repo_path)

        # Try aborting the merge using git merge --abort
        try:
            repo.git.execute(['git', 'merge', '--abort'])
            return True, "Merge aborted successfully"
        except git.GitCommandError as e:
            logger.warning(
                "Error aborting merge with 'git merge --abort'. Trying 'git reset --hard'."
            )

        # If git merge --abort fails, try resetting to the previous commit using git reset --hard
        try:
            repo.git.execute(['git', 'reset', '--hard'])
            return True, "Merge aborted and repository reset to the previous commit"
        except git.GitCommandError as e:
            logger.exception(
                "Error resetting repository with 'git reset --hard'")
            return False, str(e)

    except Exception as e:
        logger.exception("Unexpected error aborting merge")
        return False, str(e)
