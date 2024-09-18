# git/operations/push.py

import git
import logging
from .commit import commit_changes
from ..auth.authenticate import check_dev_mode, get_github_token

logger = logging.getLogger(__name__)


def push_changes(repo_path, files, message):
    try:
        # Check if we're in dev mode
        if not check_dev_mode():
            logger.warning("Not in dev mode. Push operation not allowed.")
            return False, "Push operation not allowed in production mode."

        # Get the GitHub token
        github_token = get_github_token()
        if not github_token:
            logger.error("GitHub token not available")
            return False, "GitHub token not available"

        repo = git.Repo(repo_path)

        # Commit changes
        commit_success, commit_message = commit_changes(
            repo_path, files, message)
        if not commit_success:
            return False, commit_message

        # Modify the remote URL to include the token
        origin = repo.remote(name='origin')
        auth_repo_url = origin.url.replace('https://',
                                           f'https://{github_token}@')
        origin.set_url(auth_repo_url)

        # Push changes
        push_info = origin.push()

        # Restore the original remote URL (without the token)
        origin.set_url(
            origin.url.replace(f'https://{github_token}@', 'https://'))

        # Check if the push was successful
        if push_info and push_info[0].flags & push_info[0].ERROR:
            raise git.GitCommandError("git push", push_info[0].summary)

        return True, "Successfully pushed changes."

    except git.GitCommandError as e:
        logger.error(f"Git command error pushing changes: {str(e)}",
                     exc_info=True)
        return False, f"Error pushing changes: {str(e)}"

    except Exception as e:
        logger.error(f"Error pushing changes: {str(e)}", exc_info=True)
        return False, f"Error pushing changes: {str(e)}"
