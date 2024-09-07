# git/branches/delete.py

import git
from git.exc import GitCommandError
import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


def delete_branch(repo_path, branch_name):
    try:
        logger.debug(f"Attempting to delete branch: {branch_name}")
        logger.debug(
            f"Attempting to delete branch from repo at path: {repo_path}")
        repo = git.Repo(repo_path)

        # Fetch updates from remote
        logger.debug("Fetching updates from remote...")
        repo.git.fetch('--all')

        # Update local repository state
        logger.debug("Updating local repository state...")
        repo.git.remote('update', 'origin', '--prune')

        # Check if it's a local branch
        if branch_name in repo.heads:
            logger.debug(f"Deleting local branch: {branch_name}")
            if repo.active_branch.name == branch_name:
                return False, f"Cannot delete the current branch: {branch_name}"
            repo.delete_head(branch_name, force=True)
            logger.debug(f"Local branch {branch_name} deleted")

        # Check if remote branch exists
        remote_branch = f"origin/{branch_name}"
        if remote_branch in repo.refs:
            logger.debug(f"Attempting to delete remote branch: {branch_name}")
            try:
                repo.git.push('origin', '--delete', branch_name)
                logger.debug(
                    f"Successfully deleted remote branch: {branch_name}")
            except GitCommandError as e:
                logger.error(
                    f"Failed to delete remote branch: {branch_name}. Error: {str(e)}"
                )
                return False, f"Failed to delete remote branch: {branch_name}. There might be permission issues."

        return True, {
            "message": f"Deleted branch: {branch_name}",
            "current_branch": repo.active_branch.name
        }

    except Exception as e:
        logger.error(f"Error deleting branch: {str(e)}", exc_info=True)
        return False, {"error": f"Error deleting branch: {str(e)}"}
