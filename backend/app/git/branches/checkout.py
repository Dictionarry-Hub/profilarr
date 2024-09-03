# git/branches/checkout.py

import git
import logging

logger = logging.getLogger(__name__)

def checkout_branch(repo_path, branch_name):
    try:
        logger.debug(f"Attempting to checkout branch: {branch_name}")
        repo = git.Repo(repo_path)

        # Check if the branch exists
        if branch_name not in repo.heads:
            return False, f"Branch '{branch_name}' does not exist."

        # Checkout the branch
        repo.git.checkout(branch_name)

        logger.debug(f"Successfully checked out branch: {branch_name}")
        return True, {"message": f"Checked out branch: {branch_name}", "current_branch": branch_name}
    except Exception as e:
        logger.error(f"Error checking out branch: {str(e)}", exc_info=True)
        return False, {"error": f"Error checking out branch: {str(e)}"}