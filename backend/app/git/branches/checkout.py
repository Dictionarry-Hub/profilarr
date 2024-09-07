# git/branches/checkout.py

import git
import logging

logger = logging.getLogger(__name__)


def checkout_branch(repo_path, branch_name):
    try:
        logger.debug(f"Attempting to checkout branch: {branch_name}")
        repo = git.Repo(repo_path)

        # Check if the branch exists locally
        if branch_name in repo.heads:
            repo.git.checkout(branch_name)
        else:
            # Check if the branch exists in any of the remotes
            for remote in repo.remotes:
                remote_branch = f"{remote.name}/{branch_name}"
                if remote_branch in repo.refs:
                    # Create a new local branch tracking the remote branch
                    repo.git.checkout('-b', branch_name, remote_branch)
                    break
            else:
                return False, f"Branch '{branch_name}' does not exist locally or in any remote."

        logger.debug(f"Successfully checked out branch: {branch_name}")
        return True, {
            "message": f"Checked out branch: {branch_name}",
            "current_branch": branch_name
        }
    except Exception as e:
        logger.error(f"Error checking out branch: {str(e)}", exc_info=True)
        return False, {"error": f"Error checking out branch: {str(e)}"}
