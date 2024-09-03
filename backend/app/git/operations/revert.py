# git/operations/revert.py

import git
import logging

logger = logging.getLogger(__name__)

def revert_file(repo_path, file_path):
    try:
        repo = git.Repo(repo_path)
        staged_deletions = repo.index.diff("HEAD", R=True)
        is_staged_for_deletion = any(d.a_path == file_path for d in staged_deletions)

        if is_staged_for_deletion:
            repo.git.reset("--", file_path)
            repo.git.checkout('HEAD', "--", file_path)
            message = f"File {file_path} has been restored and unstaged from deletion."
        else:
            repo.git.restore("--", file_path)
            repo.git.restore('--staged', "--", file_path)
            message = f"File {file_path} has been reverted."

        return True, message
    except Exception as e:
        logger.error(f"Error reverting file: {str(e)}", exc_info=True)
        return False, f"Error reverting file: {str(e)}"

def revert_all(repo_path):
    try:
        repo = git.Repo(repo_path)
        repo.git.restore('--staged', '.')
        repo.git.restore('.')
        return True, "All changes have been reverted to the last commit."
    except Exception as e:
        logger.error(f"Error reverting all changes: {str(e)}", exc_info=True)
        return False, f"Error reverting all changes: {str(e)}"