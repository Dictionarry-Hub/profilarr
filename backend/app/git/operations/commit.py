# git/operations/commit.py

import git
import logging

logger = logging.getLogger(__name__)

def commit_changes(repo_path, files, message):
    try:
        repo = git.Repo(repo_path)
        repo.index.add(files)
        repo.index.commit(message)
        return True, "Successfully committed changes."
    except Exception as e:
        logger.error(f"Error committing changes: {str(e)}", exc_info=True)
        return False, f"Error committing changes: {str(e)}"