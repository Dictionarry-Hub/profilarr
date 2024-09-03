# git/branches/delete.py

import git
from git.exc import GitCommandError
import logging

logger = logging.getLogger(__name__)

def delete_branch(repo_path, branch_name):
    try:
        logger.debug(f"Attempting to delete branch: {branch_name}")
        repo = git.Repo(repo_path)

        # Check if the branch exists
        if branch_name not in repo.heads:
            return False, f"Branch '{branch_name}' does not exist."

        # Check if it's the current branch
        if repo.active_branch.name == branch_name:
            return False, f"Cannot delete the current branch: {branch_name}"

        # Delete the branch locally
        repo.delete_head(branch_name, force=True)

        # Delete the branch remotely
        try:
            repo.git.push('origin', '--delete', branch_name)
        except GitCommandError:
            logger.warning(f"Failed to delete remote branch: {branch_name}. It may not exist on remote.")

        logger.debug(f"Successfully deleted branch: {branch_name}")
        return True, {"message": f"Deleted branch: {branch_name}", "current_branch": repo.active_branch.name}
    except Exception as e:
        logger.error(f"Error deleting branch: {str(e)}", exc_info=True)
        return False, {"error": f"Error deleting branch: {str(e)}"}