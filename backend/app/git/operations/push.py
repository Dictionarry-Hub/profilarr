# git/operations/push.py
import git
import logging
from ..auth.authenticate import check_dev_mode, get_github_token

logger = logging.getLogger(__name__)


def push_changes(repo_path):
    try:
        # Check if we're in dev mode - keep this check for push operations
        if not check_dev_mode():
            logger.warning("Not in dev mode. Push operation not allowed.")
            return False, "Push operation not allowed in production mode."

        # Get the GitHub token
        github_token = get_github_token()
        if not github_token:
            logger.error("GitHub token not available")
            return False, "GitHub token not available"

        repo = git.Repo(repo_path)
        origin = repo.remote(name='origin')
        auth_repo_url = origin.url.replace('https://',
                                           f'https://{github_token}@')
        origin.set_url(auth_repo_url)

        try:
            # Push changes
            push_info = origin.push()
            if push_info and push_info[0].flags & push_info[0].ERROR:
                raise git.GitCommandError("git push", push_info[0].summary)
            return True, "Successfully pushed changes."
        except git.GitCommandError as e:
            error_msg = str(e)
            if "non-fast-forward" in error_msg:
                return False, {
                    "type":
                    "non_fast_forward",
                    "message":
                    "Push rejected: Remote contains work that you do not have locally. Please pull the latest changes first."
                }
            raise e
        finally:
            # Always restore the original URL (without token)
            origin.set_url(
                origin.url.replace(f'https://{github_token}@', 'https://'))

    except git.GitCommandError as e:
        logger.error(f"Git command error pushing changes: {str(e)}",
                     exc_info=True)
        return False, str(e)
    except Exception as e:
        logger.error(f"Error pushing changes: {str(e)}", exc_info=True)
        return False, f"Error pushing changes: {str(e)}"
