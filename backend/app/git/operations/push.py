# git/operations/push.py

import git
import logging
from .commit import commit_changes

logger = logging.getLogger(__name__)

def push_changes(repo_path, files, message):
    try:
        repo = git.Repo(repo_path)
        commit_changes(repo_path, files, message)
        origin = repo.remote(name='origin')
        origin.push()
        return True, "Successfully pushed changes."
    except Exception as e:
        logger.error(f"Error pushing changes: {str(e)}", exc_info=True)
        return False, f"Error pushing changes: {str(e)}"