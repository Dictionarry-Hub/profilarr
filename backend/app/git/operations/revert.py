# git/operations/revert.py

import git
import os
import logging

logger = logging.getLogger(__name__)


def revert_file(repo_path, file_path):
    """
    Revert changes in a file, handling tracked files, staged deletions, and new files.
    
    Args:
        repo_path: Path to the git repository
        file_path: Path to the file to revert

    Returns:
        tuple: (success: bool, message: str)
    """
    try:
        repo = git.Repo(repo_path)
        file_absolute_path = os.path.join(repo_path, file_path)

        # Check if file is untracked (new)
        untracked_files = repo.untracked_files
        is_untracked = any(f == file_path for f in untracked_files)

        if is_untracked:
            # For untracked files, we need to remove them
            try:
                os.remove(file_absolute_path)
                message = f"New file {file_path} has been removed."
            except FileNotFoundError:
                message = f"File {file_path} was already removed."
            return True, message

        # Check if file is staged for deletion
        staged_deletions = repo.index.diff("HEAD", R=True)
        is_staged_for_deletion = any(d.a_path == file_path
                                     for d in staged_deletions)

        if is_staged_for_deletion:
            # Restore file staged for deletion
            repo.git.reset("--", file_path)
            repo.git.checkout('HEAD', "--", file_path)
            message = f"File {file_path} has been restored and unstaged from deletion."
        else:
            # Regular revert for tracked files with changes
            repo.git.restore("--", file_path)
            repo.git.restore('--staged', "--", file_path)
            message = f"File {file_path} has been reverted."

        # Reload cache after revert
        from ...data.cache import data_cache
        data_cache.initialize(force_reload=True)

        return True, message

    except git.exc.GitCommandError as e:
        error_msg = str(e)
        if "pathspec" in error_msg and "did not match any file(s) known to git" in error_msg:
            logger.error(f"File {file_path} not found in git repository")
            return False, f"File {file_path} not found in git repository"
        logger.error(f"Git error reverting file: {error_msg}", exc_info=True)
        return False, f"Git error reverting file: {error_msg}"
    except Exception as e:
        logger.error(f"Error reverting file: {str(e)}", exc_info=True)
        return False, f"Error reverting file: {str(e)}"


def revert_all(repo_path):
    """
    Revert all changes in the repository, including new files.
    
    Args:
        repo_path: Path to the git repository

    Returns:
        tuple: (success: bool, message: str)
    """
    try:
        repo = git.Repo(repo_path)

        # First, clean untracked files
        untracked_files = repo.untracked_files
        for file_path in untracked_files:
            try:
                os.remove(os.path.join(repo_path, file_path))
            except FileNotFoundError:
                continue
            except Exception as e:
                logger.warning(
                    f"Could not remove untracked file {file_path}: {str(e)}")

        # Then restore tracked files
        repo.git.restore('--staged', '.')
        repo.git.restore('.')

        message = "All changes have been reverted to the last commit"
        if untracked_files:
            message += f" and {len(untracked_files)} new file(s) have been removed"
        message += "."

        # Reload cache after reverting all
        from ...data.cache import data_cache
        data_cache.initialize(force_reload=True)

        return True, message

    except git.exc.GitCommandError as e:
        logger.error(f"Git error reverting all changes: {str(e)}",
                     exc_info=True)
        return False, f"Git error reverting all changes: {str(e)}"
    except Exception as e:
        logger.error(f"Error reverting all changes: {str(e)}", exc_info=True)
        return False, f"Error reverting all changes: {str(e)}"
