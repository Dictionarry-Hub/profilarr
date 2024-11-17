# git/operations/unstage.py
import git
import logging

logger = logging.getLogger(__name__)


def unstage_files(repo_path, files):
    try:
        repo = git.Repo(repo_path)
        repo.index.reset(files=files)
        return True, "Successfully unstaged files."
    except Exception as e:
        logger.error(f"Error unstaging files: {str(e)}", exc_info=True)
        return False, f"Error unstaging files: {str(e)}"
