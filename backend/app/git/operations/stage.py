# git/operations/stage.py

import git
import logging

logger = logging.getLogger(__name__)

def stage_files(repo_path, files):
    try:
        repo = git.Repo(repo_path)
        if not files:
            repo.git.add(A=True)
            message = "All changes have been staged."
        else:
            repo.index.add(files)
            message = "Specified files have been staged."
        return True, message
    except Exception as e:
        logger.error(f"Error staging files: {str(e)}", exc_info=True)
        return False, f"Error staging files: {str(e)}"