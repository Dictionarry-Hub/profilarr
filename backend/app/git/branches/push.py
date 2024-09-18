import git
import logging
import os
from git import RemoteProgress
from urllib.parse import urlparse, urlunparse
from ..auth.authenticate import get_github_token, check_dev_mode

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


class CredentialedRemoteProgress(RemoteProgress):

    def __init__(self, github_token):
        super().__init__()
        self.github_token = github_token

    def update(self, op_code, cur_count, max_count=None, message=''):
        if op_code & RemoteProgress.AUTHENTICATING:
            # This is where we would inject the GitHub token if needed
            pass


def push_branch_to_remote(repo_path, branch_name):
    try:
        logger.debug(f"Attempting to push branch {branch_name} to remote")

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

        # Check if the branch exists locally
        if branch_name not in repo.heads:
            return False, f"Branch '{branch_name}' does not exist locally."

        # Get the remote URL and inject the GitHub token
        origin = repo.remote(name='origin')
        url = list(urlparse(next(origin.urls)))
        if '@' not in url[1]:  # Only add the token if it's not already there
            url[1] = f"{github_token}@{url[1]}"  # Inject GitHub token into the URL
        auth_url = urlunparse(url)

        # Set the new URL with the GitHub token
        origin.set_url(auth_url)

        # Push the branch to remote and set the upstream branch
        progress = CredentialedRemoteProgress(github_token)
        origin.push(refspec=f"{branch_name}:{branch_name}",
                    set_upstream=True,
                    progress=progress)

        logger.debug(f"Successfully pushed branch to remote: {branch_name}")
        return True, {"message": f"Pushed branch to remote: {branch_name}"}

    except git.GitCommandError as e:
        logger.error(f"Git command error pushing branch to remote: {str(e)}",
                     exc_info=True)
        return False, {"error": f"Error pushing branch to remote: {str(e)}"}

    except Exception as e:
        logger.error(f"Error pushing branch to remote: {str(e)}",
                     exc_info=True)
        return False, {"error": f"Error pushing branch to remote: {str(e)}"}

    finally:
        # Reset the URL to remove the GitHub token
        origin.set_url(next(origin.urls))
