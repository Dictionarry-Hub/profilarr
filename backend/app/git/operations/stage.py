# git/operations/stage.py
import git
import os
import logging

logger = logging.getLogger(__name__)


def stage_files(repo_path, files):
    """
    Stage files in git repository, properly handling both existing and deleted files.
    
    Args:
        repo_path: Path to git repository
        files: List of files to stage, or None/empty list to stage all changes
        
    Returns:
        tuple: (success: bool, message: str)
    """
    try:
        repo = git.Repo(repo_path)

        # Stage all changes if no specific files provided
        if not files:
            repo.git.add(A=True)
            return True, "All changes have been staged."

        # Handle specific files
        existing_files = []
        deleted_files = []

        # Separate existing and deleted files
        for file_path in files:
            full_path = os.path.join(repo_path, file_path)
            if os.path.exists(full_path):
                existing_files.append(file_path)
            else:
                # Check if file is tracked but deleted
                try:
                    repo.git.ls_files(file_path, error_unmatch=True)
                    deleted_files.append(file_path)
                except git.exc.GitCommandError:
                    logger.warning(f"Untracked file not found: {file_path}")
                    continue

        # Stage existing files
        if existing_files:
            repo.index.add(existing_files)

        # Stage deleted files
        if deleted_files:
            repo.index.remove(deleted_files, working_tree=True)

        message_parts = []
        if existing_files:
            message_parts.append(
                f"{len(existing_files)} existing files staged")
        if deleted_files:
            message_parts.append(f"{len(deleted_files)} deleted files staged")

        message = " and ".join(
            message_parts) if message_parts else "No files staged"
        return True, message

    except git.exc.GitCommandError as e:
        logger.error(f"Git command error staging files: {str(e)}",
                     exc_info=True)
        return False, f"Error staging files: {str(e)}"
    except Exception as e:
        logger.error(f"Error staging files: {str(e)}", exc_info=True)
        return False, f"Error staging files: {str(e)}"
