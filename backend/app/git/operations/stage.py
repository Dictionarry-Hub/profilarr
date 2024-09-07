# git/operations/stage.py

import git
import logging
from ..auth.authenticate import check_dev_mode, get_github_token

logger = logging.getLogger(__name__)


def stage_files(repo_path, files):
    try:
        # Check if we're in dev mode
        if not check_dev_mode():
            logger.warning("Not in dev mode. Staging operation not allowed.")
            return False, "Staging operation not allowed in production mode."

        # Get the GitHub token
        github_token = get_github_token()
        if not github_token:
            logger.error("GitHub token not available")
            return False, "GitHub token not available"

        repo = git.Repo(repo_path)

        # Authenticate with GitHub token
        with repo.git.custom_environment(GIT_ASKPASS='echo',
                                         GIT_USERNAME=github_token):
            if not files:
                repo.git.add(A=True)
                message = "All changes have been staged."
            else:
                repo.index.add(files)
                message = "Specified files have been staged."

        return True, message

    except git.GitCommandError as e:
        logger.error(f"Git command error staging files: {str(e)}",
                     exc_info=True)
        return False, f"Error staging files: {str(e)}"

    except Exception as e:
        logger.error(f"Error staging files: {str(e)}", exc_info=True)
        return False, f"Error staging files: {str(e)}"
