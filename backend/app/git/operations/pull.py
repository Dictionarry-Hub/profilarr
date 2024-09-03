# git/operations/pull.py

import git
import logging

logger = logging.getLogger(__name__)

def pull_branch(repo_path, branch_name):
    try:
        repo = git.Repo(repo_path)
        repo.git.pull('origin', branch_name)
        return True, f"Successfully pulled changes for branch {branch_name}."
    except Exception as e:
        logger.error(f"Error pulling branch: {str(e)}", exc_info=True)
        return False, f"Error pulling branch: {str(e)}"